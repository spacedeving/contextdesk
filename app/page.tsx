import { Bell, BookOpenText, ChevronDown, CircleHelp, FileText, FolderOpen, LayoutDashboard, LifeBuoy, MessageSquareText, Plus, Search, Settings, Sparkles, TicketCheck, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sources = [
  { name: 'Customer onboarding guide', type: 'PDF', status: 'Ready', age: '12 min ago' },
  { name: 'Returns and refunds policy', type: 'DOCX', status: 'Ready', age: 'Yesterday' },
  { name: 'Product release notes', type: 'Website', status: 'Processing', age: '2 min ago' },
];

const nav = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Knowledge', icon: BookOpenText },
  { label: 'Ask', icon: MessageSquareText },
  { label: 'Tickets', icon: TicketCheck, badge: '4' },
  { label: 'Team', icon: Users },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-4" /></div>
            <div><p className="font-semibold tracking-tight">ContextDesk</p><p className="text-xs text-muted-foreground">Northstar Support</p></div>
            <ChevronDown className="ml-auto size-4 text-muted-foreground" />
          </div>
          <nav className="mt-8 space-y-1" aria-label="Workspace navigation">
            {nav.map(({ label, icon: Icon, active, badge }) => (
              <a key={label} href="#" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'}`}>
                <Icon className="size-4" />{label}{badge && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{badge}</span>}
              </a>
            ))}
          </nav>
          <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground"><Settings className="size-4" /> Settings</a>
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground"><CircleHelp className="size-4" /> Help center</a>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex h-16 items-center gap-3 border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"><Sparkles className="size-4" /></div>
            <div className="relative hidden w-full max-w-md sm:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-9 w-full rounded-lg border bg-muted/45 pl-9 pr-16 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10" placeholder="Search knowledge, answers, and tickets" aria-label="Search workspace" />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl K</kbd>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto" aria-label="Notifications"><Bell /></Button>
            <div className="grid size-8 place-items-center rounded-full bg-[#dff4ee] text-xs font-bold text-[#176b56]">AM</div>
          </header>

          <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="mb-1 text-sm font-medium text-primary">Workspace overview</p><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Good morning, Amina</h1><p className="mt-2 text-muted-foreground">Your team’s knowledge and support work, in one grounded view.</p></div>
              <div className="flex gap-2"><Button variant="outline" size="lg"><Upload /> Upload source</Button><Button size="lg"><Plus /> Ask a question</Button></div>
            </div>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace metrics">
              {[
                ['Knowledge sources', '48', '+6 this month', FolderOpen], ['Questions answered', '1,284', '92% cited', MessageSquareText], ['Open tickets', '4', '2 need attention', LifeBuoy], ['Search success', '87%', '+4.2% this week', Search],
              ].map(([label, value, note, Icon]) => (
                <Card key={label as string} className="border-none shadow-[0_1px_2px_rgb(25_35_30/5%),0_8px_28px_rgb(25_35_30/4%)] ring-1 ring-border"><CardContent className="flex items-start justify-between pt-1"><div><p className="text-sm text-muted-foreground">{label as string}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value as string}</p><p className="mt-1 text-xs text-muted-foreground">{note as string}</p></div><div className="grid size-9 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-4" /></div></CardContent></Card>
              ))}
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
              <Card className="border-none shadow-[0_1px_2px_rgb(25_35_30/5%),0_8px_28px_rgb(25_35_30/4%)] ring-1 ring-border">
                <CardHeader className="border-b"><CardTitle>Ask your workspace</CardTitle><p className="text-sm text-muted-foreground">Answers use only sources available to Northstar Support.</p></CardHeader>
                <CardContent><div className="rounded-xl border bg-muted/30 p-4"><textarea className="min-h-24 w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground" placeholder="Ask a question about your team’s knowledge…" aria-label="Question" /><div className="flex items-center justify-between border-t pt-3"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" /> 48 sources available</span><Button><Sparkles /> Get grounded answer</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{['What is our refund approval process?', 'Summarize the latest product changes'].map((q) => <button key={q} className="rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary/35 hover:bg-accent/40">{q}</button>)}</div></CardContent>
              </Card>

              <Card className="border-none shadow-[0_1px_2px_rgb(25_35_30/5%),0_8px_28px_rgb(25_35_30/4%)] ring-1 ring-border">
                <CardHeader className="border-b"><CardTitle>Needs attention</CardTitle><p className="text-sm text-muted-foreground">Unresolved support work</p></CardHeader>
                <CardContent className="space-y-4">{[['Billing portal access', 'High', '38 min'], ['SSO setup for contractors', 'Medium', '2 hr'], ['Export format request', 'Low', 'Yesterday']].map(([title, priority, age]) => <div key={title} className="flex items-start gap-3"><span className={`mt-1.5 size-2 rounded-full ${priority === 'High' ? 'bg-[#dc645d]' : priority === 'Medium' ? 'bg-[#d8a23f]' : 'bg-[#6f9f91]'}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{priority} · {age}</p></div></div>)}<Button variant="outline" className="mt-2 w-full">View all tickets</Button></CardContent>
              </Card>
            </div>

            <Card className="mt-6 border-none shadow-[0_1px_2px_rgb(25_35_30/5%),0_8px_28px_rgb(25_35_30/4%)] ring-1 ring-border">
              <CardHeader className="border-b"><CardTitle>Recent knowledge sources</CardTitle><p className="text-sm text-muted-foreground">Documents and pages available to your workspace</p></CardHeader>
              <CardContent className="divide-y px-0">{sources.map((source) => <div key={source.name} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 sm:grid-cols-[1fr_100px_110px_100px]"><div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><FileText className="size-4" /></div><p className="truncate text-sm font-medium">{source.name}</p></div><span className="hidden text-sm text-muted-foreground sm:block">{source.type}</span><span className={`hidden w-fit rounded-full px-2 py-1 text-xs font-medium sm:block ${source.status === 'Ready' ? 'bg-[#e5f4ef] text-[#176b56]' : 'bg-[#fff3d7] text-[#8a6415]'}`}>{source.status}</span><span className="text-right text-xs text-muted-foreground sm:text-left">{source.age}</span></div>)}</CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
