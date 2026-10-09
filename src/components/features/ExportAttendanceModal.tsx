"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { toCsv } from "@/lib/utils";

export type ExportColumnKey =
  | "date"
  | "rollNo"
  | "name"
  | "email"
  | "hour"
  | "status"
  | "reason"
  | "department"
  | "year"
  | "domain"
  | "mentor"
  | "source"
  | "createdAt";

interface ColumnDefinition {
  key: ExportColumnKey;
  label: string;
  category: "Core" | "Student Details" | "System / Audit";
  defaultChecked: boolean;
}

const AVAILABLE_COLUMNS: ColumnDefinition[] = [
  { key: "date", label: "Date", category: "Core", defaultChecked: true },
  { key: "rollNo", label: "Roll Number", category: "Student Details", defaultChecked: true },
  { key: "name", label: "Name", category: "Student Details", defaultChecked: true },
  { key: "email", label: "Email ID", category: "Student Details", defaultChecked: true },
  { key: "hour", label: "Hour", category: "Core", defaultChecked: true },
  { key: "reason", label: "Reason / Task Log", category: "Core", defaultChecked: true },
  { key: "status", label: "Attendance Status", category: "Core", defaultChecked: true },
  { key: "department", label: "Department", category: "Student Details", defaultChecked: false },
  { key: "year", label: "Academic Year", category: "Student Details", defaultChecked: true },
  { key: "domain", label: "Domain / Stream", category: "Student Details", defaultChecked: true },
  { key: "mentor", label: "Mentor Name", category: "Student Details", defaultChecked: false },
  { key: "source", label: "Source", category: "System / Audit", defaultChecked: false },
  { key: "createdAt", label: "Submission Timestamp", category: "System / Audit", defaultChecked: true },
];

export type ExportFormat = "excel" | "pdf" | "csv";

interface ExportAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  defaultFrom: string;
  defaultTo: string;
  currentYear?: string;
  currentDomain?: string;
}

