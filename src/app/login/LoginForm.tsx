"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devLoadingRole, setDevLoadingRole] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Enter both your email (or roll number) and your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, remember }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not sign you in. Please try again.");
        setLoading(false);
        return;
      }

      // A full refresh so the server layout picks up the new session cookie.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network problem — check your connection and try again.");
      setLoading(false);
    }
  };

  const handleDevLogin = async (role: "SUPER_ADMIN" | "ADMIN" | "STUDENT", email?: string) => {
    setError(null);
    setDevLoadingRole(role);
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, email }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Developer sign-in failed.");
        setDevLoadingRole(null);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network problem during developer sign-in.");
      setDevLoadingRole(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------- */}
      {/* Developer Quick Login Section                                 */}
      {/* ------------------------------------------------------------- */}
      <div
        className="rounded-[14px] border p-4 transition-all"
        style={{
          background: "var(--surface-sunken)",
          borderColor: "var(--color-brand-blue)",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-brand-blue) 25%, transparent)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-[6px] text-xs font-bold"
              style={{
                background: "var(--color-brand-blue)",
                color: "#ffffff",
              }}
            >
              ⚡
            </span>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                Developer Quick Login
              </p>
              <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                1-click instant login — no password required
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "color-mix(in srgb, var(--color-brand-blue) 15%, transparent)",
              color: "var(--color-brand-blue)",
            }}
          >
            Dev Mode
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={loading || Boolean(devLoadingRole)}
            onClick={() => handleDevLogin("SUPER_ADMIN", "indreshs.it24@bitsathy.ac.in")}
            className="group relative flex flex-col items-start gap-0.5 rounded-[10px] border p-2.5 text-left transition-all hover:scale-[1.02] hover:border-[var(--color-brand-blue)] active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--line-default)",
            }}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm">👑</span>
              {devLoadingRole === "SUPER_ADMIN" ? (
                <Icon name="spinner" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-[10px] font-medium opacity-60">Instant</span>
              )}
            </div>
            <span className="text-[12px] font-bold leading-tight" style={{ color: "var(--text-strong)" }}>
              Super Admin
            </span>
            <span className="text-[10.5px] leading-tight truncate w-full" style={{ color: "var(--text-faint)" }}>
              Indresh S (Full)
            </span>
          </button>

          <button
            type="button"
            disabled={loading || Boolean(devLoadingRole)}
            onClick={() => handleDevLogin("ADMIN")}
            className="group relative flex flex-col items-start gap-0.5 rounded-[10px] border p-2.5 text-left transition-all hover:scale-[1.02] hover:border-[var(--color-brand-blue)] active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--line-default)",
            }}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm">🛡️</span>
              {devLoadingRole === "ADMIN" ? (
                <Icon name="spinner" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-[10px] font-medium opacity-60">Instant</span>
              )}
            </div>
            <span className="text-[12px] font-bold leading-tight" style={{ color: "var(--text-strong)" }}>
              Admin / Mentor
            </span>
            <span className="text-[10.5px] leading-tight truncate w-full" style={{ color: "var(--text-faint)" }}>
              Staff Access
            </span>
          </button>

          <button
            type="button"
            disabled={loading || Boolean(devLoadingRole)}
            onClick={() => handleDevLogin("STUDENT")}
            className="group relative flex flex-col items-start gap-0.5 rounded-[10px] border p-2.5 text-left transition-all hover:scale-[1.02] hover:border-[var(--color-brand-blue)] active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--line-default)",
            }}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm">🎓</span>
              {devLoadingRole === "STUDENT" ? (
                <Icon name="spinner" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-[10px] font-medium opacity-60">Instant</span>
              )}
            </div>
            <span className="text-[12px] font-bold leading-tight" style={{ color: "var(--text-strong)" }}>
              Student
            </span>
            <span className="text-[10.5px] leading-tight truncate w-full" style={{ color: "var(--text-faint)" }}>
              Student Access
            </span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" style={{ borderColor: "var(--line-default)" }} />
        </div>
        <span
          className="relative px-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{ background: "var(--surface-page)", color: "var(--text-faint)" }}
        >
          Or sign in with credentials
        </span>
      </div>

      {/* Standard Form */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error ? (
          <div
            data-accent="red"
            role="alert"
            className="animate-scale-in flex items-start gap-2.5 rounded-[11px] p-3"
            style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
          >
            <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
            <p className="text-[12.5px] font-medium leading-snug">{error}</p>
          </div>
        ) : null}

        <Field label="College Email" htmlFor="identifier" required>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            icon="mail"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            placeholder="yourname.dept24@bitsathy.ac.in"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            invalid={Boolean(error)}
          />
        </Field>

        <Field label="Password (Roll Number)" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              icon="lock"
              autoComplete="current-password"
              placeholder="e.g. 7376241IT101"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              invalid={Boolean(error)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[8px] transition-colors hover:bg-[var(--surface-inset)]"
              style={{ color: "var(--text-faint)" }}
            >
              <Icon name={showPassword ? "eye-off" : "eye"} className="h-[17px] w-[17px]" />
            </button>
          </div>
        </Field>

        <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-[4px] accent-[var(--color-brand-blue)]"
          />
          Keep me signed in on this device
        </label>

        <Button type="submit" size="lg" block loading={loading} iconRight={loading ? undefined : "arrow-right"}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
