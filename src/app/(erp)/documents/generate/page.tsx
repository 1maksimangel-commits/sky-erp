import { listDocumentTemplates } from "@/lib/document-templates/actions";
import { getBusinessCases } from "@/lib/business-cases";
import { DocumentGenerationView } from "@/components/documents/DocumentGenerationView";
import { getContracts } from "@/lib/contracts/db";
import { getCompanies } from "@/lib/companies";
import { listGeneratedDocuments } from "@/lib/documents/generation-actions";

export const dynamic = "force-dynamic";

export default async function GenerateDocumentsPage({ searchParams }: { searchParams: Promise<{ contractId?: string | string[] }> }) {
  const [templates, deals, contracts, companies] = await Promise.all([listDocumentTemplates(), getBusinessCases(), getContracts(), getCompanies()]);
  const params = await searchParams;
  const requestedId = typeof params.contractId === "string" ? params.contractId : "";
  const initialContractId = contracts.data?.find((contract) => contract.id === requestedId)?.id ?? "";
  const history = initialContractId ? await listGeneratedDocuments(initialContractId) : { data: [], error: null };
  return <DocumentGenerationView key={initialContractId} templates={templates.data} deals={deals.data ?? []} contracts={contracts.data ?? []} companies={companies.data ?? []} initialContractId={initialContractId} initialHistory={history.data ?? []} error={templates.error ?? deals.error ?? contracts.error ?? companies.error ?? history.error ?? (requestedId && !initialContractId ? "The selected Contract is unavailable." : null)} />;
}
