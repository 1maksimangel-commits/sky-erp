import { listDocumentTemplates } from "@/lib/document-templates/actions";
import { getBusinessCases } from "@/lib/business-cases";
import { DocumentGenerationView } from "@/components/documents/DocumentGenerationView";

export const dynamic = "force-dynamic";

export default async function GenerateDocumentsPage() {
  const [templates, deals] = await Promise.all([listDocumentTemplates(), getBusinessCases()]);
  return <DocumentGenerationView templates={templates.data} deals={deals.data ?? []} />;
}
