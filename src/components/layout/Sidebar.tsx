"use client";

import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShell } from "@/components/layout/ShellContext";
import { navItems } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    toggleSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useShell();

  const mainItems = navItems.filter((item) => item.section !== "system");
  const systemItems = navItems.filter((item) => item.section === "system");

  function renderLink(item: (typeof navItems)[number]) {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={sidebarCollapsed ? item.label : undefined}
          onClick={() => setMobileSidebarOpen(false)}
          className={[
            "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
            sidebarCollapsed ? "justify-center" : "",
            isActive
              ? "bg-accent text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          ].join(" ")}
        >
          <Icon
            className={[
              "h-4 w-4 shrink-0",
              isActive
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-foreground",
            ].join(" ")}
          />
          {!sidebarCollapsed ? (
            <span className="truncate">{item.label}</span>
          ) : null}
        </Link>
      </li>
    );
  }

  return (
    <>
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-200 ease-out",
          sidebarCollapsed ? "w-[72px]" : "w-64",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-14 items-center border-b border-border",
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4",
          ].join(" ")}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
              <span className="text-xs font-bold tracking-tight">S</span>
            </div>
            {!sidebarCollapsed ? (
              <span className="text-sm font-semibold tracking-tight text-foreground">
                SKY ERP
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
          {!sidebarCollapsed ? (
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Workspace
            </p>
          ) : null}
          <ul className="space-y-0.5">{mainItems.map(renderLink)}</ul>

          <div className="my-4 border-t border-border/80" />

          {!sidebarCollapsed ? (
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              System
            </p>
          ) : null}
          <ul className="space-y-0.5">{systemItems.map(renderLink)}</ul>
        </nav>

        <div className="border-t border-border p-2.5">
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={[
              "hidden w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex",
              sidebarCollapsed ? "justify-center" : "",
            ].join(" ")}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                Collapse
              </>
            )}
          </button>
          {!sidebarCollapsed ? (
            <div className="mt-2 rounded-lg border border-border/80 bg-accent/40 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground">
                Enterprise workspace
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Search, create, and operate from one shell
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
