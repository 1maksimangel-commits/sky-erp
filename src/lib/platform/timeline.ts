"use server";

import { createClient } from "@/lib/supabase/server";
import { logSupabaseError, serializeUnknownError } from "@/lib/platform/supabase-errors";
import type { EntityType } from "@/lib/platform/types";

export async function addTimelineEvent(input: {
  entityType: EntityType | string;
  entityId: string;
  eventType: string;
  title: string;
  description?: string | null;
  eventDate?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_timeline_event", {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_event_type: input.eventType,
      p_title: input.title,
      p_description: input.description ?? null,
      p_event_date: input.eventDate ?? new Date().toISOString(),
      p_related_entity_type: input.relatedEntityType ?? null,
      p_related_entity_id: input.relatedEntityId ?? null,
    });

    if (error) {
      logSupabaseError("timeline.addTimelineEvent", error);
    }

    return { error: error?.message ?? null };
  } catch (error) {
    logSupabaseError("timeline.addTimelineEvent.throw", error);
    return { error: serializeUnknownError(error).message };
  }
}
