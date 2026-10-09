import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";

import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in - DesignSeries" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden w-full bg-[#FAFCFF] flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-16 lg:py-0 font-sans selection:bg-[#E8F0FE] selection:text-[#1A73E8]">
      {/* ------------------------------------------------------------- */}
      {/* Organic Curved Background Elements                           */}
      {/* ------------------------------------------------------------- */}
      {/* Top-Right Curved Organic Shape */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 w-[340px] h-[340px] sm:w-[520px] sm:h-[520px] lg:w-[680px] lg:h-[680px] opacity-75"
      >
        <svg viewBox="0 0 700 700" fill="none" className="w-full h-full">
          <path
            d="M700 0C600 120 480 180 380 260C280 340 320 490 220 560C120 630 0 650 0 700H700V0Z"
            fill="url(#blueWaveTop)"
          />
          <defs>
            <linearGradient id="blueWaveTop" x1="700" y1="0" x2="200" y2="600" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D2E3FC" stopOpacity="0.8" />
              <stop offset="0.6" stopColor="#E8F0FE" stopOpacity="0.5" />
              <stop offset="1" stopColor="#FAFCFF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Bottom-Left Curved Organic Shape */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] lg:w-[620px] lg:h-[620px] opacity-75"
      >
        <svg viewBox="0 0 700 700" fill="none" className="w-full h-full">
          <path
            d="M0 700C120 620 180 480 280 400C380 320 460 300 540 200C620 100 660 0 700 0H0V700Z"
            fill="url(#blueWaveBottom)"
          />
          <defs>
            <linearGradient id="blueWaveBottom" x1="0" y1="700" x2="500" y2="200" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D2E3FC" stopOpacity="0.75" />
              <stop offset="0.65" stopColor="#E8F0FE" stopOpacity="0.45" />
              <stop offset="1" stopColor="#FAFCFF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Bottom-Right Warm Organic Shape */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1/4 w-[280px] h-[280px] sm:w-[420px] sm:h-[420px] lg:w-[500px] lg:h-[500px] opacity-60"
      >
        <svg viewBox="0 0 500 500" fill="none" className="w-full h-full">
          <circle cx="250" cy="400" r="250" fill="url(#warmGlow)" />
          <defs>
            <radialGradient id="warmGlow" cx="0.5" cy="0.8" r="0.6">
              <stop stopColor="#FEF7E0" stopOpacity="0.9" />
              <stop offset="1" stopColor="#FAFCFF" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Main Content Container (Fits 100% on Desktop Without Scroll)  */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-10 mx-auto w-full max-w-7xl flex flex-col items-center justify-center lg:grid lg:grid-cols-12 gap-6 lg:gap-10 xl:gap-16 my-auto">
        
        {/* Mobile-Only Header Brand Lockup */}
        <div className="flex items-center justify-center gap-3.5 mb-2 lg:hidden">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden">
            <Image
              src="/brand/designseries-logo.png"
              alt="DesignSeries"
              width={48}
              height={48}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-[26px] font-bold tracking-tight text-[#202124]">
            Design<span className="text-[#1A73E8]">Series</span>
          </span>
        </div>

        {/* Left Column: Brand Hero & Features (Desktop Only: hidden lg:flex) */}
        <div className="hidden lg:flex flex-col lg:col-span-7 py-2 lg:py-4">
          {/* Desktop Logo Lockup */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="relative h-13 w-13 sm:h-14 sm:w-14 lg:h-15 lg:w-15 shrink-0 overflow-hidden">
              <Image
                src="/brand/designseries-logo.png"
                alt="DesignSeries"
                width={60}
                height={60}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold tracking-tight text-[#202124]">
              Design<span className="text-[#1A73E8]">Series</span>
            </span>
          </div>

          {/* Heading with exact requested gradient */}
          <h1 className="mt-5 sm:mt-7 lg:mt-8 text-[32px] sm:text-[40px] lg:text-[44px] xl:text-[48px] font-extrabold tracking-tight text-[#202124] leading-[1.12]">
            One place for the
            <br />
            work you do{" "}
            <span
              className="inline-block"
              style={{
                background: "linear-gradient(90deg, #4B63F6 0%, #30A6F8 50%, #1664E8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              every day.
            </span>
          </h1>

          {/* Subtext */}
          <p className="mt-3.5 lg:mt-4 text-[14px] sm:text-[15px] lg:text-[15.5px] leading-relaxed text-[#5F6368] max-w-xl">
            Check in for the day, log what you built in each slot, pick up your sprint tasks and carry an approved gate pass on your phone — without a single spreadsheet.
          </p>

          {/* Feature Badges List */}
          <div className="mt-6 lg:mt-8 space-y-4 lg:space-y-4.5">
            {/* 1. Missed OTP Attendance */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 sm:h-13 sm:w-13 lg:h-12.5 lg:w-12.5 shrink-0 items-center justify-center rounded-2xl bg-[#E8F0FE] text-[#1A73E8] shadow-xs">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9.5" />
                  <polyline points="12 6.5 12 12 15.5 14" />
                </svg>
              </div>
              <div className="pt-0.5">
                <h2 className="text-[15px] sm:text-[16px] font-bold text-[#202124]">Missed OTP Attendance</h2>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#5F6368]">Seven trackable hours a day, with your own live percentage.</p>
              </div>
            </div>

            {/* 2. Slot-by-slot worklogs */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 sm:h-13 sm:w-13 lg:h-12.5 lg:w-12.5 shrink-0 items-center justify-center rounded-2xl bg-[#FCE8E6] text-[#EA4335] shadow-xs">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              </div>
              <div className="pt-0.5">
                <h2 className="text-[15px] sm:text-[16px] font-bold text-[#202124]">Slot-by-slot worklogs</h2>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#5F6368]">Four required slots and an optional extra, reviewed by your mentor.</p>
              </div>
            </div>

            {/* 3. Gate passes */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 sm:h-13 sm:w-13 lg:h-12.5 lg:w-12.5 shrink-0 items-center justify-center rounded-2xl bg-[#FEF7E0] text-[#F29900] shadow-xs">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3z" />
                  <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
                </svg>
              </div>
              <div className="pt-0.5">
                <h2 className="text-[15px] sm:text-[16px] font-bold text-[#202124]">Gate passes that actually work</h2>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#5F6368]">Request, get approved, show the signed slip at the gate.</p>
              </div>
            </div>

            {/* 4. Analytics */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 sm:h-13 sm:w-13 lg:h-12.5 lg:w-12.5 shrink-0 items-center justify-center rounded-2xl bg-[#E6F4EA] text-[#34A853] shadow-xs">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="14" width="3.5" height="7" rx="1" />
                  <rect x="9" y="10" width="3.5" height="11" rx="1" />
                  <rect x="15" y="6" width="3.5" height="15" rx="1" />
                  <rect x="21" y="2" width="3.5" height="19" rx="1" />
                </svg>
              </div>
              <div className="pt-0.5">
                <h2 className="text-[15px] sm:text-[16px] font-bold text-[#202124]">Analytics for mentors</h2>
                <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#5F6368]">Cohort health, flagged logs and pending approvals in one console.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column / Mobile Main: Floating Auth Card (lg:col-span-5) */}
        <div className="flex justify-center lg:justify-end lg:col-span-5 w-full">
          <div className="w-full max-w-[440px] lg:max-w-[460px] rounded-[28px] sm:rounded-[30px] border border-[#E8EAED] bg-white p-6 sm:p-8 lg:p-9 shadow-[0_20px_50px_-12px_rgba(60,64,67,0.08),0_0_1px_rgba(60,64,67,0.1)]">
            <div className="text-center">
              <h2 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#202124]">Log in</h2>
              <p className="mt-1 text-[13px] sm:text-[13.5px] text-[#5F6368]">Log in for productivity, collaboration</p>
            </div>

            <Suspense fallback={<div className="py-8 text-center text-xs text-[#5F6368]">Loading log in...</div>}>
              <LoginForm />
            </Suspense>

            <div className="mt-6 text-center space-y-1 text-[11px] sm:text-[11.5px] leading-relaxed text-[#80868B]">
              <p>Trouble logging in? Contact your domain mentor or the DesignSeries office.</p>
              <p>Sessions are signed and expire automatically.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}


