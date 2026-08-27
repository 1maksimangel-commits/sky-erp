"use client";

import {
  AlertCircle,
  Anchor,
  Clock,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Ship,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageActions } from "@/components/layout/ShellContext";
import { ShipmentDeleteDialog } from "@/components/logistics/ShipmentDeleteDialog";
import { ShipmentFormModal } from "@/components/logistics/ShipmentFormModal";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import type {
  BusinessCaseOption,
  ContractOption,
  Shipment,
  ShipmentStats,
} from "@/lib/logistics/db";
import { SHIPMENT_STATUSES } from "@/lib/logistics/types";
import { formatShipmentDate } from "@/lib/logistics/format";
import { useSearchParamOpen } from "@/lib/ui/open-state";

type LogisticsViewProps = {
  shipments: Shipment[] | null;
  stats: ShipmentStats | null;
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

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div className="rounded-md bg-accent p-2 text-muted-foreground">{icon}</div>
      </div>
    </div>
  );
}

export function LogisticsView({
  shipments,
  stats,
  error,
  contracts,
  businessCases,
}: LogisticsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vesselFilter, setVesselFilter] = useState("");
  const [etdFrom, setEtdFrom] = useState("");
  const [etdTo, setEtdTo] = useState("");
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const newFlagged = searchParams.get("new") === "1";
  const [prevNewFlagged, setPrevNewFlagged] = useState(newFlagged);
  if (newFlagged !== prevNewFlagged) {
    setPrevNewFlagged(newFlagged);
    if (newFlagged) {
      setEditingShipment(null);
    }
  }

  const filteredShipments = useMemo(() => {
    if (!shipments) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return shipments.filter((item) => {
      if (contractFilter !== "all" && item.contract_id !== contractFilter) {
        return false;
      }

      if (statusFilter !== "all" && (item.status ?? "Planned") !== statusFilter) {
        return false;
      }

      if (
        vesselFilter.trim() &&
        !item.vessel?.toLowerCase().includes(vesselFilter.trim().toLowerCase())
      ) {
        return false;
      }

      if (etdFrom && (!item.etd || item.etd < etdFrom)) {
        return false;
      }

      if (etdTo && (!item.etd || item.etd > etdTo)) {
        return false;
      }

      if (etaFrom && (!item.eta || item.eta < etaFrom)) {
        return false;
      }

      if (etaTo && (!item.eta || item.eta > etaTo)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.container,
        item.container_type,
        item.seal_number,
        item.vessel,
        item.voyage,
        item.shipping_line,
        item.booking_number,
        item.tracking_number,
        item.freight_forwarder,
        item.port_of_loading,
        item.port_of_destination,
        item.contract?.contract_number,
        item.business_case?.case_number,
        item.status,
        item.remarks,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [
    shipments,
    search,
    contractFilter,
    statusFilter,
    vesselFilter,
    etdFrom,
    etdTo,
    etaFrom,
    etaTo,
  ]);

  function openCreateModal() {
    setEditingShipment(null);
    setFormOpen(true);
  }

  function openEditModal(shipment: Shipment) {
    setEditingShipment(shipment);
    setFormOpen(true);
  }

  function closeFormModal() {
    setFormOpen(false);
    setEditingShipment(null);
    if (searchParams.get("new") === "1") router.replace("/logistics");
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h3 className="text-sm font-medium text-red-300">
              Failed to load shipments
            </h3>
            <p className="mt-1 text-sm text-red-400/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageActions>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Shipment
        </button>
      </PageActions>

      <ShipmentFormModal
        open={formOpen}
        shipment={editingShipment}
        onClose={closeFormModal}
        onSaved={() => {
          router.refresh();
          setToast(
            editingShipment
              ? "Shipment updated successfully."
              : "Shipment saved successfully."
          );
        }}
        contracts={contracts}
        businessCases={businessCases}
      />

      <ShipmentDeleteDialog
        open={Boolean(deleteTarget)}
        shipment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          router.refresh();
          setToast("Shipment deleted successfully.");
        }}
      />

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Planned"
          value={String(stats?.planned ?? 0)}
          icon={<Anchor className="h-4 w-4" />}
        />
        <KpiCard
          title="In Transit"
          value={String(stats?.inTransit ?? 0)}
          icon={<Ship className="h-4 w-4" />}
        />
        <KpiCard
          title="Delivered"
          value={String(stats?.delivered ?? 0)}
          icon={<PackageCheck className="h-4 w-4" />}
        />
        <KpiCard
          title="Delayed"
          value={String(stats?.delayed ?? 0)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search container, vessel, voyage, ports, contract..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All contracts</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.contract_number}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            {SHIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Filter by vessel"
            value={vesselFilter}
            onChange={(e) => setVesselFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <input
            type="date"
            aria-label="ETD from"
            value={etdFrom}
            onChange={(e) => setEtdFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="date"
            aria-label="ETD to"
            value={etdTo}
            onChange={(e) => setEtdTo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="date"
            aria-label="ETA from"
            value={etaFrom}
            onChange={(e) => setEtaFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="date"
            aria-label="ETA to"
            value={etaTo}
            onChange={(e) => setEtaTo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {filteredShipments.length === 0 ? (
        <div className="rounded-lg border border-card-border bg-card p-12 text-center">
          <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {shipments?.length ? "No shipments match your filters" : "No shipments yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a shipment to start tracking seafood exports.
          </p>
        </div>
      ) : (
        <TableShell rowCount={filteredShipments.length}>
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Container",
                    "Vessel",
                    "Voyage",
                    "Contract",
                    "Business Case",
                    "POL",
                    "POD",
                    "ETD",
                    "ETA",
                    "Status",
                    "Actions",
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
                {filteredShipments.map((item) => (
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
                    <td className="px-4 py-3">
                      {item.contract ? (
                        <Link
                          href={`/contracts/${item.contract.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs underline-offset-4 hover:underline"
                        >
                          {item.contract.contract_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.business_case?.case_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">{item.port_of_loading ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.port_of_destination ?? "—"}
                    </td>
                    <td className="px-4 py-3">{formatShipmentDate(item.etd)}</td>
                    <td className="px-4 py-3">{formatShipmentDate(item.eta)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Edit shipment"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(item);
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete shipment"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(item);
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableShell>
      )}
    </div>
  );
}
