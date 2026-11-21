'use client';

import { useCallback, useEffect, useState, type SubmitEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Workspace = { id: string; name: string; role: string };
type Document = { id: string; filename: string; status: string; failureReason?: string };
type Hit = { id: string; filename: string; excerpt: string };
type Data = {
  members: { id: string; name: string; role: string }[];
  tickets: { id: string; title: string; description: string; priority: string; status: string; assignee: string | null }[];
  comments: { ticketId: string; body: string; author: string }[];
  analytics: { query: string; searches: number; misses: number }[];
  unresolved: number;
};

const control = 'min-w-0 rounded-md border bg-background px-3 py-2 text-sm';
const statuses = ['open', 'in_progress', 'resolved', 'closed'];

async function api<T>(path: string, body?: FormData | Record<string, unknown>): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch('/api/workspaces' + path, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    headers: body && !form ? { 'Content-Type': 'application/json' } : undefined,
    body: form ? body : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error ?? 'Request failed (' + response.status + ')');
  return result;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}

function Form({ run, children }: { run: (form: FormData) => Promise<void>; children: ReactNode }) {
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    void run(new FormData(element));
  }
  return <form className="flex flex-wrap gap-2" onSubmit={submit}>{children}</form>;
}

function Field({ name, label, type = 'text', maxLength }: { name: string; label: string; type?: string; maxLength?: number }) {
  return <input required name={name} type={type} maxLength={maxLength} className={control} placeholder={label} aria-label={label} />;
}

