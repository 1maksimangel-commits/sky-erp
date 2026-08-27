"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteShipment } from "@/lib/logistics/actions";
import type { Shipment } from "@/lib/logistics/db";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type ShipmentDeleteDialogProps = {
  open: boolean;
  shipment: Shipment | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function ShipmentDeleteDialog({
  open,
  shipment,
  onClose,
  onDeleted,
}: ShipmentDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetWhenOpened(open, () => {
    setError(null);
    setDeleting(false);
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, deleting]);

  if (!open || !shipment) {
    return null;
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const result = await deleteShipment(shipment!.id);

    setDeleting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onDeleted();
    onClose();
  }

  const label =
    shipment.container ||
    shipment.vessel ||
    shipment.contract?.contract_number ||
    "this shipment";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={deleting ? undefined : onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-shipment-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2
            id="delete-shipment-title"
            className="text-base font-semibold text-foreground"
          >
            Delete shipment
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-mono text-foreground">{label}</span>? This
            action cannot be undone.
          </p>
        </div>

        {error ? (
          <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:mx-6">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
