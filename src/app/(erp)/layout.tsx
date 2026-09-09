import { AppLayout } from "@/components/layout/AppLayout";
import { getNotifications } from "@/lib/platform/notifications-db";
import { getAccessContext } from "@/lib/platform/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ErpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getAccessContext();
  if (!context) redirect("/login");
  if (!context.hasAccess) redirect("/access-pending");
  // Use the non-server-action DB helper so RSC render does not proxy through
  // the Server Action HTTP endpoint (which can surface as TypeError: fetch failed).
  const { data: notifications, unreadCount } = await getNotifications(25);

  return (
    <AppLayout notifications={notifications} unreadCount={unreadCount}>
      {children}
    </AppLayout>
  );
}