export function ExportAttendanceModal({
  open,
  onClose,
  defaultFrom,
  defaultTo,
  currentYear,
  currentDomain,
}: ExportAttendanceModalProps) {
  const toast = useToast();

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [selectedColumns, setSelectedColumns] = useState<Set<ExportColumnKey>>(
    () => new Set(AVAILABLE_COLUMNS.filter((c) => c.defaultChecked).map((c) => c.key))
  );
  const [exporting, setExporting] = useState(false);

  const toggleColumn = (key: ExportColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) {
          toast.warning("At least one column required", "You cannot deselect all columns.");
          return prev;
        }
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedColumns(new Set(AVAILABLE_COLUMNS.map((c) => c.key)));
  };

  const selectDefaults = () => {
    setSelectedColumns(new Set(AVAILABLE_COLUMNS.filter((c) => c.defaultChecked).map((c) => c.key)));
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast.warning("No columns selected", "Please choose at least one column to export.");
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
      });
      if (currentYear && currentYear !== "ALL") params.set("year", currentYear);
      if (currentDomain && currentDomain !== "ALL") params.set("domain", currentDomain);

      const res = await fetch(`/api/console/attendance/export?${params.toString()}`);
      const payload = await res.json();

      if (!payload.ok) {
        toast.error("Export failed", payload.error || "Could not retrieve records.");
        setExporting(false);
        return;
      }

      const records: Record<string, any>[] = payload.data.records || [];
      if (records.length === 0) {
        toast.warning("No records found", `No attendance entries found between ${from} and ${to}.`);
        setExporting(false);
        return;
      }

      // Filter and arrange columns in specified order
      const orderedCols = AVAILABLE_COLUMNS.filter((col) => selectedColumns.has(col.key));
      const headers = orderedCols.map((c) => c.label);
      const rowsData = records.map((record) => orderedCols.map((col) => record[col.key] ?? ""));

      const filenameBase = `missed-otp-attendance-${from}-to-${to}`;

      if (format === "excel") {
        // Format as Excel (.xlsx)
        const sheetData = [headers, ...rowsData];
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Auto-fit column widths
        const colWidths = headers.map((header, idx) => {
          const maxLen = Math.max(
            header.length,
            ...records.map((r) => String(r[orderedCols[idx].key] ?? "").length)
          );
          return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
        });
        worksheet["!cols"] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
        XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
      } else if (format === "pdf") {
        // Format as PDF (.pdf)
        const doc = new jsPDF({
          orientation: orderedCols.length > 6 ? "landscape" : "portrait",
          unit: "pt",
          format: "a4",
        });

        // Document header styling
        doc.setFontSize(15);
        doc.setTextColor(30, 41, 59);
        doc.text("Missed OTP Attendance Report", 40, 40);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Date Range: ${from} to ${to}  |  Total Records: ${records.length}  |  Generated on: ${new Date().toLocaleString("en-IN")}`,
          40,
          56
        );

        autoTable(doc, {
          startY: 68,
          head: [headers],
          body: rowsData,
          theme: "grid",
          styles: {
            fontSize: 7.5,
            cellPadding: 3.5,
            overflow: "linebreak",
            textColor: [51, 65, 85],
          },
          headStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          margin: { left: 40, right: 40 },
          didDrawPage: (data) => {
            // Footer page numbers
            const pageCount = doc.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(
              `Page ${data.pageNumber} of ${pageCount}`,
              doc.internal.pageSize.width - 80,
              doc.internal.pageSize.height - 20
            );
          },
        });

        doc.save(`${filenameBase}.pdf`);
      } else if (format === "csv") {
        // Format as CSV (.csv)
        const csvContent = toCsv(headers, rowsData);
        const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${filenameBase}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }

      toast.success(
        "Export generated",
        `Downloaded ${records.length} records in ${format.toUpperCase()} format.`
      );
      onClose();
    } catch (err) {
      toast.error("Export failed", "An unexpected error occurred during export generation.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Missed OTP Attendance"
      description="Choose your export format, date range, and customize the columns to include in your report."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[12px] text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">{selectedColumns.size}</span> of{" "}
            {AVAILABLE_COLUMNS.length} columns selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              loading={exporting}
              icon="download"
            >
              {exporting ? "Generating…" : `Download ${format.toUpperCase()}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 py-1">
        {/* 1. Format Selection */}
        <div>
          <label className="block text-[12.5px] font-bold text-[var(--text-strong)] mb-2">
            1. Select Export Format
          </label>
          <div className="grid grid-cols-3 gap-3">
            {/* Excel Option */}
            <button
              type="button"
              onClick={() => setFormat("excel")}
              className={`flex flex-col items-center justify-center p-3.5 rounded-[12px] border text-center transition-all ${
                format === "excel"
                  ? "border-[var(--color-brand-green)] bg-[var(--color-brand-green-050)] shadow-sm ring-2 ring-[var(--color-brand-green)]/20"
                  : "border-[var(--line-default)] bg-[var(--surface-raised)] hover:border-[var(--text-faint)]"
              }`}
            >
              <span className="text-[20px] mb-1">📊</span>
              <span className="text-[13px] font-bold text-[var(--text-strong)]">Excel Workbook</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">.xlsx</span>
            </button>

            {/* PDF Option */}
            <button
              type="button"
              onClick={() => setFormat("pdf")}
              className={`flex flex-col items-center justify-center p-3.5 rounded-[12px] border text-center transition-all ${
                format === "pdf"
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30 shadow-sm ring-2 ring-red-500/20"
                  : "border-[var(--line-default)] bg-[var(--surface-raised)] hover:border-[var(--text-faint)]"
              }`}
            >
              <span className="text-[20px] mb-1">📄</span>
              <span className="text-[13px] font-bold text-[var(--text-strong)]">PDF Document</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">.pdf (Printable)</span>
            </button>

            {/* CSV Option */}
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`flex flex-col items-center justify-center p-3.5 rounded-[12px] border text-center transition-all ${
                format === "csv"
                  ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-050)] shadow-sm ring-2 ring-[var(--color-brand-blue)]/20"
                  : "border-[var(--line-default)] bg-[var(--surface-raised)] hover:border-[var(--text-faint)]"
              }`}
            >
              <span className="text-[20px] mb-1">📁</span>
              <span className="text-[13px] font-bold text-[var(--text-strong)]">CSV File</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">.csv</span>
            </button>
          </div>
        </div>

        {/* 2. Date Range */}
        <div>
          <label className="block text-[12.5px] font-bold text-[var(--text-strong)] mb-2">
            2. Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Date" htmlFor="export-from">
              <Input
                id="export-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="To Date" htmlFor="export-to">
              <Input
                id="export-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* 3. Column Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12.5px] font-bold text-[var(--text-strong)]">
              3. Select Columns to Include
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11.5px] font-semibold text-[var(--accent)] hover:underline"
              >
                Select All
              </button>
              <span className="text-[var(--text-faint)]">•</span>
              <button
                type="button"
                onClick={selectDefaults}
                className="text-[11.5px] font-semibold text-[var(--text-muted)] hover:underline"
              >
                Reset Defaults
              </button>
            </div>
          </div>

          {/* Grouped Columns */}
          <div className="rounded-[12px] border border-[var(--line-default)] bg-[var(--surface-sunken)] p-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {AVAILABLE_COLUMNS.map((col) => {
                const isChecked = selectedColumns.has(col.key);
                return (
                  <label
                    key={col.key}
                    className={`flex items-center gap-2.5 p-2 rounded-[8px] border transition-colors cursor-pointer select-none ${
                      isChecked
                        ? "border-[var(--accent)] bg-[var(--surface-raised)] shadow-xs"
                        : "border-[var(--line-subtle)] bg-[var(--surface-raised)]/40 hover:border-[var(--line-default)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.key)}
                      className="h-4 w-4 rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-[var(--text-strong)] leading-tight">
                        {col.label}
                      </span>
                      <span className="block text-[10px] text-[var(--text-faint)]">
                        {col.category}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
