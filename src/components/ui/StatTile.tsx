import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";
import type { Tone } from "./Badge";

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
        className="absolute inset-y-0 left-0 w-[4.5px] rounded-l-[20px]"
        style={{ background: "var(--tone)" }}
      />

      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[12px] font-bold uppercase tracking-[0.06em]"
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

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span
          className="text-[32px] sm:text-[34px] font-extrabold leading-none tabular-nums"
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
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 min-w-0">
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
    </>
  );

  const classes = cn(
    "surface group relative block rounded-[20px] border border-[var(--line-default)] p-5 pl-5.5 min-w-0 w-full overflow-hidden transition-all duration-200 shadow-card hover:shadow-raised hover:-translate-y-0.5",
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
