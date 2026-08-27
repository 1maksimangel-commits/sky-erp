"use client";

import {
  Building2,
  FileSignature,
  FileText,
  Loader2,
  Package,
  Search,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useShell } from "@/components/layout/ShellContext";
import { globalSearch, type SearchResult } from "@/lib/platform/search";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Company: Building2,
  Counterparty: Users,
  Product: Package,
  Contract: FileSignature,
  Invoice: Wallet,
  Shipment: Truck,
  Document: FileText,
};

const SCOPES = [
  "Companies",
  "Counterparties",
  "Products",
  "Contracts",
  "Invoices",
  "Shipments",
  "Documents",
] as const;

export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen } = useShell();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [wasCommandOpen, setWasCommandOpen] = useState(commandOpen);
  if (commandOpen !== wasCommandOpen) {
    setWasCommandOpen(commandOpen);
    if (!commandOpen) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen]);

  useEffect(() => {
    if (!commandOpen) return;
    if (query.trim().length < 2) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data } = await globalSearch(query);
      const allowed = new Set([
        "Company",
        "Counterparty",
        "Product",
        "Contract",
        "Invoice",
        "Shipment",
        "Document",
      ]);
      setResults(data.filter((item) => allowed.has(item.type)));
      setActiveIndex(0);
      setSearching(false);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [commandOpen, query]);

  const activeResults = useMemo(
    () => (query.trim().length < 2 ? [] : results),
    [query, results]
  );
  const isSearching = query.trim().length >= 2 && searching;

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const item of activeResults) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return map;
  }, [activeResults]);

  function go(href: string) {
    setCommandOpen(false);
    router.push(href);
  }

  if (!commandOpen) return null;

  const flat = activeResults;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setCommandOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((value) =>
                  Math.min(flat.length - 1, value + 1)
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((value) => Math.max(0, value - 1));
              }
              if (event.key === "Enter" && flat[activeIndex]) {
                event.preventDefault();
                go(flat[activeIndex].href);
              }
            }}
            placeholder="Search companies, contracts, invoices…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        <div className="border-b border-border px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {SCOPES.map((scope) => (
              <span
                key={scope}
                className="rounded-full border border-border bg-accent/40 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters. Press{" "}
              <span className="text-foreground">⌘K</span> anytime.
            </p>
          ) : isSearching ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching workspace…
            </div>
          ) : flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches across ERP entities.
            </p>
          ) : (
            [...grouped.entries()].map(([type, items]) => {
              const Icon = TYPE_ICON[type] ?? Search;
              return (
                <div key={type} className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {type}
                  </p>
                  {items.map((item) => {
                    const index = flat.findIndex(
                      (row) => row.id === item.id && row.type === item.type
                    );
                    const active = index === activeIndex;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(item.href)}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          active ? "bg-accent text-foreground" : "hover:bg-accent/50"
                        }`}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">
                            {item.title}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
