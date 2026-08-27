import { getCurrentRole, getRolePermissions } from "@/lib/platform/permissions";
import { ROLE_CODES, type RoleCode } from "@/lib/platform/types";

const ROLE_LABELS: Record<RoleCode, string> = {
  admin: "Admin",
  finance: "Finance",
  sales: "Sales",
  logistics: "Logistics",
  warehouse: "Warehouse",
  management: "Management",
  readonly: "Read-only",
};

const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  admin: "Full access across every module and settings.",
  finance: "Invoices, payments, banks, FX, and finance reports.",
  sales: "Business cases, contracts, counterparties, and documents.",
  logistics: "Shipments, containers, and logistics documents.",
  warehouse: "Inventory receive/issue/transfer and stock visibility.",
  management: "Read access to dashboards and operational reports.",
  readonly: "View-only access across the ERP.",
};

export default function SettingsPage() {
  const currentRole = getCurrentRole();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Organization preferences, role matrix, and platform controls. Auth
          binding comes next — roles are enforced in Server Actions today with
          the session defaulting to Admin.
        </p>
      </div>

      <div className="rounded-lg border border-card-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">Current session role</h2>
        <p className="mt-2 text-2xl font-semibold text-foreground">
          {ROLE_LABELS[currentRole]}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {ROLE_DESCRIPTIONS[currentRole]}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-card-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-accent/30">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                Permissions
              </th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROLE_CODES.map((role) => (
              <tr key={role} className="hover:bg-accent/20">
                <td className="px-4 py-3 font-medium text-foreground">
                  {ROLE_LABELS[role]}
                  {role === currentRole ? (
                    <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                      Active
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {getRolePermissions(role).join(", ")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
