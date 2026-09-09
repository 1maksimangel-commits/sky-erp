import { notFound, redirect } from "next/navigation";
import { ContractImportPageClient } from "@/components/contracts/import/ContractImportPageClient";
import { getContractImport } from "@/lib/contracts/import/actions";
import { getActiveCompanies } from "@/lib/companies";
import { getCounterparties } from "@/lib/counterparties";
import { getProducts } from "@/lib/products";
import { getBusinessCases } from "@/lib/business-cases";

export default async function ContractImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getContractImport(id);
  if (!result.success) notFound();
  if (result.data.importRecord.created_contract_id) redirect("/contracts/" + result.data.importRecord.created_contract_id);
  const [companies, counterparties, products, deals] = await Promise.all([getActiveCompanies(),getCounterparties(),getProducts(),getBusinessCases()]);
  const error = companies.error || counterparties.error || products.error || deals.error;
  if (error) return <p role="alert">{error}</p>;
  return <ContractImportPageClient {...result.data} companies={companies.data ?? []} counterparties={counterparties.data ?? []} products={products.data ?? []} businessCases={deals.data ?? []} />;
}
