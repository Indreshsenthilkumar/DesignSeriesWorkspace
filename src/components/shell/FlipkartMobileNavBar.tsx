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
      className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)] bg-[var(--surface-raised)] border-t border-[var(--line-default)] md:hidden shadow-[0_-1px_3px_0_rgba(60,64,67,0.08)] pointer-events-auto"
    >
      <div className="grid h-[64px] grid-cols-5 items-center px-1">
        {TABS.map((tab, idx) => {
          const isActive = activeIndex === idx;
          const IconComponent = tab.icon;
          const badgeCount = tab.href ? badges[tab.href] : undefined;

          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5">
              {/* Google Material 3 Active Pill Container */}
              <div
                className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]"
                    : "text-[#444746] dark:text-[#c4c7c5] hover:bg-[#eaebef]/50"
                }`}
              >
                <IconComponent
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.4 : 1.8}
                />

                {/* Badge indicator */}
                {!isActive && badgeCount && badgeCount > 0 ? (
                  <span
                    aria-label={`${badgeCount} unread`}
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ea4335] px-1 text-[9px] font-bold text-white"
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                ) : null}
              </div>

              {/* Text Label */}
              <span
                className={`truncate text-[11px] leading-tight transition-colors duration-150 ${
                  isActive
                    ? "font-bold text-[#1f1f1f] dark:text-white"
                    : "font-medium text-[#444746] dark:text-[#8e918f]"
                }`}
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
                className="flex h-full w-full flex-col items-center justify-center select-none active:opacity-75 focus:outline-none"
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
              className="flex h-full w-full flex-col items-center justify-center select-none active:opacity-75 focus:outline-none"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
