"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Home, Clock, ClipboardList, ListTodo, LayoutGrid } from "lucide-react";
import type { NavBadges } from "./Sidebar";

type NavTabItem = {
  id: string;
  label: string;
  href?: string;
  icon: typeof Home;
  isAction?: boolean;
};

const TABS: NavTabItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    id: "attendance",
    label: "Missed OTP",
    href: "/attendance",
    icon: Clock,
  },
  {
    id: "worklog",
    label: "Worklog",
    href: "/worklog",
    icon: ClipboardList,
  },
  {
    id: "task",
    label: "Task",
    href: "/tasks",
    icon: ListTodo,
  },
  {
    id: "more",
    label: "More",
    icon: LayoutGrid,
    isAction: true,
  },
];

export function FlipkartMobileNavBar({
  badges = {},
  onMore,
  drawerOpen = false,
}: {
  badges?: NavBadges;
  onMore: () => void;
  drawerOpen?: boolean;
}) {
  const pathname = usePathname();

  // Determine active tab index (0 to 4)
  const activeIndex = useMemo(() => {
    if (drawerOpen) return 4;
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return 0;
    if (pathname === "/attendance" || pathname.startsWith("/attendance") || pathname.startsWith("/console/attendance")) return 1;
    if (pathname === "/worklog" || pathname.startsWith("/worklog") || pathname.startsWith("/console/worklogs")) return 2;
    if (pathname === "/tasks" || pathname.startsWith("/tasks") || pathname.startsWith("/console/tasks")) return 3;
    // Any other page (Leaves, Passes, Announcements, Leaderboard, Profile, Console, Support) highlights "More"
    return 4;
  }, [pathname, drawerOpen]);

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 w-full md:hidden pointer-events-auto bg-[var(--surface-raised)] border-t border-[var(--line-default)] shadow-[0_-2px_12px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]"
    >
      {/* Five Equally Distributed Navigation Items — Exact Flipkart docked bottom bar style */}
      <div className="relative flex h-[56px] w-full items-center justify-around px-1">
        {TABS.map((tab, idx) => {
          const isActive = activeIndex === idx;
          const IconComponent = tab.icon;
          const badgeCount = tab.href ? badges[tab.href] : undefined;

          const content = (
            <div className="relative flex flex-col items-center justify-center gap-1 py-1 w-full">
              {/* Active Top Accent Line (Flipkart Style) */}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 h-[3px] w-8 rounded-full bg-[var(--accent)]"
                />
              ) : null}

              {/* Icon */}
              <div className="relative flex items-center justify-center">
                <IconComponent
                  className={`h-[20px] w-[20px] transition-transform duration-150 ${
                    isActive ? "scale-105" : "scale-100"
                  }`}
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                    strokeWidth: isActive ? 2.3 : 1.8,
                  }}
                />

                {/* Badge indicator */}
                {!isActive && badgeCount && badgeCount > 0 ? (
                  <span
                    aria-label={`${badgeCount} unread`}
                    className="absolute -right-1.5 -top-1 flex h-[7px] w-[7px] rounded-full bg-[var(--color-brand-red)]"
                  />
                ) : null}
              </div>

              {/* Text Label */}
              <span
                className="truncate text-[10.5px] leading-tight tracking-tight transition-colors duration-150"
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: isActive ? 650 : 500,
                }}
              >
                {tab.label}
              </span>
            </div>
          );

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={onMore}
                aria-label="Open More Menu"
                aria-pressed={isActive}
                className="flex h-full flex-1 flex-col items-center justify-center select-none active:opacity-75 focus:outline-none"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href!}
              aria-current={isActive ? "page" : undefined}
              className="flex h-full flex-1 flex-col items-center justify-center select-none active:opacity-75 focus:outline-none"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
