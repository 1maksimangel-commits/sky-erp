import { createClient } from "@/lib/supabase/server";
import {
  logSupabaseError,
  serializeUnknownError,
} from "@/lib/platform/supabase-errors";
import type { EntityType } from "@/lib/platform/types";

export type TimelineEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string | null;
};

export async function getEntityTimeline(
  entityType: EntityType | string,
  entityId: string
): Promise<{ data: TimelineEvent[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("timeline_events")
      .select(
        "id, entity_type, entity_id, event_type, title, description, event_date, related_entity_type, related_entity_id, created_at"
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("event_date", { ascending: false })
      .limit(100);

    if (error) {
      logSupabaseError("timeline.getEntityTimeline", error);
      if (
        /timeline_events|schema cache|PGRST205|does not exist/i.test(error.message)
      ) {
        return { data: [], error: null };
      }
      return { data: [], error: error.message };
    }

    return { data: (data ?? []) as TimelineEvent[], error: null };
  } catch (error) {
    logSupabaseError("timeline.getEntityTimeline.throw", error);
    return { data: [], error: serializeUnknownError(error).message };
  }
}
