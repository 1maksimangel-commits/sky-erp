import { AlertCircle } from "lucide-react";
import type { ContractProductLine } from "@/lib/contracts/warehouse";

type ContractWarehouseTabProps = {
  lines: ContractProductLine[] | null;
  error: string | null;
};

export function ContractWarehouseTab({
  lines,
  error,
}: ContractWarehouseTabProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Warehouse</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Product allocation and fulfillment progress
        </p>
      </div>

      {!lines?.length ? (
        <div className="rounded-lg border border-card-border bg-card p-10 text-center text-sm text-muted-foreground">
          No warehouse lines linked to this contract.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  {[
                    "Products",
                    "Quantity",
                    "Reserved",
                    "Packed",
                    "Loaded",
                    "Remaining",
                  ].map((label) => (
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
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {line.product?.name ?? "—"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {line.product?.sku ?? line.product_id}
                      </p>
                    </td>
                    <td className="px-4 py-3">{line.quantity ?? 0}</td>
                    <td className="px-4 py-3">{line.reserved ?? 0}</td>
                    <td className="px-4 py-3">{line.packed ?? 0}</td>
                    <td className="px-4 py-3">{line.loaded ?? 0}</td>
                    <td className="px-4 py-3">{line.remaining ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
