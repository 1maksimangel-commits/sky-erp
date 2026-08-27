import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { formatShipmentDate } from "@/lib/logistics/format";
import { getShipmentById } from "@/lib/logistics/db";
import { getShipmentTimeline } from "@/lib/logistics/timeline";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";
import type { TimelineEvent } from "@/lib/platform/timeline-db";

export default async function ShipmentDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;

  const [{ data: shipment, error }, shipmentTimeline, bundle] =
    await Promise.all([
      getShipmentById(id),
      getShipmentTimeline(id),
      getEntityWorkspaceBundle("shipment", id),
    ]);

  if (error || !shipment) {
    notFound();
  }

  const mergedTimeline: TimelineEvent[] = [
    ...bundle.timeline,
    ...((shipmentTimeline.data ?? []).map((event) => ({
      id: event.id,
      entity_type: "shipment",
      entity_id: id,
      event_type: "shipment",
      title: event.title,
      description: event.description,
      event_date: event.event_date,
      related_entity_type: null,
      related_entity_id: null,
      created_at: event.created_at,
    })) as TimelineEvent[]),
  ].sort(
    (a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  return (
    <EntityWorkspace
      entityType="shipment"
      entityId={id}
      title={
        shipment.container ||
        shipment.vessel ||
        shipment.contract?.contract_number ||
        "Shipment"
      }
      subtitle={`${shipment.port_of_loading ?? "—"} → ${shipment.port_of_destination ?? "—"}`}
      status={shipment.status}
      breadcrumbHref="/logistics"
      breadcrumbLabel="Logistics"
      timeline={mergedTimeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      shipmentId={id}
      contractId={shipment.contract?.id ?? null}
      businessCaseId={shipment.business_case?.id ?? null}
      overview={
        <DetailGrid>
          <DetailItem
            label="Company"
            value={
              shipment.company ? (
                <Link
                  href={`/companies/${shipment.company.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {shipment.company.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailItem
            label="Contract"
            value={
              shipment.contract ? (
                <Link
                  href={`/contracts/${shipment.contract.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {shipment.contract.contract_number}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailItem
            label="Business Case"
            value={
              shipment.business_case ? (
                <Link
                  href={`/business-cases/${shipment.business_case.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {shipment.business_case.case_number}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailItem label="Container" value={shipment.container} />
          <DetailItem label="Bill of Lading" value={shipment.bl_number} />
          <DetailItem label="Vessel" value={shipment.vessel} />
          <DetailItem label="Voyage" value={shipment.voyage} />
          <DetailItem label="Shipping Line" value={shipment.shipping_line} />
          <DetailItem label="Tracking" value={shipment.tracking_number} />
          <DetailItem label="Booking" value={shipment.booking_number} />
          <DetailItem label="POL" value={shipment.port_of_loading} />
          <DetailItem label="POD" value={shipment.port_of_destination} />
          <DetailItem label="Consignee" value={shipment.consignee} />
          <DetailItem label="Notify Party" value={shipment.notify_party} />
          <DetailItem label="ETD" value={formatShipmentDate(shipment.etd)} />
          <DetailItem label="ETA" value={formatShipmentDate(shipment.eta)} />
          <DetailItem label="ATD" value={formatShipmentDate(shipment.atd)} />
          <DetailItem label="ATA" value={formatShipmentDate(shipment.ata)} />
          <DetailItem label="Status" value={shipment.status} />
          <DetailItem label="Remarks" value={shipment.remarks} />
        </DetailGrid>
      }
    />
  );
}
