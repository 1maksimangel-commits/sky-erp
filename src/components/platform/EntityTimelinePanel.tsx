"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import type { TimelineEvent } from "@/lib/platform/timeline-db";
import { addTimelineEvent } from "@/lib/platform/timeline";
import type { EntityType } from "@/lib/platform/types";

type EntityTimelinePanelProps = {
  entityType: EntityType;
  entityId: string;
  events: TimelineEvent[];
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function EntityTimelinePanel({
  entityType,
  entityId,
  events,
}: EntityTimelinePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Event title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await addTimelineEvent({
      entityType,
      entityId,
      eventType: "manual",
      title: title.trim(),
      description: description.trim() || null,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setTitle("");
    setDescription("");
    setToast("Timeline event added.");
    startTransition(() => router.refresh());
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70" : ""}`}>
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      <form
        onSubmit={handleAdd}
        className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add Event
        </button>
        {error ? (
          <p className="text-sm text-red-300 sm:col-span-3">{error}</p>
        ) : null}
      </form>

      {!events.length ? (
        <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
          No timeline events yet.
        </div>
      ) : (
        <ol className="relative space-y-0 border-l border-border pl-6">
          {events.map((item) => (
            <li key={item.id} className="pb-6 last:pb-0">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-card" />
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {formatWhen(item.event_date)}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {item.title}
                </p>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