export default function Dashboard({ signOut }: { signOut: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, select] = useState('');
  const [error, setError] = useState('');
  const workspace = workspaces.find(item => item.id === selected);
  async function list(preferred?: string) {
    const result = await api<{ workspaces: Workspace[] }>('');
    setWorkspaces(result.workspaces);
    select(current => preferred ?? result.workspaces.find(item => item.id === current)?.id ?? result.workspaces[0]?.id ?? '');
  }
  async function run(action: () => Promise<void>) {
    setError('');
    try { await action(); } catch (error) { setError(String(error)); }
  }
  useEffect(() => { void Promise.resolve().then(() => list()).catch((error: unknown) => setError(error instanceof Error ? error.message : "Unable to load workspaces")); }, []);
  return <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
    <header className="flex items-center justify-between"><h1 className="text-3xl font-semibold tracking-tight">ContextDesk</h1><a className="underline" href={signOut}>Sign out</a></header>
    {error && <p role="alert">{error}</p>}
    <Panel title="Workspaces">
      {workspaces.length > 0 && <select aria-label="Workspace" className={control} value={selected} onChange={event => select(event.target.value)}>
        {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>}
      <Form run={form => run(async () => { const result = await api<{ workspace: Workspace }>('', { name: form.get('name') }); await list(result.workspace.id); })}>
        <Field name="name" label="Workspace name" maxLength={80} /><Button type="submit">Create workspace</Button>
      </Form>
      <Form run={form => run(async () => { await api('/join', { code: form.get('code') }); await list(); })}>
        <Field name="code" label="Invitation code" /><Button type="submit" variant="outline">Join workspace</Button>
      </Form>
    </Panel>
    {workspace && <WorkspaceView key={workspace.id} workspace={workspace} />}
  </main>;
}

function WorkspaceView({ workspace }: { workspace: Workspace }) {
  const [data, setData] = useState<Data>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState<{ results: Hit[]; mode: string; answer: string | null; answerUnavailable: boolean }>();
  const needsPolling = documents.some(doc => doc.status === 'queued' || doc.status === 'processing');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = '/' + workspace.id;
  const admin = workspace.role === 'admin';

  const refresh = useCallback(async () => {
    const [files, details] = await Promise.all([api<{ documents: Document[] }>(base + '/documents'), api<Data>(base + '/manage')]);
    setDocuments(files.documents);
    setData(details);
  }, [base]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); } catch (error) { setError(String(error)); } finally { setBusy(false); }
  }
  useEffect(() => { void Promise.resolve().then(refresh).catch((error: unknown) => setError(error instanceof Error ? error.message : "Unable to load workspace")); }, [refresh]);
  useEffect(() => {
    if (!needsPolling || busy) return;
    const timer = setTimeout(() => {
      void refresh().catch(() => setError('Could not refresh document statuses.'));
    }, 1800);
    return () => clearTimeout(timer);
  }, [busy, documents, needsPolling, refresh]);

  async function manage(action: string, form: FormData, ticketId?: string) {
    await run(async () => {
      const result = await api<{ code?: string }>(base + '/manage', { ...Object.fromEntries(form), action, ticketId });
      if (result.code) setInvite(result.code);
      else await refresh();
    });
  }
  const path = (id: string) => base + '/documents/' + id;
  return <fieldset disabled={busy} className="grid min-w-0 gap-5 lg:grid-cols-2">
    {error && <p role="alert" className="lg:col-span-2">{error}</p>}
    <Panel title="Knowledge sources">
      <Form run={form => run(async () => {
        await api(base + '/documents', form);
        await refresh();
      })}>
        <input required type="file" name="file" accept=".txt,.md,.markdown,.pdf,.docx" aria-label="Document file" className={control} /><Button type="submit">Upload</Button>
      </Form>
      <p className="text-sm text-muted-foreground">Upload TXT, Markdown, PDF, or DOCX. Indexing starts automatically.</p>
      {documents.map(doc => <div className="border-t pt-3" key={doc.id}>
        <a className="break-all underline" href={'/api/workspaces' + path(doc.id)}>{doc.filename}</a>
        <p className="text-sm text-muted-foreground">{doc.failureReason ?? doc.status}</p>
        {doc.status !== 'ready' && <Button variant="outline" onClick={() => void run(async () => { await api(path(doc.id), {}); await refresh(); })}>Try indexing</Button>}
      </div>)}
    </Panel>
    <Panel title="Search documents">
      <Form run={form => run(async () => {
        const query = new URLSearchParams({ q: form.get('query') as string });
        if (form.get('answer')) query.set('answer', '1');
        setSearch(await api<NonNullable<typeof search>>(base + '/manage?' + query));
        await refresh();
      })}><Field name="query" label="Search or ask a question" maxLength={250} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="answer" /> Generate cited answer</label>
        <Button type="submit">Search</Button>
      </Form>
      {search && <p className="text-sm text-muted-foreground">{search.mode === 'hybrid' ? 'Semantic and keyword search' : 'Keyword search'}</p>}
      {search?.answerUnavailable && <p role="alert">Answer generation is currently unavailable.</p>}
      {search?.answer && <p className="whitespace-pre-wrap break-words">{search.answer}</p>}
      {search?.results.length === 0 && <p>No matching sources.</p>}
      {search?.results.map((hit, index) => <article className="border-t pt-3" key={hit.id}>
        <a className="underline" href={'/api/workspaces' + path(hit.id)}>[{index + 1}] {hit.filename}</a>
        <p className="whitespace-pre-wrap break-words text-sm">{hit.excerpt}</p>
      </article>)}
    </Panel>
    {data && <>
      <Panel title={'Support tickets · ' + data.unresolved + ' unresolved'}>
        <Form run={form => manage('createTicket', form)}>
          <Field name="title" label="Ticket title" maxLength={150} />
          <textarea required name="description" maxLength={5000} className={control} placeholder="Description" aria-label="Description" />
          <select name="priority" className={control} defaultValue="medium" aria-label="Priority">{['low', 'medium', 'high'].map(value => <option key={value}>{value}</option>)}</select>
          <Button type="submit">Create ticket</Button>
        </Form>
        {data.tickets.map(ticket => <article key={ticket.id} className="space-y-2 border-t pt-4">
          <h3 className="font-semibold">{ticket.title}</h3>
          <p className="whitespace-pre-wrap break-words text-sm">{ticket.description}</p>
          <p className="text-sm text-muted-foreground">{ticket.priority} · {ticket.status.replace('_', ' ')} · {data.members.find(member => member.id === ticket.assignee)?.name ?? 'Unassigned'}</p>
          {admin && <Form key={ticket.status + ticket.assignee} run={form => manage('updateTicket', form, ticket.id)}>
            <select name="status" className={control} defaultValue={ticket.status} aria-label="Status">{statuses.map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select>
            <select name="assignee" className={control} defaultValue={ticket.assignee ?? ''} aria-label="Assignee"><option value="">Unassigned</option>{data.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
            <Button type="submit" variant="outline">Save</Button>
          </Form>}
          {data.comments.filter(comment => comment.ticketId === ticket.id).map((comment, i) => <p key={i} className="break-words text-sm"><strong>{comment.author}</strong> {comment.body}</p>)}
          <Form run={form => manage('comment', form, ticket.id)}><Field name="body" label="Comment" maxLength={3000} /><Button type="submit" variant="outline">Post</Button></Form>
        </article>)}
      </Panel>
      <div className="space-y-5">
        <Panel title="Team">
          <ul>{data.members.map(member => <li key={member.id}>{member.name} · {member.role}</li>)}</ul>
          {admin && <Form run={form => manage('invite', form)}><Field name="email" label="Teammate’s email" type="email" maxLength={254} /><Button type="submit">Generate invitation</Button></Form>}
          {invite && <output className="block break-all text-sm">Share this code with your teammate. It expires in seven days. <code>{invite}</code></output>}
        </Panel>
        <Panel title="Top searches in the last 30 days">
          {data.analytics.length ? <ul>{data.analytics.map(item => <li key={item.query} className="break-words text-sm">{item.query} · {item.searches} searches · {item.misses} without matches</li>)}</ul> : <p>No searches yet.</p>}
        </Panel>
      </div>
    </>}
  </fieldset>;
}
