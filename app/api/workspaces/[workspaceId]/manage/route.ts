import { answerQuestion, semanticSearch } from '@/lib/knowledge';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureUser, requireWorkspaceRole, TenantAccessError, tenantNotFound } from '@/lib/tenant';

type Context = { params: Promise<{ workspaceId: string }> };
const statuses = ['open', 'in_progress', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high'];

async function authorized(context: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { workspaceId } = await context.params;
  try {
    return { user, workspaceId, role: await requireWorkspaceRole(user.userId, workspaceId) };
  } catch (error) {
    if (error instanceof TenantAccessError) return tenantNotFound();
    throw error;
  }
}

function invalid(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export async function GET(request: Request, context: Context) {
  const access = await authorized(context);
  if (access instanceof Response) return access;
  const { workspaceId } = access;
  const db = env.DB;
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  if (query !== null) {
    const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])].slice(0, 10);
    if (!terms.length || query.length > 250) return invalid('Enter a search query of 2–250 characters');
    const match = terms.map(term => '"' + term + '"').join(' OR ');
    const result = await db.prepare(
      "SELECT d.id, d.filename, snippet(document_search, 2, '', '', ' … ', 36) AS excerpt FROM document_search JOIN documents d ON d.id=document_search.document_id AND d.workspace_id=document_search.workspace_id WHERE document_search MATCH ? AND d.workspace_id=? AND d.status='ready' ORDER BY rank LIMIT 10",
    ).bind(match, workspaceId).all<{ id: string; filename: string; excerpt: string }>();
    let sources = result.results;
    let mode = 'keyword';
    if (env.AI) {
      try {
        sources = await semanticSearch(workspaceId, query, sources);
        mode = 'hybrid';
      } catch {
        // Let keyword search remain available during inference failures.
      }
    }
    const wantsAnswer = url.searchParams.get('answer') === '1';
    let answer: string | null = null;
    let answerUnavailable = wantsAnswer && !env.AI;
    if (wantsAnswer && env.AI && sources.length) {
      try { answer = await answerQuestion(query, sources); }
      catch { answerUnavailable = true; }
    }
    await db.prepare('INSERT INTO search_events (id,workspace_id,query,match_count,created_at) VALUES (?,?,?,?,?)')
      .bind(crypto.randomUUID(), workspaceId, query.trim().toLowerCase(), sources.length, Date.now()).run();
    return Response.json({ results: sources, mode, answer, answerUnavailable });
  }
  const [members, tickets, comments, analytics] = await db.batch([
    db.prepare('SELECT u.id,u.display_name AS name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? ORDER BY u.display_name').bind(workspaceId),
    db.prepare('SELECT id,title,description,status,priority,assigned_to AS assignee FROM tickets WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 100').bind(workspaceId),
    db.prepare('SELECT c.ticket_id AS ticketId,c.body,u.display_name AS author FROM ticket_comments c JOIN tickets t ON t.id=c.ticket_id AND t.workspace_id=c.workspace_id JOIN users u ON u.id=c.author_id WHERE c.workspace_id=? ORDER BY c.created_at DESC LIMIT 300').bind(workspaceId),
    db.prepare('SELECT query, count(*) AS searches, sum(CASE WHEN match_count=0 THEN 1 ELSE 0 END) AS misses FROM search_events WHERE workspace_id=? AND created_at>? GROUP BY query ORDER BY searches DESC LIMIT 10').bind(workspaceId, Date.now() - 30 * 86400000),
  ]);
  const unresolved = await db.prepare("SELECT count(*) AS total FROM tickets WHERE workspace_id=? AND status IN ('open','in_progress')").bind(workspaceId).first<number>('total');
  return Response.json({ members: members.results, tickets: tickets.results, comments: comments.results, analytics: analytics.results, unresolved });
}

export async function POST(request: Request, context: Context) {
  const access = await authorized(context);
  if (access instanceof Response) return access;
  const { workspaceId, user, role } = access;
  const db = env.DB;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== 'object') return invalid('Invalid request');
  const field = (key: string) => typeof input[key] === 'string' ? input[key].trim() as string : '';
  const now = Date.now();
  const id = crypto.randomUUID();
  switch (input.action) {
    case 'invite': {
      if (role !== 'admin') return invalid('Administrator access required', 403);
      const email = field('email').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return invalid('Enter a valid email');
      await db.prepare('INSERT INTO workspace_invites (id,workspace_id,email,expires_at) VALUES (?,?,?,?)')
        .bind(id, workspaceId, email, now + 7 * 86400000).run();
      return Response.json({ code: id }, { status: 201 });
    }
    case 'createTicket': {
      const title = field('title');
      const description = field('description');
      const priority = field('priority');
      if (!title || title.length > 150 || !description || description.length > 5000 || !priorities.includes(priority)) return invalid('Enter a title, description, and priority');
      await ensureUser(user);
      await db.prepare("INSERT INTO tickets (id,workspace_id,title,description,status,priority,created_by,created_at,updated_at) VALUES (?,?,?,?,'open',?,?,?,?)")
        .bind(id, workspaceId, title, description, priority, user.userId, now, now).run();
      return Response.json({ id }, { status: 201 });
    }
    case 'updateTicket': {
      if (role !== 'admin') return invalid('Administrator access required', 403);
      const status = field('status');
      const assignee = field('assignee') || null;
      if (!statuses.includes(status)) return invalid('Invalid ticket status');
      const updated = await db.prepare('UPDATE tickets SET status=?,assigned_to=?,updated_at=? WHERE id=? AND workspace_id=? AND (? IS NULL OR EXISTS (SELECT 1 FROM memberships WHERE workspace_id=? AND user_id=?))')
        .bind(status, assignee, now, field('ticketId'), workspaceId, assignee, workspaceId, assignee).run();
      return updated.meta.changes ? Response.json({ ok: true }) : invalid('Ticket or assignee not found', 404);
    }
    case 'comment': {
      const body = field('body');
      if (!body || body.length > 3000) return invalid('Enter a comment of 1–3000 characters');
      const inserted = await db.prepare('INSERT INTO ticket_comments (id,workspace_id,ticket_id,author_id,body,created_at) SELECT ?,workspace_id,id,?,?,? FROM tickets WHERE id=? AND workspace_id=?')
        .bind(id, user.userId, body, now, field('ticketId'), workspaceId).run();
      return inserted.meta.changes ? Response.json({ id }, { status: 201 }) : invalid('Ticket not found', 404);
    }
    default:
      return invalid('Unknown action');
  }
}
