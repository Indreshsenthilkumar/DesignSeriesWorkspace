"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      setError("Enter both your username/email and password.");
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
        setError(payload.error ?? "Could not sign you in. Please check your credentials.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network problem — check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mt-7 flex flex-col">
      {/* Google Sign-in Button */}
      <a
        href="/api/auth/google"
        onClick={() => setGoogleLoading(true)}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#DADCE0] bg-white py-3 px-5 text-[14px] font-medium text-[#3C4043] shadow-xs hover:bg-[#F8F9FA] hover:border-[#BDC1C6] active:bg-[#F1F3F4] transition-all cursor-pointer"
      >
        {googleLoading ? (
          <Icon name="spinner" className="h-5 w-5 animate-spin text-[#1A73E8]" />
        ) : (
          <GoogleIcon className="h-5 w-5 shrink-0" />
        )}
        <span>Continue with Google</span>
      </a>

      {/* Divider */}
      <div className="relative my-7 flex items-center justify-center">
        <div className="w-full border-t border-[#E8EAED]" />
        <span className="absolute bg-white px-3 text-[10.5px] font-bold uppercase tracking-wider text-[#80868B]">
          OR LOG IN WITH CREDENTIALS
        </span>
      </div>

      {/* Error Alert */}
      {error ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-2xl bg-red-50 p-3 text-red-700 border border-red-200"
        >
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-[12.5px] font-medium leading-snug">{error}</p>
        </div>
      ) : null}

      {/* Credentials Form */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {/* Username Field */}
        <div>
          <label htmlFor="identifier" className="block text-[13px] font-semibold text-[#202124] mb-2">
            Username <span className="text-[#EA4335]">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#80868B]">
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter your username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-2xl border border-[#DADCE0] bg-white text-[14px] text-[#202124] placeholder:text-[#9AA0A6] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="mt-1">
          <label htmlFor="password" className="block text-[13px] font-semibold text-[#202124] mb-2">
            Password <span className="text-[#EA4335]">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#80868B]">
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 pl-11 pr-11 rounded-2xl border border-[#DADCE0] bg-white text-[14px] text-[#202124] placeholder:text-[#9AA0A6] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg text-[#80868B] hover:text-[#202124] transition-colors"
            >
              <Icon name={showPassword ? "eye-off" : "eye"} className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Keep signed in checkbox */}
        <label className="flex items-center gap-2.5 text-[13px] text-[#3C4043] cursor-pointer select-none mt-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-[18px] w-[18px] rounded-[5px] border-[#DADCE0] text-[#1A73E8] accent-[#1A73E8] cursor-pointer"
          />
          <span>Keep me signed in on this device</span>
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="mt-3 w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557D0] active:bg-[#174EA6] text-white font-medium text-[14.5px] flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(26,115,232,0.3)] hover:shadow-md transition-all disabled:opacity-70 cursor-pointer"
        >
          {loading ? (
            <>
              <Icon name="spinner" className="h-5 w-5 animate-spin" />
              <span>Logging in…</span>
            </>
          ) : (
            <>
              <span>Log in</span>
              <span className="text-base leading-none">→</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}


