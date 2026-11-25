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
    "fixed bottom-[calc(env(safe-area-inset-bottom)+86px)] right-4 z-[45] md:hidden " +
    "group flex h-14 w-14 items-center justify-center rounded-[20px] " +
    "bg-[var(--color-brand-blue,#1a73e8)] text-white " +
    "shadow-[0_8px_24px_rgba(26,115,232,0.45),0_2px_8px_rgba(0,0,0,0.15)] " +
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
