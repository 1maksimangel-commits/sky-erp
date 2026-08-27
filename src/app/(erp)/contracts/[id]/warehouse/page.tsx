import { ContractWarehouseTab } from "@/components/contracts/ContractWarehouseTab";
import { getContractById } from "@/lib/contracts/db";
import { getContractProducts } from "@/lib/contracts/warehouse";

export default async function ContractWarehousePage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract } = await getContractById(id);

  if (!contract) {
    return null;
  }

  const { data, error } = await getContractProducts(contract.id);

  return <ContractWarehouseTab lines={data} error={error} />;
}
