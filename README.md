# ContextDesk

ContextDesk is a shared knowledge and support workspace. Teams can invite members, upload documents, search indexed text with links to sources, and track support tickets.

## Architecture

The vinext app runs on Cloudflare Workers in the OpenAI Sites environment. D1 stores memberships, document metadata, the FTS5 index, tickets, comments, and search activity. R2 stores original files under workspace-specific keys. The app expects authentication headers from the Sites gateway. Production traffic must reach the app through a gateway that strips client-supplied identity headers and supplies verified identity.

Each workspace request checks membership. Administrators can issue seven-day, single-use invitations bound to the recipient’s email and can assign or update tickets. Members can upload files, search, create tickets, and comment. The app serves originals as attachments after checking access.

Uploads schedule indexing after the server sends its response. Interrupted or failed indexing can be retried from the dashboard. TXT and Markdown use UTF-8 decoding. Workers AI converts PDF and DOCX to searchable text. Source files may be up to 20 MiB and extracted text is capped at 1 MiB.

Keyword search works with D1 alone. With Workers AI enabled, search also ranks excerpts using embeddings and cosine similarity. Semantic retrieval considers keyword hits and up to three passages from each of the 24 most recently indexed documents in the selected workspace. Generated answers use the retrieved passages and show numbered links to their source files. If the model provides no usable citations, the app shows the search excerpts. The dashboard reports common queries, no-match counts, and unresolved tickets.

## Workers AI

Set `CONTEXTDESK_WORKERS_AI=1` for a build targeting an authorized Cloudflare account, or configure the deployed Worker with a Workers AI binding named `AI`. The binding enables PDF/DOCX conversion, semantic ranking, and answer generation. The Worker sends document bytes for conversion and relevant workspace excerpts and queries for inference. Use the authenticated gateway for every deployment.

## Development

Use Node.js 24 and run:

```sh
npm ci
npx --no-install tsc --noEmit
npm run build
node tests/workspace-smoke.mjs
```

The smoke test loads the compiled app with disposable D1 and R2 bindings and applies the SQL migrations in order. It checks workspace creation, invitation acceptance, document upload and indexing, download, search, ticket assignment and comments, and workspace isolation. The test supplies synthetic identities directly to the local worker. Live sign-in requires the Sites gateway.

Apply the migrations in order to D1 before deploying this app. Existing queued text documents can be indexed from the dashboard.

For the Chromium smoke test at mobile and desktop sizes, install Playwright for Python and its Chromium browser, then run `node tests/workspace-smoke.mjs --browser`. The test uses synthetic workspace data and exercises the keyword path. Live AI inference and conversion require a configured Cloudflare account.
