"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError, serializeUnknownError } from "@/lib/platform/supabase-errors";

export async function createNotification(input: {
  title: string;
  body?: string | null;
  category?: string;
  severity?: string;
  entityType?: string | null;
  entityId?: string | null;
  href?: string | null;
}): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_notification", {
      p_title: input.title,
      p_body: input.body ?? null,
      p_category: input.category ?? "general",
      p_severity: input.severity ?? "info",
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_href: input.href ?? null,
    });

    if (error) {
      logSupabaseError("notifications.createNotification", error);
    }

    return { error: error?.message ?? null };
  } catch (error) {
    logSupabaseError("notifications.createNotification.throw", error);
    return { error: serializeUnknownError(error).message };
  }
}

export async function markNotificationRead(
  id: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      logSupabaseError("notifications.markNotificationRead", error);
      return { error: error.message };
    }

    revalidatePath("/");
    return { error: null };
  } catch (error) {
    logSupabaseError("notifications.markNotificationRead.throw", error);
    return { error: serializeUnknownError(error).message };
  }
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (error) {
      logSupabaseError("notifications.markAllNotificationsRead", error);
    }

    return { error: error?.message ?? null };
  } catch (error) {
    logSupabaseError("notifications.markAllNotificationsRead.throw", error);
    return { error: serializeUnknownError(error).message };
  }
}
