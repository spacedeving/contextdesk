import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from './chatgpt-auth';
import Dashboard from './dashboard';

export default async function Home() {
  if (await getChatGPTUser()) return <Dashboard signOut={chatGPTSignOutPath()} />;
  return <main className="mx-auto max-w-3xl px-6 py-24">
    <h1 className="text-5xl font-semibold tracking-tight">ContextDesk</h1>
    <p className="my-6 text-lg text-muted-foreground">Search your team’s documents and manage support tickets in a shared workspace.</p>
    <a className="inline-block rounded-lg bg-primary px-5 py-3 text-primary-foreground" href={chatGPTSignInPath('/')}>Sign in with ChatGPT</a>
  </main>;
}
