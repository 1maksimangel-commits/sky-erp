import { ContractOverviewEditor } from "@/components/contracts/ContractOverviewEditor";
import { getActiveCompanies } from "@/lib/companies";
import { getContractById } from "@/lib/contracts/db";
import { getActiveCounterparties } from "@/lib/counterparties";
import { getProducts } from "@/lib/products";
import { can } from "@/lib/platform/permissions";
import { getContractOriginals } from "@/lib/contracts/import/actions";

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
  const [products, canEdit, originals] = await Promise.all([getProducts(), can("contracts.write", contract.company_id), getContractOriginals(id)]);

  return (
    <>
    {originals.error ? <p role="alert">{originals.error}</p> : originals.data.map(source => <a key={source.id} href={source.url} className="block text-sm underline" target="_blank" rel="noreferrer">Original Contract source: {source.file_name}</a>)}
    <ContractOverviewEditor
      products={products.data ?? []}
      canEdit={canEdit}
      contract={contract}
      companies={companies ?? []}
      counterparties={counterparties ?? []}
    />
    </>
  );
}
