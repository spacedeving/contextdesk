import { env } from 'cloudflare:workers';

export type IndexableDocument = { filename: string; key: string; type: string; size: number };
type Scope = readonly [workspaceId: string, documentId: string];

export async function indexDocument(scope: Scope, row: IndexableDocument) {
  const db = env.DB;
  const now = Date.now();
  const claim = await db.prepare("UPDATE documents SET status='processing',failure_reason=NULL,updated_at=? WHERE workspace_id=? AND id=? AND (status IN ('queued','failed') OR (status='processing' AND updated_at<?))")
    .bind(now, ...scope, now - 300000).run();
  if (!claim.meta.changes) return { ok: true };

  try {
    const object = await env.FILES.get(row.key);
    if (!object) throw new Error('The source file is missing.');
    const source = await object.arrayBuffer();
    let body: string;
    if (row.type === 'text/plain' || row.type === 'text/markdown') {
      body = new TextDecoder('utf-8', { fatal: true }).decode(source);
    } else {
      if (!env.AI) throw new Error('PDF and DOCX indexing requires the Workers AI binding.');
      const result = await env.AI.toMarkdown({ name: row.filename, blob: new Blob([source], { type: row.type }) });
      if (result.format === 'error') throw new Error('Unable to extract text from this document.');
      body = result.data;
    }
    body = body.trim();
    if (!body || body.includes('\0')) throw new Error('The document contains no readable text.');
    if (new TextEncoder().encode(body).length > 1024 * 1024) throw new Error('Extracted text exceeds the 1 MiB search limit.');
    const [, updated] = await db.batch([
      db.prepare("INSERT INTO document_search (workspace_id,document_id,body) SELECT workspace_id,id,? FROM documents WHERE workspace_id=? AND id=? AND status='processing' AND updated_at=?")
        .bind(body, ...scope, now),
      db.prepare("UPDATE documents SET status='ready',updated_at=? WHERE workspace_id=? AND id=? AND status='processing' AND updated_at=?")
        .bind(Date.now(), ...scope, now),
    ]);
    return updated.meta.changes ? { status: 'ready' } : { ok: true };
  } catch (error) {
    const reason = error instanceof Error && [
      'The source file is missing.', 'PDF and DOCX indexing requires the Workers AI binding.',
      'Unable to extract text from this document.', 'The document contains no readable text.',
      'Extracted text exceeds the 1 MiB search limit.',
    ].includes(error.message) ? error.message : 'Indexing failed. Verify the file and try again.';
    await db.prepare("UPDATE documents SET status='failed',failure_reason=?,updated_at=? WHERE workspace_id=? AND id=? AND status='processing' AND updated_at=?")
      .bind(reason, Date.now(), ...scope, now).run();
    return { status: 'failed' };
  }
}
