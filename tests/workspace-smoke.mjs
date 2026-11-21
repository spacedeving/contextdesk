import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const config = JSON.parse(await readFile('dist/server/wrangler.json', 'utf8'));
const rootDir = 'dist/server';
const entry = 'index.js';
const chunks = (await readdir(rootDir, { recursive: true })).filter(file => file.endsWith('.js') && file !== entry);
const worker = new Miniflare({
  modulesRoot: rootDir,
  modules: [entry, ...chunks].map(file => ({ type: 'ESModule', path: rootDir + '/' + file.split('\\').join('/') })),
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  d1Databases: ['DB'],
  r2Buckets: ['FILES'],
  assets: { directory: 'dist/client', binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
});

try {
  const db = await worker.getD1Database('DB');
  for (const migration of ['0000_wild_loki', '0001_workspace_features']) {
    const sql = await readFile('drizzle/' + migration + '.sql', 'utf8');
    await db.batch(sql.split('--> statement-breakpoint').filter(part => part.trim()).map(part => db.prepare(part)));
  }

  async function request(path, status, identity = 'alice', body) {
    const headers = new Headers();
    if (identity) {
      headers.set('oai-authenticated-user-id', identity);
      headers.set('oai-authenticated-user-email', identity + '@example.test');
    }
    let payload;
    if (body instanceof FormData) {
      const multipart = new Request('http://localhost', { method: 'POST', body });
      headers.set('content-type', multipart.headers.get('content-type'));
      payload = await multipart.arrayBuffer();
    } else if (body) {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }
    const response = await worker.dispatchFetch('http://localhost' + path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: payload,
    });
    const content = await response.text();
    assert.equal(response.status, status, path + ' ' + content);
    return response.headers.get('content-type')?.includes('application/json') ? JSON.parse(content) : content;
  }

  const root = '/api/workspaces';
  assert.match(await request('/', 200, null), /Sign in with ChatGPT/);
  await request(root, 401, null);
  await request(root, 400, 'alice', { name: 42 });
  const { workspace } = await request(root, 201, 'alice', { name: 'Smoke workspace' });
  const base = root + '/' + workspace.id;
  const manage = base + '/manage';
  await request(base + '/documents', 404, 'eve');
  const { code } = await request(manage, 201, 'alice', { action: 'invite', email: 'bob@example.test' });
  await request(root + '/join', 404, 'eve', { code });
  await request(root + '/join', 200, 'bob', { code });
  await request(root + '/join', 404, 'bob', { code });
  await request(manage, 403, 'bob', { action: 'invite', email: 'eve@example.test' });

  const upload = new FormData();
  upload.set('file', new File(['Unique cactus troubleshooting instructions.'], 'guide.txt', { type: 'text/plain' }));
  const { document } = await request(base + '/documents', 201, 'bob', upload);
  const source = base + '/documents/' + document.id;
  await request(source, 404, 'eve');
  await request(source, 404, 'eve', {});
  let status;
  for (let attempt = 0; attempt < 30; attempt++) {
    status = (await request(base + '/documents', 200, 'bob')).documents[0].status;
    if (status === 'ready' || status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(status, 'ready', 'The upload handler should index the file in the background');
  await request(source, 200, 'alice', {});
  assert.match(await request(source, 200, 'bob'), /Unique cactus/);
  assert.equal((await request(manage + '?q=cactus', 200, 'bob')).results.length, 1);
  const other = (await request(root, 201, 'eve', { name: 'Other workspace' })).workspace;
  assert.equal((await request(root + '/' + other.id + '/manage?q=cactus', 200, 'eve')).results.length, 0);
  await request(root + '/' + other.id + '/documents/' + document.id, 404, 'eve');

  const { id } = await request(manage, 201, 'bob', {
    action: 'createTicket', title: 'Help', description: 'The export failed.', priority: 'high',
  });
  const update = { action: 'updateTicket', ticketId: id, status: 'resolved', assignee: 'bob' };
  await request(manage, 403, 'bob', update);
  await request(manage, 404, 'alice', { ...update, assignee: 'eve' });
  await request(manage, 200, 'alice', update);
  await request(manage, 201, 'bob', { action: 'comment', ticketId: id, body: 'Confirmed.' });
  const summary = await request(manage, 200, 'alice');
  assert.equal(summary.unresolved, 0);
  assert.equal(summary.tickets[0].assignee, 'bob');
  assert.equal(summary.comments[0].body, 'Confirmed.');
  assert.equal(summary.analytics[0].searches, 1);
  console.log('Workspace smoke test passed');

  if (process.argv.includes('--browser')) {
    // Test-only gateway. It listens on an ephemeral loopback port and injects a synthetic identity.
    const server = createServer(async (incoming, outgoing) => {
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (typeof value === 'string' && !['host', 'connection', 'transfer-encoding'].includes(key)) headers.set(key, value);
        }
        headers.set('oai-authenticated-user-id', 'browser');
        headers.set('oai-authenticated-user-email', 'browser@example.test');
        const parts = [];
        for await (const part of incoming) parts.push(part);
        const response = await worker.dispatchFetch('http://localhost' + incoming.url, {
          method: incoming.method, headers, body: parts.length ? Buffer.concat(parts) : undefined,
        });
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        console.error(error);
        outgoing.writeHead(500).end();
      }
    });
    try {
      await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
      const code = await new Promise((resolve, reject) => {
        spawn('python', ['tests/browser-smoke.py', 'http://127.0.0.1:' + server.address().port], { stdio: 'inherit' })
          .once('exit', resolve).once('error', reject);
      });
      assert.equal(code, 0);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  }
} finally {
  await worker.dispose();
}
