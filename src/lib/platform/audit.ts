"use server";

import { logActivity } from "@/lib/platform/activity";
import { createNotification } from "@/lib/platform/notifications";
import { addTimelineEvent } from "@/lib/platform/timeline";
import type { EntityType } from "@/lib/platform/types";

type AuditInput = {
  entityType: EntityType | string;
  entityId: string;
  action: string;
  summary: string;
  title?: string;
  eventType?: string;
  description?: string | null;
  eventDate?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  notify?: {
    title: string;
    body?: string | null;
    category?: string;
    severity?: string;
    href?: string | null;
  } | null;
  fanout?: Array<{
    entityType: EntityType | string;
    entityId: string;
    title?: string;
    eventType?: string;
  }>;
};

/** Best-effort timeline + activity (+ optional notification). Never throws. */
export async function recordEntityEvent(input: AuditInput): Promise<void> {
  const title = input.title ?? input.summary;
  const eventType = input.eventType ?? input.action;

  await Promise.allSettled([
    addTimelineEvent({
      entityType: input.entityType,
      entityId: input.entityId,
      eventType,
      title,
      description: input.description ?? input.summary,
      eventDate: input.eventDate,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    }),
    logActivity({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      oldValue: input.oldValue,
      newValue: input.newValue,
    }),
    input.notify
      ? createNotification({
          title: input.notify.title,
          body: input.notify.body ?? input.summary,
          category: input.notify.category ?? input.entityType,
          severity: input.notify.severity ?? "info",
          entityType: input.entityType,
          entityId: input.entityId,
          href: input.notify.href ?? null,
        })
      : Promise.resolve({ error: null }),
    ...(input.fanout ?? []).map((target) =>
      addTimelineEvent({
        entityType: target.entityType,
        entityId: target.entityId,
        eventType: target.eventType ?? eventType,
        title: target.title ?? title,
        description: input.description ?? input.summary,
        eventDate: input.eventDate,
        relatedEntityType: input.entityType,
        relatedEntityId: input.entityId,
      })
    ),
  ]);
}
