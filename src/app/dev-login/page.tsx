import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoLockup } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ui/Theme";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Developer Login Portal" };

export default async function DevLoginPage() {
  const user = await getCurrentUser();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      rollNo: true,
      role: true,
      department: true,
      domain: true,
      systemStatus: true,
      lastLoginAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div
      className="min-h-dvh flex flex-col justify-between p-6 sm:p-12"
      style={{ background: "var(--surface-page)" }}
    >
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b" style={{ borderColor: "var(--line-default)" }}>
          <div className="flex items-center gap-3">
            <LogoLockup height={28} subtitle="Developer Portal" />
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "color-mix(in srgb, var(--color-brand-blue) 15%, transparent)",
                color: "var(--color-brand-blue)",
              }}
            >
              ⚡ Fast Auth
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Signed in as <strong>{user.name}</strong> ({user.role})
                </span>
                <Link
                  href="/dashboard"
                  className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90"
                  style={{ background: "var(--color-brand-blue)" }}
                >
                  Go to Dashboard →
                </Link>
              </div>
            ) : null}
            <ThemeToggle compact />
          </div>
        </header>

        {/* Hero */}
        <div className="my-8">
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-strong)" }}>
            ⚡ Developer 1-Click Sign In
          </h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--text-muted)" }}>
            Instantly authenticate as any role or account without typing credentials. Perfect for testing role-based access, attendance workflows, worklogs, and mentor consoles.
          </p>
        </div>

        {/* Quick Role Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <Link
            href="/api/auth/dev-login?role=SUPER_ADMIN"
            className="group relative flex flex-col justify-between rounded-[16px] border p-5 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.99]"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--color-brand-blue)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">👑</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: "color-mix(in srgb, var(--color-brand-blue) 20%, transparent)", color: "var(--color-brand-blue)" }}
                >
                  Full Access
                </span>
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>
                Super Admin
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Full system control, user management, database viewer, and all permissions enabled.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-brand-blue)" }}>
              <span>Sign in as Super Admin</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>

          <Link
            href="/api/auth/dev-login?role=ADMIN"
            className="group relative flex flex-col justify-between rounded-[16px] border p-5 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.99]"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--color-brand-red)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🛡️</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: "color-mix(in srgb, var(--color-brand-red) 20%, transparent)", color: "var(--color-brand-red)" }}
                >
                  Staff / Mentor
                </span>
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>
                Mentor / Admin
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Access to mentor console, reviewing worklogs, assigning tasks, approving passes, and marking QR attendance.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-brand-red)" }}>
              <span>Sign in as Mentor</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>

          <Link
            href="/api/auth/dev-login?role=STUDENT"
            className="group relative flex flex-col justify-between rounded-[16px] border p-5 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.99]"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--color-brand-green)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🎓</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: "color-mix(in srgb, var(--color-brand-green) 20%, transparent)", color: "var(--color-brand-green)" }}
                >
                  Student
                </span>
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>
                Student User
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Student dashboard, self attendance logging, worklog submission, pass requests, and task completion.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-brand-green)" }}>
              <span>Sign in as Student</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>

        {/* Existing Accounts in DB */}
        <div className="rounded-[16px] border p-6" style={{ background: "var(--surface-raised)", borderColor: "var(--line-default)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-strong)" }}>
                Database Accounts ({users.length})
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Click any user to login directly as that person:
              </p>
            </div>
            <Link
              href="/login"
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--color-brand-blue)" }}
            >
              Standard Login Page →
            </Link>
          </div>

          <div className="divide-y max-h-[360px] overflow-y-auto" style={{ borderColor: "var(--line-default)" }}>
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between py-3 px-2 rounded-[10px] transition-colors hover:bg-[var(--surface-inset)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
                    style={{
                      background:
                        u.role === "SUPER_ADMIN"
                          ? "var(--color-brand-blue)"
                          : u.role === "ADMIN"
                          ? "var(--color-brand-red)"
                          : "var(--color-brand-green)",
                      color: "#ffffff",
                    }}
                  >
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-strong)" }}>
                        {u.name}
                      </p>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          background: "var(--surface-sunken)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {u.role}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
                      {u.email} • {u.rollNo} • {u.domain}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/api/auth/dev-login?email=${encodeURIComponent(u.email)}`}
                  className="shrink-0 rounded-[8px] border px-3 py-1.5 text-xs font-semibold transition-all hover:bg-[var(--color-brand-blue)] hover:text-white hover:border-[var(--color-brand-blue)]"
                  style={{
                    borderColor: "var(--line-default)",
                    color: "var(--text-strong)",
                  }}
                >
                  Sign in ⚡
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        DesignSeries Portal • Developer Auth Suite • Available in local & development environments
      </footer>
    </div>
  );
}
