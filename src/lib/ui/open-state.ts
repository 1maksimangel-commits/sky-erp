"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Open UI when a search-param flag appears, without setState-in-effect.
 * Used by list pages that open "New" modals via ?new=1.
 */
export function useSearchParamOpen(
  param = "new",
  value = "1"
): [boolean, (open: boolean) => void] {
  const searchParams = useSearchParams();
  const flagged = searchParams.get(param) === value;
  const [open, setOpen] = useState(flagged);
  const [prevFlagged, setPrevFlagged] = useState(flagged);

  if (flagged !== prevFlagged) {
    setPrevFlagged(flagged);
    if (flagged) {
      setOpen(true);
    }
  }

  return [open, setOpen];
}

/**
 * Reset local state when a dialog transitions from closed → open.
 * Prefer this over useEffect(() => { if (open) reset() }, [open]).
 */
export function useResetWhenOpened(open: boolean, onOpen: () => void): void {
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      onOpen();
    }
  }
}
