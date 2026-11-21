import { indexDocument, type IndexableDocument } from '@/lib/index-document';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { requireWorkspaceRole, TenantAccessError, tenantNotFound } from '@/lib/tenant';

type Context = { params: Promise<{ workspaceId: string; documentId: string }> };
const missing = () => Response.json({ error: 'Document not found' }, { status: 404 });

async function load(context: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { workspaceId, documentId } = await context.params;
  try {
    await requireWorkspaceRole(user.userId, workspaceId);
  } catch (error) {
    if (error instanceof TenantAccessError) return tenantNotFound();
    throw error;
  }
  const scope = [workspaceId, documentId] as const;
  const row = await env.DB.prepare('SELECT filename,storage_key AS key,content_type AS type,size_bytes AS size FROM documents WHERE workspace_id=? AND id=?')
    .bind(...scope).first<IndexableDocument>();
  return row ? { scope, row } : missing();
}

export async function GET(_request: Request, context: Context) {
  const doc = await load(context);
  if (doc instanceof Response) return doc;
  const object = await env.FILES.get(doc.row.key);
  if (!object) return missing();
  return new Response(object.body, { headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(doc.row.filename).replace(/'/g, '%27'),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

export async function POST(_request: Request, context: Context) {
  const doc = await load(context);
  if (doc instanceof Response) return doc;
  return Response.json(await indexDocument(doc.scope, doc.row));
}
