"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LogoLockup, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/Theme";
import { useToast } from "@/components/ui/Toast";
import { isActive, titleFor, type NavItem } from "@/lib/nav";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { cn, shortYear } from "@/lib/utils";
import { formatDay } from "@/lib/dates";

import { CommandPalette } from "./CommandPalette";
import { Sidebar, SidebarNav, type NavBadges } from "./Sidebar";
import { FlipkartMobileNavBar } from "./FlipkartMobileNavBar";
import { GmailMobileSearch } from "./GmailMobileSearch";
import { SupportNotificationListener } from "@/components/features/SupportNotificationListener";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  role: string;
  domain: string;
  year: string;
  rewardPoints: number;
  mustChangePassword: boolean;
};

export function AppShell({
  user,
  studentNav,
  consoleNav,
  badges,
  today,
  children,
}: {
  user: ShellUser;
  studentNav: NavItem[];
  consoleNav: NavItem[];
  badges: NavBadges;
  today: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allNav = [...studentNav, ...consoleNav];
  const canSearchPeople = consoleNav.length > 0;

  // ⌘K / Ctrl-K anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const activeBadges = useMemo(() => {
    const next = { ...badges };
    if (pathname.startsWith("/announcements")) next["/announcements"] = 0;
    if (pathname.startsWith("/support")) next["/support"] = 0;
    if (pathname.startsWith("/console/support")) next["/console/support"] = 0;
    return next;
  }, [badges, pathname]);

  const primary = (
    studentNav.length > 0
      ? [...studentNav.filter((i) => i.primary)]
      : [
          {
            href: "/dashboard",
            label: "Dashboard",
            icon: "grid" as const,
            description: "Mentor dashboard overview",
            primary: true,
          },
          ...consoleNav.filter((i) => i.primary),
        ]
  ).slice(0, 4);

  return (
    <div className="min-h-dvh">
      <Sidebar
        studentNav={studentNav}
        consoleNav={consoleNav}
        badges={activeBadges}
        footer={<UserCard user={user} />}
      />

      <div className="lg:pl-[256px]">
        <TopBar
          user={user}
          today={today}
          title={titleFor(pathname)}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
          unread={activeBadges["/announcements"] ?? 0}
        />

        <main
          id="main"
          className="mx-auto w-full max-w-[1420px] px-3.5 sm:px-6 pt-3 sm:pt-6 pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-12"
        >
          {children}
        </main>
      </div>

      <SupportNotificationListener userRole={user.role} />

      <FlipkartMobileNavBar
        badges={activeBadges}
        onMore={() => setDrawerOpen(true)}
        drawerOpen={drawerOpen}
      />

      {drawerOpen ? (
        <MobileDrawer
          user={user}
          studentNav={studentNav}
          consoleNav={consoleNav}
          badges={activeBadges}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={allNav}
        canSearchPeople={canSearchPeople}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function TopBar({
  user,
  today,
  title,
  onOpenPalette,
  onOpenDrawer,
  unread,
}: {
  user: ShellUser;
  today: string;
  title: string;
  onOpenPalette: () => void;
  onOpenDrawer: () => void;
  unread: number;
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        borderColor: "var(--line-default)",
        background: "color-mix(in srgb, var(--surface-raised) 92%, transparent)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1420px] items-center px-3 sm:px-4 lg:h-16 lg:px-6">
        {/* Mobile View Only: Unified Gmail Floating Search Bar */}
        <div className="w-full lg:hidden">
          <GmailMobileSearch
            user={user}
            unreadAnnouncements={unread}
            onOpenDrawer={onOpenDrawer}
          />
        </div>

        {/* Desktop View: Title + Central Google Search Pill + Actions */}
        <div className="hidden w-full items-center justify-between gap-4 lg:flex">
          <div className="min-w-0 w-48 shrink-0">
            <h1 className="truncate text-[18px] font-bold leading-tight text-[var(--text-strong)]">{title}</h1>
            <p className="text-[12px] font-medium text-[var(--text-muted)]">
              {formatDay(today, "long")}
            </p>
          </div>

          {/* Central Google Search Bar Pill */}
          <div className="flex-1 max-w-[620px]">
            <button
              onClick={onOpenPalette}
              className="flex h-11 w-full items-center gap-3 rounded-full border border-transparent bg-[var(--surface-inset)] hover:bg-[var(--surface-sunken)] hover:shadow-xs px-4 text-left text-[14px] text-[var(--text-muted)] transition-all cursor-pointer select-none"
            >
              <Icon name="search" className="h-4 w-4 text-[var(--text-faint)] shrink-0" />
              <span className="flex-1 truncate">Search in DesignSeries portal, students, logs...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-[6px] border border-[var(--line-default)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-faint)]">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <Link
              href="/notes"
              title="My Notes"
              className="grid h-10 w-10 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)]"
            >
              <Icon name="note" className="h-[18px] w-[18px]" />
            </Link>

            <Link
              href="/announcements"
              aria-label={unread ? `Announcements, ${unread} unread` : "Announcements"}
              className="relative grid h-10 w-10 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)]"
            >
              <Icon name="bell" className="h-[18px] w-[18px]" />
              {unread > 0 ? (
                <span
                  className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: "var(--color-brand-red)" }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>

            <ThemeToggle compact />

            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// User menu
// ---------------------------------------------------------------------------

function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onClick = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out", "Check your connection and try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="relative ml-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-[var(--surface-inset)]"
      >
        <Avatar name={user.name} seed={user.id} size={32} />
        <Icon name="chevron-down" className="mr-1 hidden h-3.5 w-3.5 sm:block" style={{ color: "var(--text-faint)" }} />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-[14px] border"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--line-default)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <div className="flex items-center gap-3 p-3.5" style={{ background: "var(--surface-inset)" }}>
            <Avatar name={user.name} seed={user.id} size={40} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                {user.name}
              </p>
              <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 px-3.5 py-2.5">
            <Badge tone="blue">{ROLE_LABEL[user.role as Role] ?? user.role}</Badge>
            {user.year ? <Badge tone="slate">{shortYear(user.year)}</Badge> : null}
            <Badge tone="amber" icon="trophy">
              {user.rewardPoints} pts
            </Badge>
          </div>

          <div className="border-t p-1.5" style={{ borderColor: "var(--line-soft)" }}>
            <MenuLink href="/profile" icon="user" label="My profile" />
            <MenuLink href="/profile#security" icon="lock" label="Password & security" />
            <MenuLink href="/notes" icon="note" label="My notes" />
            <button
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-inset)] disabled:opacity-60"
              style={{ color: "var(--color-brand-red)" }}
            >
              <Icon name={signingOut ? "spinner" : "logout"} className={cn("h-4 w-4", signingOut && "animate-spin")} />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: "user" | "lock" | "note"; label: string }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-inset)]"
      style={{ color: "var(--text-default)" }}
    >
      <Icon name={icon} className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
      {label}
    </Link>
  );
}

