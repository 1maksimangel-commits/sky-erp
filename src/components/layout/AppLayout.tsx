"use client";

import { memo } from "react";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Header } from "@/components/layout/Header";
import {
  ShellProvider,
  usePageActions,
  useShell,
} from "@/components/layout/ShellContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AppNotification } from "@/lib/platform/notifications-db";
import { getRouteMeta } from "@/lib/platform/route-meta";

type AppLayoutProps = {
  children: React.ReactNode;
  notifications?: AppNotification[];
  unreadCount?: number;
};

/** Isolates page trees from shell re-renders after PageActions registration. */
const MainContent = memo(function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
});

function ShellPageHeader() {
  const pathname = usePathname();
  const pageActions = usePageActions();
  const meta = getRouteMeta(pathname);

  return (
    <div>
      <Breadcrumbs items={meta.breadcrumbs} />
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={pageActions}
      />
    </div>
  );
}

function AppLayoutInner({
  children,
  notifications = [],
  unreadCount = 0,
}: AppLayoutProps) {
  const { sidebarCollapsed } = useShell();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div
        className={[
          "transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64",
        ].join(" ")}
      >
        <Header
          initialNotifications={notifications}
          unreadCount={unreadCount}
        />

        <main className="px-4 py-5 sm:px-5 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-[1600px] space-y-5">
            <ShellPageHeader />
            <MainContent>{children}</MainContent>
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <ShellProvider>
      <AppLayoutInner {...props} />
    </ShellProvider>
  );
}
