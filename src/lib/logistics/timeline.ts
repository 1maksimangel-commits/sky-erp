import { createClient } from "@/lib/supabase/server";

export type ShipmentTimelineEvent = {
  id: string;
  shipment_id: string;
  title: string;
  description: string | null;
  event_date: string;
  created_at: string | null;
};

export type TimelineResult =
  | { data: ShipmentTimelineEvent[]; error: null }
  | { data: null; error: string };

export async function getShipmentTimeline(
  shipmentId: string
): Promise<TimelineResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shipment_timeline_events")
    .select("id, shipment_id, title, description, event_date, created_at")
    .eq("shipment_id", shipmentId)
    .order("event_date", { ascending: false });

  if (error) {
    if (
      /shipment_timeline_events|schema cache|does not exist|PGRST205/i.test(
        error.message
      )
    ) {
      return {
        data: null,
        error:
          "Logistics schema is incomplete. Apply supabase/migrations/20260804160000_shipments_logistics_columns.sql in the Supabase SQL Editor.",
      };
    }

    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as ShipmentTimelineEvent[], error: null };
}

export async function insertTimelineEvent(
  shipmentId: string,
  title: string,
  description?: string | null,
  eventDate?: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("shipment_timeline_events").insert({
    shipment_id: shipmentId,
    title,
    description: description?.trim() || null,
    event_date: eventDate ?? new Date().toISOString(),
  });

  return { error: error?.message ?? null };
}
