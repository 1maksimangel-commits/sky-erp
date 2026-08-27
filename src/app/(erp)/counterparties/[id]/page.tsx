import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { getCounterpartyById } from "@/lib/counterparties";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";

export default async function CounterpartyDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: counterparty, error }, bundle] = await Promise.all([
    getCounterpartyById(id),
    getEntityWorkspaceBundle("counterparty", id),
  ]);

  if (error || !counterparty) {
    notFound();
  }

  return (
    <EntityWorkspace
      entityType="counterparty"
      entityId={id}
      title={counterparty.legal_name}
      subtitle={counterparty.code}
      status={counterparty.is_active ? "Active" : "Inactive"}
      breadcrumbHref="/counterparties"
      breadcrumbLabel="Counterparties"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      counterpartyId={id}
      overview={
        <DetailGrid>
          <DetailItem label="Legal Name" value={counterparty.legal_name} />
          <DetailItem label="Code" value={counterparty.code} />
          <DetailItem label="Short Name" value={counterparty.short_name} />
          <DetailItem label="Type" value={counterparty.counterparty_type} />
          <DetailItem label="Country" value={counterparty.country} />
          <DetailItem label="City" value={counterparty.city} />
          <DetailItem label="Address" value={counterparty.address} />
          <DetailItem label="Tax ID" value={counterparty.tax_id} />
          <DetailItem label="Email" value={counterparty.email} />
          <DetailItem label="Phone" value={counterparty.phone} />
        </DetailGrid>
      }
    />
  );
}
