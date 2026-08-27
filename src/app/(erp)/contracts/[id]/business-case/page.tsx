import { ContractBusinessCaseTab } from "@/components/contracts/ContractBusinessCaseTab";
import { getContractById } from "@/lib/contracts/db";
import { getBusinessCaseForContract } from "@/lib/contracts/relations";
import { getBusinessCaseProfitResult } from "@/lib/finance/db";

export default async function ContractBusinessCasePage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract } = await getContractById(id);

  if (!contract) {
    return null;
  }

  const { data: businessCase, error } = await getBusinessCaseForContract({
    contractId: contract.id,
    contractNumber: contract.contract_number,
  });

  const profit = businessCase
    ? await getBusinessCaseProfitResult(businessCase.id)
    : { data: null, error: null };

  return (
    <ContractBusinessCaseTab
      contract={contract}
      businessCase={businessCase}
      profit={profit.data}
      loadError={error ?? profit.error}
    />
  );
}
