import { ContractBusinessCaseTab } from "@/components/contracts/ContractBusinessCaseTab";
import { getContractById } from "@/lib/contracts/db";
import { getBusinessCaseForContract } from "@/lib/contracts/relations";

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

  return (
    <ContractBusinessCaseTab
      contract={contract}
      businessCase={businessCase}
      loadError={error}
    />
  );
}
