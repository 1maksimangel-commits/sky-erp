"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ShellContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebarCollapsed: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (value: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (value: boolean) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (value: boolean) => void;
  setPageActions: (node: ReactNode) => void;
};

type PageActionsContextValue = {
  pageActions: ReactNode;
};

const ShellContext = createContext<ShellContextValue | null>(null);
const PageActionsContext = createContext<PageActionsContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pageActions, setPageActionsState] = useState<ReactNode>(null);

  const setPageActions = useCallback((node: ReactNode) => {
    setPageActionsState(node);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((value) => !value);
  }, []);

  // Keep pageActions out of this value so registering header actions does not
  // re-render the shell chrome / page tree (which would recreate PageActions
  // children and loop forever).
  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      commandOpen,
      setCommandOpen,
      notificationsOpen,
      setNotificationsOpen,
      setPageActions,
    }),
    [
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileSidebarOpen,
      commandOpen,
      notificationsOpen,
      setPageActions,
    ]
  );

  const pageActionsValue = useMemo(
    () => ({ pageActions }),
    [pageActions]
  );

  return (
    <ShellContext.Provider value={value}>
      <PageActionsContext.Provider value={pageActionsValue}>
        {children}
      </PageActionsContext.Provider>
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return ctx;
}

export function usePageActions() {
  const ctx = useContext(PageActionsContext);
  if (!ctx) {
    throw new Error("usePageActions must be used within ShellProvider");
  }
  return ctx.pageActions;
}

/** Renders nothing; registers action buttons into the shell page header. */
export function PageActions({ children }: { children: ReactNode }) {
  const { setPageActions } = useShell();

  useEffect(() => {
    setPageActions(children);
    return () => setPageActions(null);
  }, [children, setPageActions]);

  return null;
}
