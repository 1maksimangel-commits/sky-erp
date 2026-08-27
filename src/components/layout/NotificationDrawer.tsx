"use client";

import {
  AlertTriangle,
  Bell,
  FileWarning,
  Loader2,
  Package,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useShell } from "@/components/layout/ShellContext";
import type { AppNotification } from "@/lib/platform/notifications-db";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/platform/notifications";

type NotificationDrawerProps = {
  initialNotifications: AppNotification[];
  unreadCount: number;
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  contract_expiring: { label: "Contract Expiring", icon: FileWarning },
  payment_received: { label: "Payment Received", icon: Wallet },
  shipment_delayed: { label: "Shipment Delayed", icon: Truck },
  warehouse_alert: { label: "Warehouse Alert", icon: Package },
  system_alert: { label: "System Alert", icon: AlertTriangle },
  general: { label: "Notification", icon: Bell },
};

function resolveCategory(notification: AppNotification) {
  const raw = (notification.category || "general").toLowerCase();
  if (CATEGORY_META[raw]) return raw;

  const haystack = `${notification.title} ${notification.body ?? ""}`.toLowerCase();
  if (haystack.includes("expir")) return "contract_expiring";
  if (haystack.includes("payment")) return "payment_received";
  if (haystack.includes("delay") || haystack.includes("shipment")) {
    return "shipment_delayed";
  }
  if (haystack.includes("warehouse") || haystack.includes("stock")) {
    return "warehouse_alert";
  }
  if (haystack.includes("system")) return "system_alert";
  return "general";
}

export function NotificationDrawer({
  initialNotifications,
  unreadCount,
}: NotificationDrawerProps) {
  const router = useRouter();
  const { notificationsOpen, setNotificationsOpen } = useShell();
  const [isPending, startTransition] = useTransition();
  const [notifications, setNotifications] =
    useState<AppNotification[]>(initialNotifications);
  const [unread, setUnread] = useState(unreadCount);
  const [prevInitialNotifications, setPrevInitialNotifications] = useState(
    initialNotifications
  );
  const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);

  if (initialNotifications !== prevInitialNotifications) {
    setPrevInitialNotifications(initialNotifications);
    setNotifications(initialNotifications);
  }
  if (unreadCount !== prevUnreadCount) {
    setPrevUnreadCount(unreadCount);
    setUnread(unreadCount);
  }

  useEffect(() => {
    if (!notificationsOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [notificationsOpen, setNotificationsOpen]);

  const grouped = useMemo(() => {
    const order = [
      "contract_expiring",
      "payment_received",
      "shipment_delayed",
      "warehouse_alert",
      "system_alert",
      "general",
    ];
    const map = new Map<string, AppNotification[]>();
    for (const item of notifications) {
      const key = resolveCategory(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return order
      .filter((key) => (map.get(key)?.length ?? 0) > 0)
      .map((key) => ({ key, items: map.get(key) ?? [] }));
  }, [notifications]);

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setNotificationsOpen(true)}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {notificationsOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close notifications"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setNotificationsOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  {unread} unread · Contracts, payments, logistics, warehouse
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isPending || unread === 0}
                  onClick={() => {
                    startTransition(async () => {
                      await markAllNotificationsRead();
                      setNotifications((current) =>
                        current.map((item) => ({ ...item, is_read: true }))
                      );
                      setUnread(0);
                    });
                  }}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {!notifications.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    You are all caught up
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Contract, payment, shipment, warehouse, and system alerts
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grouped.map((group) => {
                    const meta = CATEGORY_META[group.key] ?? CATEGORY_META.general;
                    const Icon = meta.icon;
                    return (
                      <section key={group.key}>
                        <div className="mb-2 flex items-center gap-2 px-1">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {meta.label}
                          </h3>
                        </div>
                        <div className="space-y-1.5">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                startTransition(async () => {
                                  if (!item.is_read) {
                                    await markNotificationRead(item.id);
                                    setUnread((count) => Math.max(0, count - 1));
                                    setNotifications((current) =>
                                      current.map((row) =>
                                        row.id === item.id
                                          ? { ...row, is_read: true }
                                          : row
                                      )
                                    );
                                  }
                                  setNotificationsOpen(false);
                                  if (item.href) router.push(item.href);
                                });
                              }}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors hover:bg-accent/40 ${
                                item.is_read
                                  ? "border-border/70 opacity-70"
                                  : "border-sky-500/30 bg-sky-500/5"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {item.title}
                                </p>
                                {isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : null}
                              </div>
                              {item.body ? (
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {item.body}
                                </p>
                              ) : null}
                              <p className="mt-2 text-[10px] text-muted-foreground">
                                {new Date(item.created_at).toLocaleString()}
                              </p>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