/** Sidebar footer card — identity at a glance without opening a menu. */
function UserCard({ user }: { user: ShellUser }) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-2.5 rounded-[11px] p-2 transition-colors hover:bg-[var(--surface-inset)]"
    >
      <Avatar name={user.name} seed={user.id} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
          {user.name}
        </span>
        <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {ROLE_LABEL[user.role as Role] ?? user.role} · {user.rewardPoints} pts
        </span>
      </span>
      <Icon name="chevron-right" className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Mobile navigation
// ---------------------------------------------------------------------------

function MobileTabBar({
  items,
  badges,
  onMore,
}: {
  items: NavItem[];
  badges: NavBadges;
  onMore: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      style={{
        borderColor: "var(--line-soft)",
        background: "color-mix(in srgb, var(--surface-raised) 92%, transparent)",
      }}
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-[58px] flex-col items-center justify-center gap-1"
              style={{ color: active ? "var(--accent)" : "var(--text-faint)" }}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute top-0 h-[2.5px] w-9 rounded-b-full"
                  style={{ background: "var(--accent)" }}
                />
              ) : null}
              <span className="relative">
                <Icon name={item.icon} className="h-[20px] w-[20px]" />
                {!active && badges[item.href] ? (
                  <span
                    className="absolute -right-1.5 -top-1 h-[7px] w-[7px] rounded-full"
                    style={{ background: "var(--color-brand-red)" }}
                  />
                ) : null}
              </span>
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}

        <button
          onClick={onMore}
          className="flex h-[58px] flex-col items-center justify-center gap-1"
          style={{ color: "var(--text-faint)" }}
        >
          <Icon name="more" className="h-[20px] w-[20px]" />
          <span className="text-[10px] font-semibold leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}

function MobileDrawer({
  user,
  studentNav,
  consoleNav,
  badges,
  onClose,
}: {
  user: ShellUser;
  studentNav: NavItem[];
  consoleNav: NavItem[];
  badges: NavBadges;
  onClose: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out", "Check your connection and try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <div
        className="animate-fade absolute inset-0"
        style={{ background: "var(--surface-overlay)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r shadow-2xl"
        style={{
          background: "var(--surface-rail)",
          borderColor: "var(--line-default)",
          animation: "kup-rise 0.26s var(--ease-out-quint) both",
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4 border-b border-[var(--line-soft)]">
          <LogoLockup height={21} />
          <div className="flex items-center gap-1">
            <ThemeToggle compact />
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="grid h-9 w-9 place-items-center rounded-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
            >
              <Icon name="close" className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            studentNav={studentNav}
            consoleNav={consoleNav}
            badges={badges}
            onNavigate={onClose}
          />
        </div>

        <div className="shrink-0 border-t p-3 space-y-2.5 bg-[var(--surface-raised)]" style={{ borderColor: "var(--line-default)" }}>
          <div className="flex items-center justify-between rounded-[10px] bg-[var(--surface-inset)] px-2.5 py-1.5 border border-[var(--line-soft)]">
            <span className="text-[12px] font-semibold text-[var(--text-default)]">Appearance</span>
            <ThemeToggle />
          </div>

          <UserCard user={user} />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red-050)] py-2 text-[13px] font-bold text-[var(--color-brand-red)] transition-all active:scale-95 disabled:opacity-50"
          >
            <Icon name={signingOut ? "spinner" : "logout"} className={cn("h-4 w-4", signingOut && "animate-spin")} />
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
