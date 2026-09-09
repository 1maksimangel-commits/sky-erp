import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
    <h1 className="text-2xl font-semibold">Sign in to SKY ERP</h1>
    <form action={signIn} className="space-y-4">
      <label className="block text-sm">Email<input className="mt-1 w-full rounded border border-border bg-card p-2" type="email" name="email" autoComplete="username" required maxLength={320} /></label>
      <label className="block text-sm">Password<input className="mt-1 w-full rounded border border-border bg-card p-2" type="password" name="password" autoComplete="current-password" required maxLength={1024} /></label>
      {error ? <p role="alert" className="text-sm text-destructive">Unable to sign in. Check your credentials and try again.</p> : null}
      <button className="w-full rounded bg-primary p-2 text-primary-foreground" type="submit">Sign in</button>
    </form>
  </main>;
}
