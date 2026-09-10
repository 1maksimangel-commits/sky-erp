"use client";

import { AlertCircle, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { createBusinessCaseForContract } from "@/lib/contracts/hub-actions";
import type { Contract } from "@/lib/contracts/db";
import type { LinkedBusinessCase } from "@/lib/contracts/relations";
import { formatContractAmount } from "@/lib/contracts/format";

type ContractBusinessCaseTabProps = {
  contract: Contract;
  businessCase: LinkedBusinessCase | null;
  loadError: string | null;
};

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-accent/10 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

export function ContractBusinessCaseTab({
  contract,
  businessCase,
  loadError,
}: ContractBusinessCaseTabProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);

    if (!contract.company?.id) {
      setCreating(false);
      setError("Set a company on the contract before creating a business case.");
      return;
    }

    const caseNumber = `${contract.contract_number}-BC`;

    const result = await createBusinessCaseForContract(contract.id, {
      case_number: caseNumber,
      case_type: "Trade",
      title: contract.title,
      company_id: contract.company.id,
      buyer_id: contract.buyer?.id ?? null,
      supplier_id: contract.supplier?.id ?? null,
      consignee_id: null,
      status: "Draft",
      contract_number: contract.contract_number,
      contract_date: contract.contract_date,
      currency: contract.currency ?? "USD",
      contract_amount: contract.amount,
      incoterms: contract.incoterms,
    });

    setCreating(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setToast("Business case created and linked to this contract.");
    router.refresh();
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!businessCase) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Business Case</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No business case is linked to this contract yet. Creating one stamps
            contracts.business_case_id so logistics and finance can inherit it.
          </p>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Create Business Case
        </button>

        {toast ? (
          <Toast message={toast} onClose={() => setToast(null)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Business Case</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Linked to this Contract through its canonical Deal reference.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/business-cases/${businessCase.id}`}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Open business case
          </Link>
          <Link
            href="/finance/reports"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Finance reports
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem
          label="Business Case Number"
          value={
            <Link
              href={`/business-cases/${businessCase.id}`}
              className="font-mono underline-offset-4 hover:underline"
            >
              {businessCase.case_number}
            </Link>
          }
        />
        <DetailItem label="Deal Stage" value={businessCase.status ?? "—"} />
        <DetailItem label="Type" value={businessCase.case_type ?? "—"} />
        <DetailItem
          label="Contract Amount"
          value={formatContractAmount(
            businessCase.contract_amount,
            businessCase.currency
          )}
        />
      </div>

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
