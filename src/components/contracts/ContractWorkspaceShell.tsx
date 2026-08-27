"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Contract } from "@/lib/contracts/db";
import {
  CONTRACT_WORKSPACE_TABS,
  getActiveContractTab,
  getContractTabHref,
} from "@/lib/contracts/workspace";

type ContractWorkspaceShellProps = {
  contract: Contract;
  children: React.ReactNode;
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Draft";

  const className =
    label === "Draft"
      ? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
      : label === "Closed"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : label === "Cancelled"
          ? "bg-red-500/10 text-red-400 ring-red-500/20"
          : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

function EntityLink({
  href,
  label,
}: {
  href: string | null | undefined;
  label: string | null | undefined;
}) {
  if (!href || !label) {
    return <span>No party</span>;
  }

  return (
    <Link
      href={href}
      className="text-foreground underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}

export function ContractWorkspaceShell({
  contract,
  children,
}: ContractWorkspaceShellProps) {
  const pathname = usePathname();
  const activeTab = getActiveContractTab(pathname);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link
          href="/contracts"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Contracts
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-xs text-foreground">
          {contract.contract_number}
        </span>
        {activeTab !== "overview" ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">
              {CONTRACT_WORKSPACE_TABS.find((tab) => tab.id === activeTab)?.label}
            </span>
          </>
        ) : null}
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contract
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-lg font-semibold tracking-tight text-foreground">
              {contract.contract_number}
            </h2>
            <StatusBadge status={contract.status} />
          </div>
          {contract.title ? (
            <p className="mt-1 text-sm text-foreground">{contract.title}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            <EntityLink
              href={
                contract.company?.id
                  ? `/companies/${contract.company.id}`
                  : null
              }
              label={contract.company?.name}
            />
            {" · "}
            Buyer:{" "}
            <EntityLink
              href={
                contract.buyer?.id
                  ? `/counterparties/${contract.buyer.id}`
                  : null
              }
              label={contract.buyer?.legal_name}
            />
            {" · "}
            Supplier:{" "}
            <EntityLink
              href={
                contract.supplier?.id
                  ? `/counterparties/${contract.supplier.id}`
                  : null
              }
              label={contract.supplier?.legal_name}
            />
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-1">
          {CONTRACT_WORKSPACE_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const href = getContractTabHref(contract.id, tab);

            return (
              <Link
                key={tab.id}
                href={href}
                className={[
                  "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
