"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface FilterOption {
  label: string;
  value: string;
}

export interface SectionFilter {
  id: string;
  label: string;
  icon?: IconName;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface GmailSectionSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  filters?: SectionFilter[];
  totalResults?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  onClearAll?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

/**
 * Unified Gmail-Style Advanced Search & Filter Experience.
 *
 * Desktop (`md:flex`): Standard horizontal toolbar with inline inputs and select dropdowns.
 * Mobile (`md:hidden`): Gmail mobile pill search bar + horizontal scrollable filter chips
 * that open thumb-friendly bottom sheets instead of clunky stacked select elements.
 */
export function GmailSectionSearch({
  searchQuery,
  onSearchChange,
  placeholder = "Search...",
  filters = [],
  totalResults,
  onRefresh,
  refreshing = false,
  onClearAll,
  hasActiveFilters = false,
  className,
}: GmailSectionSearchProps) {
  const [activeModalFilter, setActiveModalFilter] = useState<SectionFilter | null>(null);

  const activeFiltersCount = filters.filter((f) => f.value !== "all" && f.value !== "ALL").length;

  return (
    <div className={cn("w-full", className)}>
      {/* =================================================================== */}
      {/* 1. MOBILE GMAIL-STYLE SEARCH & FILTER (md:hidden)                  */}
      {/* =================================================================== */}
      <div className="md:hidden flex flex-col gap-2">
        {/* Gmail Floating Search Pill */}
        <div
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-full border px-3 shadow-xs transition-all",
            "border-[var(--line-default)] bg-[var(--surface-raised)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]/20"
          )}
        >
          <Icon name="search" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[13.5px] text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh records"
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-inset)] active:scale-95 transition-all",
                refreshing && "[&_svg]:animate-spin text-[var(--accent)]"
              )}
            >
              <Icon name="refresh" className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Gmail Horizontal Scrollable Filter Chips Strip */}
        {filters.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {filters.map((filter) => {
              const isDefault = filter.value === "all" || filter.value === "ALL";
              const selectedOption = filter.options.find((o) => o.value === filter.value);
              const chipLabel = isDefault
                ? filter.label
                : selectedOption?.label || filter.value;

              return (
                <div key={filter.id} className="relative shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveModalFilter(filter)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all select-none",
                      !isDefault
                        ? "bg-[var(--color-brand-blue)] text-white shadow-xs"
                        : "bg-[var(--surface-raised)] text-[var(--text-default)] border border-[var(--line-default)] hover:bg-[var(--surface-inset)]"
                    )}
                  >
                    {filter.icon ? (
                      <Icon
                        name={filter.icon}
                        className={cn("h-3.5 w-3.5", !isDefault ? "text-white" : "text-[var(--text-muted)]")}
                      />
                    ) : null}
                    <span className="truncate max-w-[140px]">{chipLabel}</span>
                    <Icon
                      name="chevron-down"
                      className={cn("h-3 w-3 shrink-0", !isDefault ? "text-white/80" : "text-[var(--text-faint)]")}
                    />
                  </button>

                  {/* Quick clear button on active chip */}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        filter.onChange("all");
                      }}
                      aria-label={`Reset ${filter.label}`}
                      className="-ml-1 mr-0.5 grid h-4 w-4 place-items-center rounded-full bg-white/20 text-white hover:bg-white/30"
                    >
                      <Icon name="close" className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Clear All Chip */}
            {hasActiveFilters && onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="flex shrink-0 items-center gap-1 rounded-full border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100"
              >
                <Icon name="close" className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Counter Strip */}
        {totalResults !== undefined && (
          <div className="flex items-center justify-between px-1 text-[11.5px] text-[var(--text-muted)]">
            <span>
              Showing <strong className="text-[var(--text-strong)]">{totalResults}</strong>{" "}
              {totalResults === 1 ? "record" : "records"}
            </span>
            {activeFiltersCount > 0 ? (
              <span className="font-semibold text-[var(--color-brand-blue)]">
                {activeFiltersCount} {activeFiltersCount === 1 ? "filter" : "filters"} applied
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. DESKTOP TOOLBAR (md:flex)                                        */}
      {/* =================================================================== */}
      <div className="hidden md:flex surface p-3.5 sm:p-4 rounded-[14px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[220px] lg:min-w-[260px]">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--text-strong)] placeholder-[var(--text-faint)] transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface-raised)] focus:outline-none"
            />
          </div>

          {/* Desktop Select Dropdowns */}
          {filters.map((filter) => (
            <div key={filter.id} className="relative">
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="appearance-none rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-3 pr-7 text-[12.5px] font-medium text-[var(--text-default)] transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:outline-none cursor-pointer max-w-[190px] truncate"
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Icon
                name="chevron-down"
                className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-faint)]"
              />
            </div>
          ))}

          {/* Clear All */}
          {hasActiveFilters && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)] hover:text-red-600 transition-colors cursor-pointer"
            >
              <Icon name="close" className="h-3 w-3" />
              Clear All
            </button>
          )}
        </div>

        {/* Right Action: Counter & Refresh Button */}
        <div className="flex items-center gap-3">
          {totalResults !== undefined && (
            <span className="text-[12px] text-[var(--text-muted)]">
              Showing <span className="font-semibold text-[var(--text-strong)]">{totalResults}</span>{" "}
              {totalResults === 1 ? "record" : "records"}
            </span>
          )}

          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={onRefresh}
              disabled={refreshing}
              className={refreshing ? "[&_svg]:animate-spin" : ""}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. MOBILE FILTER BOTTOM-SHEET / MODAL DIALOG                        */}
      {/* =================================================================== */}
      {activeModalFilter && (
        <Modal
          open={Boolean(activeModalFilter)}
          onClose={() => setActiveModalFilter(null)}
          title={`Filter by ${activeModalFilter.label}`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  activeModalFilter.onChange("all");
                  setActiveModalFilter(null);
                }}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveModalFilter(null)}
              >
                Done
              </Button>
            </div>
          }
        >
          <div className="space-y-1 py-1 max-h-[50vh] overflow-y-auto">
            {activeModalFilter.options.map((option) => {
              const isSelected = activeModalFilter.value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    activeModalFilter.onChange(option.value);
                    setActiveModalFilter(null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[10px] px-3.5 py-3 text-left text-[14px] transition-colors",
                    isSelected
                      ? "bg-[var(--color-brand-blue-050)] text-[var(--color-brand-blue)] font-bold dark:bg-[var(--color-brand-blue-950)] dark:text-[var(--color-brand-blue-300)]"
                      : "text-[var(--text-strong)] hover:bg-[var(--surface-inset)] font-normal"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Icon name="check" className="h-4 w-4 shrink-0 text-[var(--color-brand-blue)]" />
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
