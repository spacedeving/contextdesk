CREATE TABLE workspace_invites (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE VIRTUAL TABLE document_search USING fts5(document_id UNINDEXED, workspace_id UNINDEXED, body);
--> statement-breakpoint
CREATE TABLE search_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  match_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX search_events_workspace_date ON search_events(workspace_id, created_at);
