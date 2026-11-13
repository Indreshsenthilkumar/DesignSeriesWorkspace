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
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3.5 right-3.5 z-40 mx-auto max-w-[430px] md:hidden"
    >
      {/* Floating Pill Container: White background (#FFFFFF), fully rounded, light-grey border, soft elegant shadow */}
      <div
        className="relative flex h-[64px] w-full items-center rounded-full border px-1 shadow-[0_10px_35px_-4px_rgba(0,0,0,0.14),0_2px_8px_-1px_rgba(0,0,0,0.06)]"
        style={{
          backgroundColor: "#FFFFFF",
          borderColor: "rgba(226, 232, 240, 0.95)",
        }}
      >
        {/* Dynamic Smooth Moving Active-Tab Background:
            Occurs smoothly behind selected navigation item with large light-grey rounded background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1.5 left-0 z-0 transition-transform duration-300 ease-in-out"
          style={{
            width: "20%",
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        >
          <div
            className="mx-auto h-full w-[calc(100%-6px)] rounded-[20px] transition-colors"
            style={{
              backgroundColor: "#F1F3F5",
            }}
          />
        </div>

        {/* Five Equally Distributed Navigation Items */}
        <div className="relative z-10 grid h-full w-full grid-cols-5 items-center">
          {TABS.map((tab, idx) => {
            const isActive = activeIndex === idx;
            const IconComponent = tab.icon;
            const badgeCount = tab.href ? badges[tab.href] : undefined;

            const content = (
              <div className="relative flex flex-col items-center justify-center gap-1">
                {/* Icon */}
                <div className="relative flex items-center justify-center">
                  <IconComponent
                    className={`h-[22px] w-[22px] transition-all duration-200 ${
                      isActive ? "scale-105" : "scale-100"
                    }`}
                    style={{
                      color: isActive ? "#1A73E8" : "#1F2937",
                      strokeWidth: isActive ? 2.3 : 1.85,
                    }}
                  />

                  {/* Badge indicator */}
                  {!isActive && badgeCount && badgeCount > 0 ? (
                    <span
                      aria-label={`${badgeCount} unread`}
                      className="absolute -right-1.5 -top-1 flex h-[7px] w-[7px] rounded-full"
                      style={{ backgroundColor: "#EA4335" }}
                    />
                  ) : null}
                </div>

                {/* Text Label */}
                <span
                  className="truncate text-[10px] leading-tight transition-all duration-200"
                  style={{
                    color: isActive ? "#1A73E8" : "#1F2937",
                    fontWeight: isActive ? 600 : 450,
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
      </div>
    </nav>
  );
}
