"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const emailParam = searchParams.get("email");

    if (errorParam === "unregistered_email" && emailParam) {
      setError(`Your Google account (${emailParam}) is not registered in the portal. Please contact the administrator to create your account.`);
    } else if (errorParam === "account_inactive") {
      setError("Your account is currently inactive. Please contact your domain mentor or administrator.");
    } else if (errorParam === "google_cancelled") {
      setError("Google sign-in was cancelled.");
    } else if (errorParam === "invalid_state" || errorParam === "token_exchange_failed" || errorParam === "oauth_internal_error") {
      setError("Google authentication failed. Please try again or use your password.");
    }
  }, [searchParams]);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Google Sign-in Button */}
      <a
        href="/api/auth/google"
        onClick={() => setGoogleLoading(true)}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] px-4 py-2.5 text-xs font-semibold text-[var(--text-strong)] shadow-sm hover:border-[var(--color-brand-blue)] hover:bg-[var(--surface-sunken)] transition-all cursor-pointer"
      >
        {googleLoading ? (
          <Icon name="spinner" className="h-4 w-4 animate-spin text-[var(--color-brand-blue)]" />
        ) : (
          <GoogleIcon className="h-4 w-4 shrink-0" />
        )}
        <span>Continue with Google</span>
      </a>

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
