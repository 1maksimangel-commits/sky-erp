import {
  getDocumentSignedUrls,
  getEntityDocuments,
} from "@/lib/documents/db";
import { getEntityActivity } from "@/lib/platform/activity-db";
import { getLinkedRecords } from "@/lib/platform/linked";
import { getEntityTimeline } from "@/lib/platform/timeline-db";
import type { EntityType } from "@/lib/platform/types";

export async function getEntityWorkspaceBundle(
  entityType: EntityType,
  entityId: string
) {
  const [timeline, activity, documents, linked] = await Promise.all([
    getEntityTimeline(entityType, entityId),
    getEntityActivity(entityType, entityId),
    getEntityDocuments(entityType, entityId),
    getLinkedRecords(entityType, entityId),
  ]);

  const preview = await getDocumentSignedUrls(documents.data);

  return {
    timeline: timeline.data,
    activity: activity.data,
    documents: documents.data,
    documentUrls: preview.urls,
    linked: linked.data,
    error:
      timeline.error ||
      activity.error ||
      documents.error ||
      linked.error ||
      preview.error ||
      null,
  };
}
