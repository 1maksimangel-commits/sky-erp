import { ContractLogisticsTab } from "@/components/contracts/ContractLogisticsTab";
import { getContractById } from "@/lib/contracts/db";
import {
  getBusinessCaseOptions,
  getContractOptions,
  getShipmentsByContractId,
} from "@/lib/logistics/db";

export default async function ContractLogisticsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract } = await getContractById(id);

  if (!contract) {
    return null;
  }

  const [{ data, error }, contracts, businessCases] = await Promise.all([
    getShipmentsByContractId(contract.id),
    getContractOptions(),
    getBusinessCaseOptions(),
  ]);

  return (
    <ContractLogisticsTab
      contractId={contract.id}
      contractNumber={contract.contract_number}
      hasCompany={Boolean(contract.company?.id)}
      hasBusinessCase={Boolean(contract.business_case_id)}
      shipments={data}
      error={error}
      contracts={contracts}
      businessCases={businessCases}
    />
  );
}
