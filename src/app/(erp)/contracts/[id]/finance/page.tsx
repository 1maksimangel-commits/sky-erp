import { ContractFinanceTab } from "@/components/contracts/ContractFinanceTab";
import { getContractById } from "@/lib/contracts/db";
import { getContractFinance } from "@/lib/contracts/finance";

export default async function ContractFinancePage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract } = await getContractById(id);

  if (!contract) {
    return null;
  }

  const finance = await getContractFinance(
    contract.id,
    contract.contract_number,
    contract.amount,
    contract.currency
  );

  const hasBusinessCase = Boolean(contract.business_case_id);

  if (finance.error || !finance.summary) {
    return (
      <ContractFinanceTab
        contractId={contract.id}
        contractNumber={contract.contract_number}
        hasBusinessCase={hasBusinessCase}
        summary={{
          contractAmount: contract.amount ?? 0,
          paid: 0,
          remaining: contract.amount ?? 0,
          currency: contract.currency ?? "USD",
          invoiceCount: 0,
          paymentCount: 0,
          outstanding: contract.amount ?? 0,
        }}
        invoices={[]}
        payments={[]}
        error={finance.error}
      />
    );
  }

  return (
    <ContractFinanceTab
      contractId={contract.id}
      contractNumber={contract.contract_number}
      hasBusinessCase={hasBusinessCase}
      summary={finance.summary}
      invoices={finance.invoices}
      payments={finance.payments}
      error={null}
    />
  );
}
