"use client";

import {
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Package,
  Plus,
  Search,
  Tag,
  ToggleLeft,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageActions } from "@/components/layout/ShellContext";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { ProductImportModal } from "@/components/products/ProductImportModal";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import type { Product, ProductStats } from "@/lib/products";
import { emptyProductForm } from "@/lib/products/types";
import { setProductActive } from "@/lib/products/actions";
import { useSearchParamOpen } from "@/lib/ui/open-state";

type ProductsViewProps = {
  products: Product[] | null;
  stats: ProductStats | null;
  error: string | null;
};

type StatusFilter = "all" | "active" | "inactive";

function formatPrice(value: number | null, currency: string | null): string {
  if (value == null) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  const label = isActive ? "Active" : "Inactive";
  const className = isActive
    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
    : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

function ProductPhoto({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-accent/40">
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={name}
      width={40}
      height={40}
      loader={({ src }) => src}
      unoptimized
      className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
      onError={() => setFailed(true)}
    />
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
    <div className="erp-panel p-5">
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

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div>
          <h3 className="text-sm font-medium text-red-300">
            Failed to load products
          </h3>
          <p className="mt-1 text-sm text-red-400/90">{message}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-12 text-center">
      <Package className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {filtered ? "No products match your filters" : "No products found"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try adjusting your search or filter criteria."
          : "Add your first product to start building the catalog."}
      </p>
    </div>
  );
}

export function ProductsView({ products, stats, error }: ProductsViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!products) {
      return [];
    }

    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort() as string[];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (categoryFilter !== "all" && product.category !== categoryFilter) {
        return false;
      }

      if (statusFilter === "active" && !product.is_active) {
        return false;
      }

      if (statusFilter === "inactive" && product.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        product.sku,
        product.name,
        product.scientific_name,
        product.category,
        product.country,
        product.size,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [products, search, categoryFilter, statusFilter]);

  const hasFilters =
    search.trim().length > 0 ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  return (
    <div className="space-y-6">
      <PageActions>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Import Excel
        </button>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Product
        </button>
      </PageActions>

      <ProductFormModal
        key={editing?.id ?? "create"}
        existingId={editing?.id}
        initialValues={editing ? { ...emptyProductForm(), ...editing } : undefined}
        open={formOpen || Boolean(editing)}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          if (searchParams.get("new") === "1") router.replace("/products");
        }}
        onSaved={() => {
          router.refresh();
          setToast("Product saved successfully.");
          if (searchParams.get("new") === "1") router.replace("/products");
        }}
      />

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}

      <ProductImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          router.refresh();
          setToast(
            `${count} product${count === 1 ? "" : "s"} imported successfully.`
          );
        }}
      />

      {error ? (
        <ErrorCard message={error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Products"
              value={String(stats?.total ?? 0)}
              icon={<Package className="h-4 w-4" />}
            />
            <KpiCard
              title="Active"
              value={String(stats?.active ?? 0)}
              icon={<ToggleLeft className="h-4 w-4" />}
            />
            <KpiCard
              title="Inactive"
              value={String(stats?.inactive ?? 0)}
              icon={<ToggleLeft className="h-4 w-4" />}
            />
            <KpiCard
              title="Categories"
              value={String(stats?.categories ?? 0)}
              icon={<Layers className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by SKU, name, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState filtered={hasFilters && (products?.length ?? 0) > 0} />
          ) : (
            <TableShell rowCount={filteredProducts.length}>
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Photo
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Product
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Scientific Name
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Country
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Size
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Purchase Price
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Sale Price
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => router.push(`/products/${product.id}`)}
                      className="cursor-pointer transition-colors hover:bg-accent/20"
                    >
                      <td className="px-4 py-3">
                        <ProductPhoto
                          name={product.name}
                          imageUrl={product.image_url}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {product.sku}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground italic">
                        {product.scientific_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {product.category ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                            <Tag className="h-3 w-3" />
                            {product.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.country ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.size ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPrice(product.purchase_price, product.currency)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {formatPrice(product.sale_price, product.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={product.is_active} />
                        <button type="button" className="ml-3 text-xs underline" onClick={event => { event.stopPropagation(); setEditing(product); }}>Edit</button>
                        <button type="button" className="ml-3 text-xs underline" onClick={event => { event.stopPropagation(); void setProductActive(product.id, !product.is_active).then(result => { setToast(result.success ? "Status updated." : result.error); if (result.success) router.refresh(); }); }}>{product.is_active ? "Archive" : "Restore"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </>
      )}
    </div>
  );
}
