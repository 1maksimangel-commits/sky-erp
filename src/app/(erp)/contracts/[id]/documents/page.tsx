import { EntityDocumentsPanel } from "@/components/documents/EntityDocumentsPanel";
import { getContractById } from "@/lib/contracts/db";
import {
  getDocumentSignedUrls,
  getEntityDocuments,
} from "@/lib/documents/db";

export default async function ContractDocumentsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract } = await getContractById(id);

  if (!contract) {
    return null;
  }

  const documentsResult = await getEntityDocuments("contract", id);
  const preview = await getDocumentSignedUrls(documentsResult.data);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload contracts, certificates, and supporting files. They also appear
          in the global Documents library.
        </p>
      </div>

      {documentsResult.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {documentsResult.error}
        </div>
      ) : null}

      <EntityDocumentsPanel
        entityType="contract"
        entityId={id}
        documents={documentsResult.data}
        urls={preview.urls}
        contractId={id}
        businessCaseId={contract.business_case_id}
        companyId={contract.company?.id}
      />
    </div>
  );
}
