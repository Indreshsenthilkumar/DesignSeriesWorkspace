import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";
import type { Tone } from "./Badge";

/**
 * Container grid for KPI tiles.
 * On mobile, turns into a smooth horizontal scroll strip (taking only ~85px height
 * instead of eating up half the screen with a 2x2 grid).
 * On desktop/tablet, expands into the standard 2/4-column responsive grid.
 */
export function StatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "stagger mb-3 sm:mb-5 flex overflow-x-auto sm:overflow-visible sm:grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4 scrollbar-none snap-x snap-mandatory pb-1 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * The KPI tile used across the dashboard and all portal sections.
 *
 * Responsive by design:
 * - Mobile (<640px): Ultra-compact 54px horizontal glance pill, saving screen space so
 *   the page content is immediately visible without scrolling.
 * - Desktop (>=640px): Spacious, rich card with clear visual hierarchy, trend delta, and subtle accent.
 */
export function StatTile({
  label,
  value,
  unit,
  icon,
  tone = "blue",
  delta,
  caption,
  href,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: IconName;
  tone?: Tone;
  /** Percentage change vs the previous period. Positive renders green. */
  delta?: number | null;
  caption?: string;
  href?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] sm:w-[4px] rounded-l-[14px] sm:rounded-l-[20px]"
        style={{ background: "var(--tone)" }}
      />

      {/* -------------------------------------------------------------
          1. Mobile View (<640px): Ultra-compact 52px glance tile
          Prevents stats from hogging half the mobile screen
          ------------------------------------------------------------- */}
      <div className="flex sm:hidden flex-col justify-center h-full pl-1.5 py-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider truncate text-[var(--text-muted)]">
            {label}
          </span>
          {icon ? (
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon name={icon} className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[17px] font-extrabold tabular-nums leading-none text-[var(--text-strong)] tracking-tight">
            {value}
          </span>
          {unit ? (
            <span className="text-[10px] font-bold text-[var(--text-muted)]">
              {unit}
            </span>
          ) : null}
          {delta !== undefined && delta !== null ? (
            <span
              data-accent={delta >= 0 ? "green" : "red"}
              className="ml-auto inline-flex items-center rounded-full px-1 py-0.2 text-[9px] font-bold tabular-nums"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              {delta >= 0 ? "+" : ""}{delta}%
            </span>
          ) : caption ? (
            <span className="ml-auto text-[9.5px] font-medium text-[var(--text-faint)] truncate max-w-[70px]">
              {caption}
            </span>
          ) : null}
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. Desktop View (>=640px): Spacious, rich KPI tile
          ------------------------------------------------------------- */}
      <div className="hidden sm:block">
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.05em] truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </p>
          {icon ? (
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon name={icon} className="h-4 w-4" />
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-baseline gap-1.5">
          <span
            className="text-[30px] font-extrabold leading-none tabular-nums"
            style={{ color: "var(--text-strong)", letterSpacing: "-0.035em" }}
          >
            {value}
          </span>
          {unit ? (
            <span className="text-[13px] font-bold" style={{ color: "var(--text-muted)" }}>
              {unit}
            </span>
          ) : null}
        </div>

        {(caption || delta !== undefined) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 min-w-0">
            {delta !== undefined && delta !== null ? (
              <span
                data-accent={delta >= 0 ? "green" : "red"}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shrink-0"
                style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
              >
                <Icon
                  name="arrow-trend"
                  className={cn("h-3 w-3", delta < 0 && "-scale-y-100")}
                />
                {delta >= 0 ? "+" : ""}
                {delta}%
              </span>
            ) : null}
            {caption ? (
              <span className="truncate text-[11.5px] font-medium min-w-0" style={{ color: "var(--text-muted)" }}>
                {caption}
              </span>
            ) : null}
          </div>
        )}

        {footer ? <div className="mt-3">{footer}</div> : null}

        {href ? (
          <Icon
            name="arrow-up-right"
            className="absolute bottom-4 right-4 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: "var(--tone)" }}
          />
        ) : null}
      </div>
    </>
  );

  const classes = cn(
    "surface group relative block rounded-[14px] sm:rounded-[20px] border border-[var(--line-default)]",
    "h-[54px] sm:h-auto",
    "p-2 sm:p-5 sm:pl-5.5",
    "w-[132px] min-w-[125px] shrink-0 sm:w-full sm:max-w-none sm:shrink snap-start",
    "overflow-hidden transition-all duration-200 shadow-card hover:shadow-raised hover:-translate-y-0.5",
    href && "cursor-pointer",
    className
  );

  if (href) {
    return (
      <Link href={href} data-accent={tone} className={classes}>
        {body}
      </Link>
    );
  }

  return (
    <div data-accent={tone} className={classes}>
      {body}
    </div>
  );
}
