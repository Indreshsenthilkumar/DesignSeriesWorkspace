"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoLockup } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { Counter } from "@/components/ui/Badge";
import { isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export type NavBadges = Record<string, number>;

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.description}
      className={cn(
        "group relative flex h-10 items-center gap-3.5 rounded-full px-4",
        "text-[13.5px] font-medium transition-all duration-150",
        active
          ? "bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff] font-semibold"
          : "text-[#444746] dark:text-[#c4c7c5] hover:bg-[#eaebef]/80 dark:hover:bg-[#282a2c] hover:text-[#1f1f1f] dark:hover:text-white"
      )}
    >
      <Icon
        name={item.icon}
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-[#001d35] dark:text-[#c2e7ff]" : "text-[#444746] dark:text-[#c4c7c5]"
        )}
      />
      <span className="truncate flex-1">{item.label}</span>
      {badge && badge > 0 ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
            active
              ? "bg-[#001d35] text-white dark:bg-[#c2e7ff] dark:text-[#001d35]"
              : "bg-[#c5221f] text-white"
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-1.5 mt-5 px-4 text-[11px] font-bold uppercase tracking-[0.08em] first:mt-0 text-[#747775] dark:text-[#8e918f]"
    >
      {children}
    </p>
  );
}

export function SidebarNav({
  studentNav,
  consoleNav,
  badges = {},
  onNavigate,
}: {
  studentNav: NavItem[];
  consoleNav: NavItem[];
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col px-3 pb-4" aria-label="Main">
      {studentNav.length > 0 ? (
        <>
          <SectionLabel>My portal</SectionLabel>
          <div className="flex flex-col gap-1">
            {studentNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={badges[item.href]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionLabel>Overview</SectionLabel>
          <div className="flex flex-col gap-1">
            <NavLink
              item={{
                href: "/dashboard",
                label: "Dashboard",
                icon: "grid",
                description: "Mentor dashboard overview and enabled console access.",
              }}
              active={isActive(pathname, "/dashboard")}
              onNavigate={onNavigate}
            />
          </div>
        </>
      )}

      {consoleNav.length > 0 ? (
        <>
          <SectionLabel>Admin console</SectionLabel>
          <div className="flex flex-col gap-1">
            {consoleNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={badges[item.href]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </>
      ) : null}
    </nav>
  );
}

export function Sidebar({
  studentNav,
  consoleNav,
  badges,
  footer,
}: {
  studentNav: NavItem[];
  consoleNav: NavItem[];
  badges?: NavBadges;
  footer?: React.ReactNode;
}) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r lg:flex"
      style={{ background: "var(--surface-rail)", borderColor: "var(--line-soft)" }}
    >
      {/* Brand Header */}
      <div className="shrink-0 px-5 pb-3 pt-5">
        <Link href="/dashboard" className="inline-block rounded-[12px] p-1 -ml-1 transition-opacity hover:opacity-85">
          <LogoLockup height={26} />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav studentNav={studentNav} consoleNav={consoleNav} badges={badges} />
      </div>

      {footer ? (
        <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--line-soft)" }}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
