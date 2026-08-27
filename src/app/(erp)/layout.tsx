import { AppLayout } from "@/components/layout/AppLayout";
import { getNotifications } from "@/lib/platform/notifications-db";

export const dynamic = "force-dynamic";

export default async function ErpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use the non-server-action DB helper so RSC render does not proxy through
  // the Server Action HTTP endpoint (which can surface as TypeError: fetch failed).
  const { data: notifications, unreadCount } = await getNotifications(25);

  return (
    <AppLayout notifications={notifications} unreadCount={unreadCount}>
      {children}
    </AppLayout>
  );
}
