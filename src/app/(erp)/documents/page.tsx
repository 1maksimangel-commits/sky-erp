import { DocumentsLibraryView } from "@/components/documents/DocumentsLibraryView";
import {
  DOCUMENTS_DMS_MIGRATION,
  getDocumentLibraryStats,
  getDocumentSignedUrls,
  listDocuments,
} from "@/lib/documents/db";
import type { DocumentLibraryStats, ErpDocument } from "@/lib/documents/types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { serializeUnknownError } from "@/lib/platform/supabase-errors";

type DocumentsPageData = {
  documents: ErpDocument[];
  urls: Record<string, string>;
  stats?: DocumentLibraryStats;
  error: string | null;
  schemaWarning?: string | null;
  diagnostic?: unknown;
  requestHint: string;
};

export default async function DocumentsPage() {
  let pageData: DocumentsPageData;

  try {
    const env = getSupabasePublicEnv();
    if (!env.ok) {
      pageData = {
        documents: [],
        urls: {},
        error: env.error,
        requestHint:
          "createClient() — NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      };
    } else {
      const result = await listDocuments({ limit: 300 });
      const preview = result.data.length
        ? await getDocumentSignedUrls(result.data)
        : { urls: {}, error: null };
      const stats = await getDocumentLibraryStats(result.data);

      pageData = {
        documents: result.data,
        urls: preview.urls,
        stats,
        error: result.error ?? preview.error,
        schemaWarning: result.schemaWarning,
        diagnostic: result.diagnostic,
        requestHint: `GET ${env.env.url}/rest/v1/documents (compat select; full DMS requires ${DOCUMENTS_DMS_MIGRATION})`,
      };
    }
  } catch (error) {
    const diagnostic = serializeUnknownError(error);
    pageData = {
      documents: [],
      urls: {},
      error: diagnostic.message,
      diagnostic,
      schemaWarning: `If columns like file_path are missing, apply ${DOCUMENTS_DMS_MIGRATION} in the Supabase SQL Editor.`,
      requestHint: "documents page catch — recoverable render",
    };
  }

  return (
    <DocumentsLibraryView
      documents={pageData.documents}
      urls={pageData.urls}
      stats={pageData.stats}
      error={pageData.error}
      schemaWarning={pageData.schemaWarning}
      diagnostic={pageData.diagnostic}
      requestHint={pageData.requestHint}
    />
  );
}
