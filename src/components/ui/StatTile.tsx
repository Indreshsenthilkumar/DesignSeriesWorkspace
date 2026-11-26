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
        "stagger mb-3.5 sm:mb-5 flex overflow-x-auto sm:overflow-visible sm:grid gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4 scrollbar-none snap-x snap-mandatory pb-1 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0 [&>*]:w-[140px] [&>*]:min-w-[130px] [&>*]:max-w-[155px] [&>*]:shrink-0 sm:[&>*]:w-full sm:[&>*]:min-w-0 sm:[&>*]:max-w-none sm:[&>*]:shrink",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * The KPI tile used across the dashboard and the admin console.
 *
 * A tile always answers three things: what the number is, what it means, and
 * which way it is moving. The accent bar on the left is the only colour, so a
 * row of tiles reads as a set rather than as four competing blocks.
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
        className="absolute inset-y-0 left-0 w-[3.5px] sm:w-[4.5px] rounded-l-[18px] sm:rounded-l-[20px]"
        style={{ background: "var(--tone)" }}
      />

      <div className="flex items-start justify-between gap-1.5 sm:gap-3">
        <p
          className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.05em] truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </p>
        {icon ? (
          <span
            className="grid h-6 w-6 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
          >
            <Icon name={icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
        <span
          className="text-[22px] sm:text-[34px] font-extrabold leading-none tabular-nums"
          style={{ color: "var(--text-strong)", letterSpacing: "-0.035em" }}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-[11px] sm:text-[13px] font-bold" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        ) : null}
      </div>

      {(caption || delta !== undefined) && (
        <div className="mt-1.5 sm:mt-2.5 flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0">
          {delta !== undefined && delta !== null ? (
            <span
              data-accent={delta >= 0 ? "green" : "red"}
              className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tabular-nums shrink-0"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon
                name="arrow-trend"
                className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3", delta < 0 && "-scale-y-100")}
              />
              {delta >= 0 ? "+" : ""}
              {delta}%
            </span>
          ) : null}
          {caption ? (
            <span className="truncate text-[10px] sm:text-[11.5px] font-medium min-w-0" style={{ color: "var(--text-muted)" }}>
              {caption}
            </span>
          ) : null}
        </div>
      )}

      {footer ? <div className="mt-2.5 sm:mt-3">{footer}</div> : null}

      {href ? (
        <Icon
          name="arrow-up-right"
          className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--tone)" }}
        />
      ) : null}
    </>
  );

  const classes = cn(
    "surface group relative block rounded-[18px] sm:rounded-[20px] border border-[var(--line-default)]",
    "p-3 sm:p-5 pl-3.5 sm:pl-5.5",
    "w-full min-w-0 max-w-full snap-start",
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
