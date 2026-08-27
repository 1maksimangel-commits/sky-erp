"use client";

import { Bot, Menu, Search } from "lucide-react";
import Link from "next/link";
import { useShell } from "@/components/layout/ShellContext";
import { NotificationDrawer } from "@/components/layout/NotificationDrawer";
import { QuickCreateMenu } from "@/components/layout/QuickCreateMenu";
import { UserMenu } from "@/components/layout/UserMenu";
import type { AppNotification } from "@/lib/platform/notifications-db";

type HeaderProps = {
  initialNotifications?: AppNotification[];
  unreadCount?: number;
};

export function Header({
  initialNotifications = [],
  unreadCount = 0,
}: HeaderProps) {
  const { setMobileSidebarOpen, setCommandOpen } = useShell();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 lg:px-6">
      <button
        type="button"
        aria-label="Open menu"
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/55 sm:max-w-md lg:max-w-lg"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Search workspace…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <QuickCreateMenu />

        <NotificationDrawer
          initialNotifications={initialNotifications}
          unreadCount={unreadCount}
        />

        <Link
          href="/ai"
          aria-label="AI Assistant"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bot className="h-4 w-4" />
        </Link>

        <UserMenu />
      </div>
    </header>
  );
}
