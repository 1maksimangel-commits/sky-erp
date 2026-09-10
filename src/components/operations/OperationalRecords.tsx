import Link from "next/link";
import { getOperationalRecords } from "@/lib/operations/db";

export async function OperationalRecords({ source }: { source: { dealId: string } | { contractId: string } }) {
  const result = await getOperationalRecords(source);
  return <section className="space-y-4" aria-label="Operational records">
    <h3 className="text-base font-semibold">Operational records</h3>
    <p className="text-sm text-muted-foreground">Linked transactions and retained documents visible to your company. Amounts remain in their original currencies.</p>
    {result.error ? <p role="alert" className="text-sm text-destructive">Unable to load operational records: {result.error}</p> :
      <div className="grid gap-4 xl:grid-cols-2">{result.groups.map(group => <section key={group.label} className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-sm font-medium">{group.label} ({group.rows.length})</h4>
        {group.rows.length ? <ul className="space-y-3">{group.rows.map(row => <li key={row.id} className="text-sm">
          <Link href={row.href} className="underline">{row.label}</Link><p className="text-xs text-muted-foreground">{row.detail}</p>
          <div className="flex flex-wrap gap-3 text-xs">{row.companyId ? <Link href={`/companies/${row.companyId}`} className="underline">Company</Link> : null}{row.contractId ? <Link href={`/contracts/${row.contractId}`} className="underline">Contract</Link> : null}</div>
        </li>)}</ul> : <p className="text-xs text-muted-foreground">No linked records.</p>}
      </section>)}</div>}
  </section>;
}
