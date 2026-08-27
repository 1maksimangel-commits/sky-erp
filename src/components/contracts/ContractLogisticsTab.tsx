"use client";

import { AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShipmentFormModal } from "@/components/logistics/ShipmentFormModal";
import { Toast } from "@/components/ui/Toast";
import type {
  BusinessCaseOption,
  ContractOption,
  Shipment,
} from "@/lib/logistics/db";
import { formatShipmentDate } from "@/lib/logistics/format";

type ContractLogisticsTabProps = {
  contractId: string;
  contractNumber: string;
  hasCompany: boolean;
  hasBusinessCase: boolean;
  shipments: Shipment[] | null;
  error: string | null;
  contracts: ContractOption[];
  businessCases: BusinessCaseOption[];
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Planned";

  const className =
    label === "Planned"
      ? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
      : label === "In Transit"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : label === "Delivered"
          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
          : label === "Delayed"
            ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
            : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

export function ContractLogisticsTab({
  contractId,
  contractNumber,
  hasCompany,
  hasBusinessCase,
  shipments,
  error,
  contracts,
  businessCases,
}: ContractLogisticsTabProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canCreateShipment = hasCompany && hasBusinessCase;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Logistics</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shipments for contract {contractNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/logistics"
            className="inline-flex items-center rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            Open Logistics
          </Link>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={!canCreateShipment}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New Shipment
          </button>
        </div>
      </div>

      {!canCreateShipment ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="space-y-1 text-sm text-amber-100">
            <p>
              Link company and business case on this contract before creating a
              shipment.
            </p>
            <div className="flex flex-wrap gap-3">
              {!hasCompany ? (
                <Link
                  href={`/contracts/${contractId}`}
                  className="underline-offset-4 hover:underline"
                >
                  Set company on contract
                </Link>
              ) : null}
              {!hasBusinessCase ? (
                <Link
                  href={`/contracts/${contractId}/business-case`}
                  className="underline-offset-4 hover:underline"
                >
                  Create / link business case
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ShipmentFormModal
        open={formOpen}
        defaultContractId={contractId}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          router.refresh();
          setToast("Shipment saved successfully.");
        }}
        contracts={contracts}
        businessCases={businessCases}
      />

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}

      {!shipments?.length ? (
        <div className="rounded-lg border border-card-border bg-card p-10 text-center text-sm text-muted-foreground">
          No shipments recorded for this contract.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  {[
                    "Container",
                    "Vessel",
                    "Voyage",
                    "Port of Loading",
                    "Port of Destination",
                    "ETD",
                    "ETA",
                    "Status",
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
                {shipments.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/logistics/${item.id}`)}
                    className="cursor-pointer transition-colors hover:bg-accent/20"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.container ?? "—"}
                    </td>
                    <td className="px-4 py-3">{item.vessel ?? "—"}</td>
                    <td className="px-4 py-3">{item.voyage ?? "—"}</td>
                    <td className="px-4 py-3">{item.port_of_loading ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.port_of_destination ?? "—"}
                    </td>
                    <td className="px-4 py-3">{formatShipmentDate(item.etd)}</td>
                    <td className="px-4 py-3">{formatShipmentDate(item.eta)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
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
