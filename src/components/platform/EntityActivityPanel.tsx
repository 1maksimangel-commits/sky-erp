import type { ActivityEntry } from "@/lib/platform/activity-db";

export function EntityActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) {
    return (
      <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
        No activity logged yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-card-border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-accent/30">
            {["When", "Who", "Action", "Summary", "Old → New"].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-xs font-medium text-muted-foreground"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">{entry.actor ?? "system"}</td>
              <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
              <td className="px-4 py-3">{entry.summary}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {entry.old_value || entry.new_value
                  ? `${JSON.stringify(entry.old_value ?? "—")} → ${JSON.stringify(entry.new_value ?? "—")}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
