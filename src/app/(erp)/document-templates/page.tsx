import { DocumentTemplatesView } from "@/components/document-templates/DocumentTemplatesView";
import { listDocumentTemplates } from "@/lib/document-templates/actions";
import { getBusinessCases } from "@/lib/business-cases";

export const dynamic = "force-dynamic";

export default async function DocumentTemplatesPage() {
  const result = await listDocumentTemplates();
  const deals = await getBusinessCases();
  return <DocumentTemplatesView templates={result.data} deals={deals.data ?? []} error={result.error ?? deals.error} />;
}
