import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
export type WorkspaceRole = 'admin' | 'member';
export async function ensureUser(user: ChatGPTUser) { await env.DB.prepare('INSERT INTO users (id,email,display_name,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name').bind(user.userId, user.email, user.displayName, Date.now()).run(); }
export async function requireWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole> { const row = await env.DB.prepare('SELECT role FROM memberships WHERE workspace_id=? AND user_id=? LIMIT 1').bind(workspaceId, userId).first<{ role: WorkspaceRole }>(); if (!row) throw new TenantAccessError(); return row.role; }
export class TenantAccessError extends Error { constructor() { super('Workspace not found'); this.name = 'TenantAccessError'; } }
export function tenantNotFound() { return Response.json({ error: 'Workspace not found' }, { status: 404 }); }
