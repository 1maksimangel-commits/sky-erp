import { ContractOverviewEditor } from "@/components/contracts/ContractOverviewEditor";
import { getActiveCompanies } from "@/lib/companies";
import { getContractById } from "@/lib/contracts/db";
import { getActiveCounterparties } from "@/lib/counterparties";

export default async function ContractOverviewPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: contract }, { data: companies }, { data: counterparties }] =
    await Promise.all([
      getContractById(id),
      getActiveCompanies(),
      getActiveCounterparties(),
    ]);

  if (!contract) {
    return null;
  }

  return (
    <ContractOverviewEditor
      contract={contract}
      companies={companies ?? []}
      counterparties={counterparties ?? []}
    />
  );
}
