"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export type ParsedAttendanceRow = {
  date: string;
  rollNo: string;
  name: string;
  email: string;
  hour: number;
  reason: string;
  timestamp: string;
  isValid: boolean;
  validationError?: string;
};

export function BulkImportAttendanceModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Normalize header strings to internal keys
  const matchHeader = (header: string): keyof ParsedAttendanceRow | null => {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean === "date" || clean === "attendancedate" || clean === "day") return "date";
    if (clean === "rollnum" || clean === "rollno" || clean === "rollnumber" || clean === "roll" || clean === "regno") return "rollNo";
    if (clean === "name" || clean === "studentname" || clean === "fullname") return "name";
    if (clean === "emailid" || clean === "email" || clean === "mailid" || clean === "mail") return "email";
    if (clean === "hour" || clean === "hr" || clean === "period" || clean === "slot") return "hour";
    if (clean === "reason" || clean === "remarks" || clean === "remark" || clean === "note") return "reason";
    if (clean === "timestamp" || clean === "time" || clean === "datetime" || clean === "submittedat") return "timestamp";
    return null;
  };

  const formatRawDate = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    // Excel serial number like 45574
    if (/^\d{5}$/.test(str)) {
      const excelDate = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      if (!isNaN(excelDate.getTime())) {
        const y = excelDate.getFullYear();
        const m = String(excelDate.getMonth() + 1).padStart(2, "0");
        const d = String(excelDate.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    return str;
  };

  const processJsonRows = (rawRows: Record<string, any>[]): ParsedAttendanceRow[] => {
    const results: ParsedAttendanceRow[] = [];

    for (const raw of rawRows) {
      let date = "";
      let rollNo = "";
      let name = "";
      let email = "";
      let hour = 0;
      let reason = "";
      let timestamp = "";

      for (const [key, value] of Object.entries(raw)) {
        const fieldKey = matchHeader(key);
        if (!fieldKey) continue;

        if (fieldKey === "date") {
          date = formatRawDate(value);
        } else if (fieldKey === "rollNo") {
          rollNo = String(value ?? "").trim().toUpperCase();
        } else if (fieldKey === "name") {
          name = String(value ?? "").trim();
        } else if (fieldKey === "email") {
          email = String(value ?? "").trim().toLowerCase();
        } else if (fieldKey === "hour") {
          const parsedHr = parseInt(String(value ?? "").replace(/\D/g, ""), 10);
          hour = isNaN(parsedHr) ? 0 : parsedHr;
        } else if (fieldKey === "reason") {
          reason = String(value ?? "").trim();
        } else if (fieldKey === "timestamp") {
          timestamp = String(value ?? "").trim();
        }
      }

      // Skip blank rows
      if (!date && !rollNo && !name && !email && !hour) continue;

      let isValid = true;
      let validationError = "";

      if (!rollNo) {
        isValid = false;
        validationError = "Missing Roll Num";
      } else if (!date) {
        isValid = false;
        validationError = "Missing Date";
      } else if (hour < 1 || hour > 7) {
        isValid = false;
        validationError = `Invalid Hour (${hour || "empty"}, must be 1-7)`;
      }

      results.push({
        date,
        rollNo,
        name,
        email,
        hour,
        reason: reason || "Missed OTP Attendance Log",
        timestamp,
        isValid,
        validationError,
      });
    }

    return results;
  };

  // Handle file upload (.xlsx, .xls, .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false });

        if (json.length === 0) {
          setErrorMsg("The selected sheet is empty.");
          setParsedRows([]);
          return;
        }

        const rows = processJsonRows(json);
        if (rows.length === 0) {
          setErrorMsg("Could not detect attendance columns. Please check your headers (Date, Roll Num, Hour, Reason).");
        }
        setParsedRows(rows);
      } catch (err: any) {
        setErrorMsg("Failed to read file: " + (err?.message || "Invalid file format"));
      }
    };

    reader.readAsBinaryString(file);
  };

  // Handle paste directly from Google Sheets
  const handleParsePaste = () => {
    setErrorMsg(null);
    if (!pasteText.trim()) {
      setErrorMsg("Please paste data from your sheet first.");
      return;
    }

    try {
      const lines = pasteText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setErrorMsg("Pasted data must include a header row and at least one data row.");
        return;
      }

      // Check if tab-separated (standard clipboard from Google Sheets) or comma-separated
      const isTab = lines[0].includes("\t");
      const delimiter = isTab ? "\t" : ",";

      const headers = lines[0].split(delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim());

      const rawRows: Record<string, any>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
        const rowObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cols[idx] ?? "";
        });
        rawRows.push(rowObj);
      }

      const rows = processJsonRows(rawRows);
      if (rows.length === 0) {
        setErrorMsg("No valid attendance rows found in pasted text.");
      }
      setParsedRows(rows);
    } catch (err: any) {
      setErrorMsg("Failed to parse pasted data: " + (err?.message || "Unknown error"));
    }
  };

  // Submit bulk import
  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid records", "Please fix errors before importing.");
      return;
    }

    setImporting(true);
    try {
      const payload = {
        records: validRows.map((r) => ({
          date: r.date,
          rollNo: r.rollNo,
          name: r.name,
          email: r.email,
          hour: r.hour,
          reason: r.reason,
          timestamp: r.timestamp || undefined,
        })),
      };

      const res = await fetch("/api/admin/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Import failed", data.error || "Server error");
        setImporting(false);
        return;
      }

      const successCount = data.data.imported;
      const createdUsers = data.data.createdUsers;
      const errCount = data.data.errors?.length || 0;

      let msg = `Successfully logged ${successCount} attendance hour(s).`;
      if (createdUsers > 0) {
        msg += ` (${createdUsers} new student profiles added).`;
      }
      if (errCount > 0) {
        msg += ` ${errCount} rows had errors.`;
      }

      toast.success("Bulk Attendance Imported", msg);
      handleReset();
      onSuccess();
      onClose();
    } catch {
      toast.error("Network error", "Failed to connect to the portal server.");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setFileName("");
    setPasteText("");
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Download Sample Template matching user's sheet exactly
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        "Date": "2026-10-09",
        "Roll Num": "7376252AL177",
        "Name": "NIROOPA K",
        "Email Id": "niroopak.al25@bitsathy.ac.in",
        "Hour": 3,
        "Reason": "Went to slot 11 20 to 12 20 and mapped to lab",
        "Timestamp": "2026-10-09 19:40:49",
      },
      {
        "Date": "2026-10-09",
        "Roll Num": "7376252AL177",
        "Name": "NIROOPA K",
        "Email Id": "niroopak.al25@bitsathy.ac.in",
        "Hour": 4,
        "Reason": "Went to slot 11 20 to 12 20 and mapped to lab",
        "Timestamp": "2026-10-09 19:40:49",
      },
      {
        "Date": "2026-10-09",
        "Roll Num": "7376242IT349",
        "Name": "YOGAVARSHINI S K",
        "Email Id": "yogavarshinisk.it24@bitsathy.ac.in",
        "Hour": 3,
        "Reason": "Mapped to pbl",
        "Timestamp": "2026-10-09 20:06:27",
      },
      {
        "Date": "2026-10-09",
        "Roll Num": "7376242IT349",
        "Name": "YOGAVARSHINI S K",
        "Email Id": "yogavarshinisk.it24@bitsathy.ac.in",
        "Hour": 4,
        "Reason": "Mapped to pbl",
        "Timestamp": "2026-10-09 20:06:27",
      },
      {
        "Date": "2026-10-09",
        "Roll Num": "7376242AD230",
        "Name": "NANDITA A K",
        "Email Id": "nanditaak.ad24@bitsathy.ac.in",
        "Hour": 1,
        "Reason": "Activity Assigned To Another Venue",
        "Timestamp": "2026-10-09 21:33:02",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Missed OTP Attendance");
    XLSX.writeFile(wb, "Missed_OTP_Attendance_Template.xlsx");
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;
  const uniqueStudents = new Set(parsedRows.map((r) => r.rollNo)).size;
  const uniqueDates = new Set(parsedRows.map((r) => r.date)).size;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Import Missed OTP Attendance"
      description="Upload Excel (.xlsx/.xls), CSV, or paste cells copied straight from Google Sheets."
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon="download"
            onClick={handleDownloadTemplate}
          >
            Download Template (.xlsx)
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                handleReset();
                onClose();
              }}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon="upload"
              disabled={validCount === 0 || importing}
              loading={importing}
              onClick={handleImport}
            >
              {importing ? "Importing…" : `Import ${validCount} Record${validCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--line-soft)" }}>
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === "file"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
            }`}
          >
            <Icon name="upload" className="h-3.5 w-3.5" />
            Upload File (.xlsx / .csv)
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === "paste"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
            }`}
          >
            <Icon name="clipboard" className="h-3.5 w-3.5" />
            Paste from Sheet
          </button>
        </div>

        {/* File Upload Mode */}
        {mode === "file" && (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface-inset)]"
              style={{ borderColor: "var(--line-default)", background: "var(--surface-raised)" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon name="upload" className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-[var(--text-strong)]">
                {fileName ? fileName : "Click or drag your spreadsheet here"}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Supports Excel (.xlsx, .xls) and CSV with headers: <code>Date</code>, <code>Roll Num</code>, <code>Hour</code>, <code>Reason</code>
              </p>
            </div>
          </div>
        )}

        {/* Paste from Google Sheets Mode */}
        {mode === "paste" && (
          <div className="space-y-3">
            <textarea
              rows={5}
              placeholder="Select rows in Google Sheets (including header: Date, Roll Num, Name, Email Id, Hour, Reason, Timestamp) and paste (Ctrl+V) here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full rounded-xl border p-3 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
              style={{
                borderColor: "var(--line-default)",
                background: "var(--surface-raised)",
                color: "var(--text-strong)",
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPasteText("")}
                disabled={!pasteText}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon="check"
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
              >
                Parse Data
              </Button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <Icon name="alert" className="h-4 w-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Preview Summary Bar */}
        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-xs" style={{ borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--text-strong)]">Preview:</span>
                <Badge tone="blue">{parsedRows.length} rows</Badge>
                <Badge tone="green">{validCount} ready</Badge>
                {invalidCount > 0 && <Badge tone="red">{invalidCount} issues</Badge>}
                <Badge tone="slate">{uniqueStudents} students</Badge>
                <Badge tone="slate">{uniqueDates} dates</Badge>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-semibold text-[var(--text-muted)] hover:underline"
              >
                Clear data
              </button>
            </div>

            {/* Scrollable Preview Table */}
            <div className="max-h-[300px] overflow-auto rounded-xl border" style={{ borderColor: "var(--line-soft)" }}>
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10" style={{ background: "var(--surface-raised)" }}>
                  <tr className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                    <th className="p-2 font-semibold text-[var(--text-muted)]">#</th>
                    <th className="p-2 font-semibold text-[var(--text-muted)]">Date</th>
                    <th className="p-2 font-semibold text-[var(--text-muted)]">Roll Num</th>
                    <th className="p-2 font-semibold text-[var(--text-muted)]">Name</th>
                    <th className="p-2 font-semibold text-[var(--text-muted)] text-center">Hour</th>
                    <th className="p-2 font-semibold text-[var(--text-muted)]">Reason</th>
                    <th className="p-2 font-semibold text-[var(--text-muted)]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isValid ? "hover:bg-[var(--surface-inset)]" : "bg-red-50/40 dark:bg-red-950/20"}
                    >
                      <td className="p-2 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="p-2 font-medium text-[var(--text-strong)] whitespace-nowrap">{row.date || "—"}</td>
                      <td className="p-2 font-mono text-[var(--accent)] font-semibold whitespace-nowrap">{row.rollNo || "—"}</td>
                      <td className="p-2 text-[var(--text-strong)] max-w-[140px] truncate">{row.name || "—"}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent)]">
                          {row.hour || "?"}
                        </span>
                      </td>
                      <td className="p-2 text-[var(--text-muted)] max-w-[200px] truncate" title={row.reason}>
                        {row.reason}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Icon name="check" className="h-3 w-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400" title={row.validationError}>
                            <Icon name="alert" className="h-3 w-3" />
                            {row.validationError}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
