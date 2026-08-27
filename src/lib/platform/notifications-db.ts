import { createClient } from "@/lib/supabase/server";
import {
  isNextDynamicServerError,
  logSupabaseError,
  serializeUnknownError,
} from "@/lib/platform/supabase-errors";

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  severity: string;
  entity_type: string | null;
  entity_id: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(limit = 20): Promise<{
  data: AppNotification[];
  unreadCount: number;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, title, body, category, severity, entity_type, entity_id, href, is_read, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logSupabaseError("notifications.getNotifications", error);
      if (
        /notifications|schema cache|PGRST205|does not exist/i.test(error.message)
      ) {
        return { data: [], unreadCount: 0, error: null };
      }
      return { data: [], unreadCount: 0, error: error.message };
    }

    const rows = (data ?? []) as AppNotification[];
    return {
      data: rows,
      unreadCount: rows.filter((item) => !item.is_read).length,
      error: null,
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    logSupabaseError("notifications.getNotifications.throw", error);
    return {
      data: [],
      unreadCount: 0,
      error: serializeUnknownError(error).message,
    };
  }
}
