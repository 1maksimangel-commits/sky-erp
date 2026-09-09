import { signOut } from "@/lib/auth/actions";
export default function AccessPendingPage() {
  return <main className="mx-auto max-w-lg space-y-4 p-8">
    <h1 className="text-xl font-semibold">Company access required</h1>
    <p>Your account needs an active profile and company membership. Contact your SKY ERP administrator.</p>
    <form action={signOut}><button className="rounded border border-border p-2">Sign out</button></form>
  </main>;
}
