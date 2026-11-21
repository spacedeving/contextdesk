import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureUser } from '@/lib/tenant';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const input = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof input?.code === 'string' ? input.code.trim() : '';
  if (!/^[a-f0-9-]{36}$/i.test(code)) return Response.json({ error: 'Invalid invitation' }, { status: 400 });
  await ensureUser(user);
  const filters = [code, user.email.toLowerCase(), Date.now()] as const;
  const [result] = await env.DB.batch([
    env.DB.prepare("INSERT INTO memberships (workspace_id,user_id,role,joined_at) SELECT workspace_id,?,'member',? FROM workspace_invites WHERE id=? AND email=? AND expires_at>? ON CONFLICT(workspace_id,user_id) DO NOTHING")
      .bind(user.userId, Date.now(), ...filters),
    env.DB.prepare('DELETE FROM workspace_invites WHERE id=? AND email=? AND expires_at>?').bind(...filters),
  ]);
  if (!result.meta.changes) return Response.json({ error: 'Invitation unavailable or you already belong to this workspace' }, { status: 404 });
  return Response.json({ ok: true });
}
