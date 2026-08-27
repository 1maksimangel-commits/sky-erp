"use client";

import { AlertCircle, ChevronLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShipmentDeleteDialog } from "@/components/logistics/ShipmentDeleteDialog";
import { ShipmentFormModal } from "@/components/logistics/ShipmentFormModal";
import { Toast } from "@/components/ui/Toast";
import { addShipmentTimelineEvent } from "@/lib/logistics/actions";
import type {
  BusinessCaseOption,
  ContractOption,
  Shipment,
} from "@/lib/logistics/db";
import { formatShipmentDate, formatShipmentDateTime } from "@/lib/logistics/format";
import type { ShipmentTimelineEvent } from "@/lib/logistics/timeline";

type ShipmentDetailViewProps = {
  shipment: Shipment;
  timeline: ShipmentTimelineEvent[];
  timelineError: string | null;
  contracts: ContractOption[];
  businessCases: BusinessCaseOption[];
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Planned";

  const className =
    label === "Planned"
      ? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
      : label === "In Transit"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : label === "Delivered"
          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
          : label === "Delayed"
            ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
            : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-accent/10 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

export function ShipmentDetailView({
  shipment,
  timeline,
  timelineError,
  contracts,
  businessCases,
}: ShipmentDetailViewProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const headerLabel =
    shipment.container || shipment.vessel || shipment.contract?.contract_number;

  async function handleAddTimelineEvent(event: React.FormEvent) {
    event.preventDefault();
    setAddingEvent(true);
    setEventError(null);

    const result = await addShipmentTimelineEvent(shipment.id, {
      title: eventTitle,
      description: eventDescription || null,
      event_date: eventDate ? new Date(eventDate).toISOString() : null,
    });

    setAddingEvent(false);

    if (!result.success) {
      setEventError(result.error);
      return;
    }

    setEventTitle("");
    setEventDescription("");
    setEventDate("");
    setToast("Tracking event added.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/logistics"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to logistics
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-lg font-semibold tracking-tight text-foreground">
              {headerLabel ?? "Shipment"}
            </h2>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Shipment details and tracking timeline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-red-500/30 px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem
          label="Contract"
          value={
            shipment.contract ? (
              <Link
                href={`/contracts/${shipment.contract.id}`}
                className="font-mono underline-offset-4 hover:underline"
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
          value={shipment.business_case?.case_number ?? "—"}
        />
        <DetailItem label="Container Number" value={shipment.container ?? "—"} />
        <DetailItem label="Container Type" value={shipment.container_type ?? "—"} />
        <DetailItem label="Seal Number" value={shipment.seal_number ?? "—"} />
        <DetailItem label="Vessel" value={shipment.vessel ?? "—"} />
        <DetailItem label="Voyage" value={shipment.voyage ?? "—"} />
        <DetailItem label="Shipping Line" value={shipment.shipping_line ?? "—"} />
        <DetailItem
          label="Freight Forwarder"
          value={shipment.freight_forwarder ?? "—"}
        />
        <DetailItem label="Booking Number" value={shipment.booking_number ?? "—"} />
        <DetailItem
          label="Tracking Number"
          value={shipment.tracking_number ?? "—"}
        />
        <DetailItem label="Port of Loading" value={shipment.port_of_loading ?? "—"} />
        <DetailItem
          label="Port of Destination"
          value={shipment.port_of_destination ?? "—"}
        />
        <DetailItem label="ETD" value={formatShipmentDate(shipment.etd)} />
        <DetailItem label="ETA" value={formatShipmentDate(shipment.eta)} />
        <DetailItem
          label="ETD Actual"
          value={formatShipmentDate(shipment.etd_actual)}
        />
        <DetailItem
          label="ETA Actual"
          value={formatShipmentDate(shipment.eta_actual)}
        />
        <DetailItem label="ATD" value={formatShipmentDate(shipment.atd)} />
        <DetailItem label="ATA" value={formatShipmentDate(shipment.ata)} />
        <DetailItem
          label="Remarks"
          value={shipment.remarks ?? "—"}
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Tracking Timeline</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Milestones and status updates for this shipment
          </p>
        </div>

        {timelineError ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{timelineError}</p>
          </div>
        ) : null}

        <form
          onSubmit={handleAddTimelineEvent}
          className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <input
            required
            placeholder="Event title"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            placeholder="Description"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="datetime-local"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={addingEvent}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
          >
            {addingEvent ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add Event
          </button>
          {eventError ? (
            <p className="text-sm text-red-300 sm:col-span-2 xl:col-span-4">
              {eventError}
            </p>
          ) : null}
        </form>

        {!timeline.length ? (
          <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
            No tracking events yet.
          </div>
        ) : (
          <ol className="relative space-y-0 border-l border-border pl-6">
            {timeline.map((event) => (
              <li key={event.id} className="pb-6 last:pb-0">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-card" />
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {formatShipmentDateTime(event.event_date)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {event.title}
                  </p>
                  {event.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ShipmentFormModal
        open={formOpen}
        shipment={shipment}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          router.refresh();
          setToast("Shipment updated successfully.");
        }}
        contracts={contracts}
        businessCases={businessCases}
      />

      <ShipmentDeleteDialog
        open={deleteOpen}
        shipment={shipment}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          router.push("/logistics");
          setToast("Shipment deleted successfully.");
        }}
      />

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
