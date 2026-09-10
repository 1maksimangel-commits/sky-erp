"use client";

import {
  AlertCircle,
  ArrowLeftRight,
  Boxes,
  MinusCircle,
  PackageMinus,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { WarehouseOperationModal } from "@/components/warehouse/WarehouseOperationModal";
import type {
  InventoryLotRow,
  WarehouseLocation,
  WarehouseProductOption,
  WarehouseStats,
} from "@/lib/warehouse/db";
import { formatWarehouseDate } from "@/lib/warehouse/format";
import { LOT_STATUSES, type WarehouseOperationType } from "@/lib/warehouse/types";

type WarehouseViewProps = {
  lots: InventoryLotRow[] | null;
  stats: WarehouseStats | null;
  warehouses: WarehouseLocation[];
  products: WarehouseProductOption[];
  error: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Available"
      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
      : status === "Reserved"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : status === "Quarantine"
          ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
          : status === "Expired" || status === "Depleted"
            ? "bg-red-500/10 text-red-400 ring-red-500/20"
            : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {status}
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

function formatQty(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatStock(stats: WarehouseStats | null, key: "totalStock" | "reserved" | "available") {
  return stats?.unitTotals.map((item) => `${formatQty(item[key])} ${item.unit}`).join(" · ") || "0";
}

export function WarehouseView({
  lots,
  stats,
  warehouses,
  products,
  error,
}: WarehouseViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [lotFilter, setLotFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operation, setOperation] = useState<WarehouseOperationType | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{
    companyId?: string;
    warehouseId?: string;
    productId?: string;
    lotNumber?: string;
  }>({});

  const filteredLots = useMemo(() => {
    if (!lots) {
      return [];
    }

    const query = search.trim().toLowerCase();
    const lotQuery = lotFilter.trim().toLowerCase();

    return lots.filter((item) => {
      if (
        warehouseFilter !== "all" &&
        item.warehouse_id !== warehouseFilter
      ) {
        return false;
      }

      if (productFilter !== "all" && item.product_id !== productFilter) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (lotQuery && !item.lot_number.toLowerCase().includes(lotQuery)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.product?.name,
        item.product?.sku,
        item.warehouse?.code,
        item.warehouse?.name,
        item.lot_number,
        item.status,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [
    lots,
    search,
    warehouseFilter,
    productFilter,
    lotFilter,
    statusFilter,
  ]);

  function openOperation(
    next: WarehouseOperationType,
    row?: InventoryLotRow
  ) {
    setPrefill(
      row
        ? {
            warehouseId: row.warehouse_id,
            companyId: row.company_id,
            productId: row.product_id,
            lotNumber: row.lot_number,
          }
        : {}
    );
    setOperation(next);
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h3 className="text-sm font-medium text-red-300">
              Failed to load warehouse
            </h3>
            <p className="mt-1 text-sm text-red-400/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Cold store stock levels, lots, transfers, and inventory movements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openOperation("receive")}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Receive
          </button>
          <button
            type="button"
            onClick={() => openOperation("issue")}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <PackageMinus className="h-3.5 w-3.5" />
            Issue
          </button>
          <button
            type="button"
            onClick={() => openOperation("transfer")}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transfer
          </button>
          <button
            type="button"
            onClick={() => openOperation("adjust")}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Adjust
          </button>
        </div>
      </div>

      {operation ? (
        <WarehouseOperationModal
          open
          operation={operation}
          onClose={() => setOperation(null)}
          onSaved={(message) => {
            router.refresh();
            setToast(message);
          }}
          warehouses={warehouses}
          products={products}
          defaultWarehouseId={prefill.warehouseId}
          defaultCompanyId={prefill.companyId}
          defaultProductId={prefill.productId}
          defaultLotNumber={prefill.lotNumber}
        />
      ) : null}

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Stock"
          value={formatStock(stats, "totalStock")}
          icon={<Boxes className="h-4 w-4" />}
        />
        <KpiCard
          title="Reserved"
          value={formatStock(stats, "reserved")}
          icon={<MinusCircle className="h-4 w-4" />}
        />
        <KpiCard
          title="Available"
          value={formatStock(stats, "available")}
          icon={<PackagePlus className="h-4 w-4" />}
        />
        <KpiCard
          title="Low Stock"
          value={String(stats?.lowStock ?? 0)}
          icon={<AlertCircle className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search product, SKU, warehouse, lot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.name}
              </option>
            ))}
          </select>

          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Filter by lot"
            value={lotFilter}
            onChange={(e) => setLotFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            {LOT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredLots.length === 0 ? (
        <div className="rounded-lg border border-card-border bg-card p-12 text-center">
          <Warehouse className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {lots?.length ? "No lots match your filters" : "No inventory yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Receive inventory to create your first warehouse lot.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  {[
                    "Product",
                    "Warehouse",
                    "Lot",
                    "Available",
                    "Reserved",
                    "Total",
                    "Expiry",
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
                {filteredLots.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-accent/20"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/warehouse/lots/${item.id}`)}
                        className="text-left"
                      >
                        <p className="font-medium text-foreground hover:underline">
                          {item.product?.name ?? "—"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.product?.sku ?? "—"}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">
                        {item.warehouse?.name ?? "—"}
                        <span className="block text-xs text-muted-foreground">Owner: {item.owner_name}</span>
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.warehouse?.code ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => router.push(`/warehouse/lots/${item.id}`)}
                        className="hover:underline"
                      >
                        {item.lot_number}
                      </button>
                    </td>
                    <td className="px-4 py-3">{formatQty(item.available)}</td>
                    <td className="px-4 py-3">{formatQty(item.reserved)}</td>
                    <td className="px-4 py-3">{formatQty(item.total)} {item.unit}</td>
                    <td className="px-4 py-3">
                      {formatWarehouseDate(item.expiry_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openOperation("issue", item)}
                          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          Issue
                        </button>
                        <button
                          type="button"
                          onClick={() => openOperation("transfer", item)}
                          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => openOperation("adjust", item)}
                          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          Adjust
                        </button>
                      </div>
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
