"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

type MobileFABProps = {
  onClick?: () => void;
  href?: string;
  label?: string;
  icon?: typeof Plus;
  className?: string;
};

/**
 * Mobile Floating Action Button (FAB)
 * Floats in the bottom-right corner just above the bottom navigation bar on mobile screens.
 * Hidden on desktop and tablet (md:hidden).
 */
export function MobileFAB({
  onClick,
  href,
  label = "Add new",
  icon: IconComponent = Plus,
  className = "",
}: MobileFABProps) {
  const content = (
    <>
      <IconComponent className="h-7 w-7 text-white stroke-[2.7] transition-transform group-hover:scale-110" />
      <span className="sr-only">{label}</span>
    </>
  );

  const baseClasses =
    "fixed bottom-[calc(env(safe-area-inset-bottom)+68px)] right-4 z-50 md:hidden " +
    "group flex h-13 w-13 items-center justify-center rounded-[18px] " +
    "bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white " +
    "shadow-[0_8px_20px_-2px_rgba(37,99,235,0.45),0_2px_8px_rgba(0,0,0,0.12)] " +
    "hover:brightness-105 active:scale-90 transition-all duration-150 cursor-pointer pointer-events-auto " +
    className;

  if (href) {
    return (
      <Link href={href} aria-label={label} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={baseClasses}
    >
      {content}
    </button>
  );
}
