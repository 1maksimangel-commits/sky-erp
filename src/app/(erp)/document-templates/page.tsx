import { DocumentTemplatesView } from "@/components/document-templates/DocumentTemplatesView";
import { listDocumentTemplates } from "@/lib/document-templates/actions";
import { getCompanies } from "@/lib/companies";

export const dynamic = "force-dynamic";

export default async function DocumentTemplatesPage() {
  const [result, companies] = await Promise.all([listDocumentTemplates(), getCompanies()]);
  return <DocumentTemplatesView templates={result.data} companies={companies.data ?? []} error={result.error ?? companies.error} />;
}
