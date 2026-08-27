"use server";

import { createClient } from "@/lib/supabase/server";
import { logSupabaseError, serializeUnknownError } from "@/lib/platform/supabase-errors";
import type { EntityType } from "@/lib/platform/types";

export async function logActivity(input: {
  entityType: EntityType | string;
  entityId: string;
  action: string;
  summary: string;
  actor?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_activity", {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_action: input.action,
      p_summary: input.summary,
      p_actor: input.actor ?? "system",
      p_old_value: input.oldValue ?? null,
      p_new_value: input.newValue ?? null,
      p_metadata: input.metadata ?? null,
    });

    if (error) {
      logSupabaseError("activity.logActivity", error);
    }

    return { error: error?.message ?? null };
  } catch (error) {
    logSupabaseError("activity.logActivity.throw", error);
    return { error: serializeUnknownError(error).message };
  }
}
