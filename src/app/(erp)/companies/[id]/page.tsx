import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { getCompanyById } from "@/lib/companies";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";

export default async function CompanyDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: company, error }, bundle] = await Promise.all([
    getCompanyById(id),
    getEntityWorkspaceBundle("company", id),
  ]);

  if (error || !company) {
    notFound();
  }

  return (
    <EntityWorkspace
      entityType="company"
      entityId={id}
      title={company.name}
      subtitle={company.code}
      status={company.is_active ? "Active" : "Inactive"}
      breadcrumbHref="/companies"
      breadcrumbLabel="Companies"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      companyId={id}
      overview={
        <DetailGrid>
          <DetailItem label="Name" value={company.name} />
          <DetailItem label="Code" value={company.code} />
          <DetailItem label="Short Name" value={company.short_name} />
          <DetailItem label="Country" value={company.country} />
          <DetailItem label="City" value={company.city} />
          <DetailItem label="Address" value={company.address} />
          <DetailItem label="Authorized signer" value={company.authorized_signer_name} />
          <DetailItem label="Signer position" value={company.authorized_signer_title} />
          <DetailItem
            label="Status"
            value={company.is_active ? "Active" : "Inactive"}
          />
        </DetailGrid>
      }
    />
  );
}
