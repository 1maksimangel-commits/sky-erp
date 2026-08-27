import { createClient } from "@/lib/supabase/server";
import {
  logSupabaseError,
  serializeUnknownError,
} from "@/lib/platform/supabase-errors";
import type { EntityType } from "@/lib/platform/types";

export type ActivityEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  actor: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
};

export async function getEntityActivity(
  entityType: EntityType | string,
  entityId: string
): Promise<{ data: ActivityEntry[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select(
        "id, entity_type, entity_id, action, summary, actor, old_value, new_value, metadata, created_at"
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logSupabaseError("activity.getEntityActivity", error);
      if (/activity_log|schema cache|PGRST205|does not exist/i.test(error.message)) {
        return { data: [], error: null };
      }
      return { data: [], error: error.message };
    }

    return { data: (data ?? []) as ActivityEntry[], error: null };
  } catch (error) {
    logSupabaseError("activity.getEntityActivity.throw", error);
    return { data: [], error: serializeUnknownError(error).message };
  }
}
