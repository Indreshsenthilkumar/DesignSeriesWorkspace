"use client";

import { useRouter } from "next/navigation";

import { WorklogReview, type ReviewRow } from "./WorklogReview";
import { WorklogMonthlyGrid, type GridRow } from "./WorklogMonthlyGrid";

export function WorklogConsoleShell({
  view,
  month,
  reviewLogs,
  gridRows,
  options,
  filters,
}: {
  view: "list" | "grid";
  month: string;
  reviewLogs: ReviewRow[];
  gridRows: GridRow[];
  options: { domains: string[]; years: string[] };
  filters: { status: string; domain: string; year: string; date: string };
}) {
  const router = useRouter();

  const setView = (v: "list" | "grid") => {
    const qs = new URLSearchParams(filters as unknown as Record<string, string>);
    qs.set("view", v);
    if (v === "grid") qs.set("month", month);
    router.push(`/console/worklogs?${qs.toString()}`);
  };

  const setMonth = (m: string) => {
    const qs = new URLSearchParams(filters as unknown as Record<string, string>);
    qs.set("view", "grid");
    qs.set("month", m);
    router.push(`/console/worklogs?${qs.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* View toggle */}
      <div
        className="flex w-fit items-center gap-0.5 rounded-[10px] p-1"
        style={{ background: "var(--surface-sunken)", border: "1px solid var(--line-soft)" }}
      >
        <ToggleBtn active={view === "list"} onClick={() => setView("list")} icon="☰" label="List view" />
        <ToggleBtn active={view === "grid"} onClick={() => setView("grid")} icon="▦" label="Monthly grid" />
      </div>

      {view === "grid" ? (
        <WorklogMonthlyGrid rows={gridRows} month={month} onMonthChange={setMonth} />
      ) : (
        <WorklogReview logs={reviewLogs} options={options} filters={filters} />
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-all"
      style={{
        background: active ? "var(--surface-raised)" : "transparent",
        color: active ? "var(--text-strong)" : "var(--text-muted)",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        border: active ? "1px solid var(--line-soft)" : "1px solid transparent",
      }}
    >
      <span className="text-[13px]">{icon}</span>
      {label}
    </button>
  );
}
