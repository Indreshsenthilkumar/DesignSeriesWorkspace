"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export type ParsedUserRow = {
  name: string;
  rollNo: string;
  email: string;
  department: string;
  year: string;
  mobile: string;
  domain: string;
  mentorName: string;
  gender?: string;
  legend?: string;
  designation?: string;
  linkedin: string;
  github: string;
  role: string;
};

export function BulkImportUsersModal({
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
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Normalize header strings to internal keys
  const matchHeader = (header: string): keyof ParsedUserRow | null => {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean === "name" || clean === "studentname" || clean === "fullname") return "name";
    if (clean === "rollnum" || clean === "rollno" || clean === "rollnumber" || clean === "roll") return "rollNo";
    if (clean === "emailid" || clean === "email" || clean === "mailid" || clean === "collegeemail") return "email";
    if (clean === "department" || clean === "dept" || clean === "branch") return "department";
    if (clean === "year" || clean === "batch" || clean === "yearbatch") return "year";
    if (clean === "mobilenumber" || clean === "mobile" || clean === "phone" || clean === "phonenumber") return "mobile";
    if (clean === "domain" || clean === "domaintrack") return "domain";
    if (clean === "gender" || clean === "sex") return "gender";
    if (clean === "legend" || clean === "title" || clean === "salutation") return "legend";
    if (clean === "designation" || clean === "facultydesignation") return "designation";
    if (clean === "mentorname" || clean === "mentor" || clean === "assignedmentor") return "mentorName";
    if (clean === "linkedin" || clean === "linkedinprofile" || clean === "linkedinurl") return "linkedin";
    if (clean === "github" || clean === "githubprofile" || clean === "githuburl") return "github";
    if (clean === "role" || clean === "accountrole") return "role";
    return null;
  };

  const processJsonRows = (rawRows: Record<string, any>[]): ParsedUserRow[] => {
    const results: ParsedUserRow[] = [];

    for (const raw of rawRows) {
      const mapped: ParsedUserRow = {
        name: "",
        rollNo: "",
        email: "",
        department: "",
        year: "",
        mobile: "",
        domain: "Data not Feeded",
        mentorName: "",
        gender: "",
        legend: "",
        designation: "",
        linkedin: "",
        github: "",
        role: "Student",
      };

      for (const [key, value] of Object.entries(raw)) {
        const fieldKey = matchHeader(key);
        if (fieldKey) {
          mapped[fieldKey] = String(value ?? "").trim();
        }
      }

      // Only include rows that have at least a Name, Roll Number, or Email
      if (mapped.name || mapped.rollNo || mapped.email) {
        // Default role to Student if empty
        if (!mapped.role) mapped.role = "Student";
        results.push(mapped);
      }
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

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (json.length === 0) {
          setErrorMsg("The selected sheet is empty. Please check your file.");
          setParsedRows([]);
          return;
        }

        const rows = processJsonRows(json);
        if (rows.length === 0) {
          setErrorMsg("Could not detect any valid user rows. Please ensure your sheet has headers like Name, Roll Num, Email Id.");
        }
        setParsedRows(rows);
      } catch (err: any) {
        setErrorMsg("Failed to read the file. Please ensure it is a valid Excel or CSV file.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle copy & paste text directly from spreadsheet
  const handlePasteParse = () => {
    setErrorMsg(null);
    if (!pasteText.trim()) {
      setErrorMsg("Please paste some spreadsheet data first.");
      return;
    }

    try {
      const workbook = XLSX.read(pasteText, { type: "string" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (json.length === 0) {
        setErrorMsg("Could not parse pasted data. Please copy rows directly including the header row.");
        setParsedRows([]);
        return;
      }

      const rows = processJsonRows(json);
      if (rows.length === 0) {
        setErrorMsg("Could not detect user records. Ensure your header row includes Name, Roll Num, and Email Id.");
      }
      setParsedRows(rows);
    } catch {
      setErrorMsg("Failed to parse pasted data. Try uploading the sheet as a CSV or Excel file instead.");
    }
  };

  // Download sample template matching user's exact spreadsheet
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Name": "RHYTHAN U T",
        "Roll Num": "7376242AD272",
        "Email Id": "rhythanut.ad24@bitsathy.ac.in",
        "Department": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "Year": "2024-28 - III - BYTS - Male",
        "Mobile number": "6381272253",
        "Domain": "Smart Marketing Tools & Automation",
        "Mentor Name": "RAGHUNATH M - MC1041",
        "Linkedin": "https://linkedin.com/in/rhythan",
        "GitHub": "https://github.com/rhythan",
        "Role": "Student",
      },
      {
        "Name": "PRIYA S",
        "Roll Num": "7376242CS105",
        "Email Id": "priyas.cs24@bitsathy.ac.in",
        "Department": "COMPUTER SCIENCE AND ENGINEERING",
        "Year": "2024-28 - II - BYTS - Female",
        "Mobile number": "9876543210",
        "Domain": "Full Stack Development",
        "Mentor Name": "Dr. Sarah Jenkins - Lead Architect",
        "Linkedin": "https://linkedin.com/in/priya",
        "GitHub": "https://github.com/priya",
        "Role": "Student + Admin",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "designseries-users-template.xlsx");
  };

  // Submit bulk users to backend
  const handleImport = async () => {
    if (parsedRows.length === 0) {
      toast.warning("No rows to import", "Please upload a sheet or paste rows first.");
      return;
    }

    setImporting(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: parsedRows }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to import users.");
      }

      const { created, updated, total, errors } = payload.data;

      toast.success(
        `Import Complete!`,
        `Successfully processed ${total} users (${created} added, ${updated} updated).`
      );

      if (errors && errors.length > 0) {
        toast.warning(
          `${errors.length} rows had issues`,
          `Check console or review records with invalid emails.`
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during import.");
    } finally {
      setImporting(false);
    }
  };

  const validRowCount = parsedRows.filter((r) => r.name && r.rollNo && r.email).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Import Users from Sheet"
      description="Upload your Google Sheet export (.xlsx, .csv) or paste rows directly. New accounts will be created and existing users will be updated."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            loading={importing}
            disabled={parsedRows.length === 0 || validRowCount === 0}
            icon="upload"
          >
            Import {validRowCount > 0 ? `${validRowCount} Users` : "Users"} to Database
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Selection & Template Download */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3 border-[var(--line-soft)]">
          <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
            <button
              type="button"
              onClick={() => setMode("file")}
              className="flex items-center gap-1.5 h-7 rounded-[8px] px-3 text-[12px] font-semibold transition-colors"
              style={{
                background: mode === "file" ? "var(--accent-soft)" : "transparent",
                color: mode === "file" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              Upload Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className="flex items-center gap-1.5 h-7 rounded-[8px] px-3 text-[12px] font-semibold transition-colors"
              style={{
                background: mode === "paste" ? "var(--accent-soft)" : "transparent",
                color: mode === "paste" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Icon name="clipboard" className="h-3.5 w-3.5" />
              Copy & Paste from Sheet
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-blue)] hover:underline"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
            Download Excel Template
          </button>
        </div>

        {/* Mode 1: File Upload */}
        {mode === "file" ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line-default)] bg-[var(--surface-inset)] p-8 text-center cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-brand-blue-050)] text-[var(--color-brand-blue)]">
                <Icon name="upload" className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-bold text-[var(--text-strong)]">
                {fileName ? fileName : "Click to choose your Google Sheet (.xlsx / .csv)"}
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] max-w-md">
                In Google Sheets, go to <span className="font-semibold text-[var(--text-strong)]">File → Download → Microsoft Excel (.xlsx)</span> or <span className="font-semibold text-[var(--text-strong)]">CSV</span>, then drop it here.
              </p>
            </div>
          </div>
        ) : (
          /* Mode 2: Paste Rows */
          <div className="space-y-2">
            <p className="text-[11.5px] text-[var(--text-muted)]">
              Select cells in Google Sheets including the top header row, press <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono">Ctrl+C</kbd>, then paste below:
            </p>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Name	Roll Num	Email Id	Department	Year	Mobile number	Domain	Mentor Name	Linkedin	GitHub	Role&#10;RHYTHAN U T	7376242AD272	rhythanut.ad24@bitsathy.ac.in	AIDS	2024-28	6381272253	UI/UX	RAGHUNATH M	https://...	...	Student"
              className="w-full font-mono text-[11px] rounded-lg border border-[var(--line-default)] bg-[var(--surface-inset)] p-3 text-[var(--text-strong)] focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={handlePasteParse}>
                Parse Pasted Rows
              </Button>
            </div>
          </div>
        )}

        {/* Live Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[var(--text-strong)]">
                  Preview ({parsedRows.length} {parsedRows.length === 1 ? "record" : "records"} found)
                </span>
                <Badge tone="green" dot>
                  {validRowCount} Ready to Import
                </Badge>
                {parsedRows.length - validRowCount > 0 && (
                  <Badge tone="red">
                    {parsedRows.length - validRowCount} Missing Required Fields
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-[var(--text-faint)]">
                Showing top 5 rows
              </span>
            </div>

            <div className="max-h-[220px] overflow-auto rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)]">
              <table className="w-full text-left text-[11.5px]">
                <thead className="sticky top-0 bg-[var(--surface-inset)] border-b border-[var(--line-default)] text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Roll No</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Domain</th>
                    <th className="py-2 px-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {parsedRows.slice(0, 5).map((row, idx) => {
                    const isValid = Boolean(row.name && row.rollNo && row.email);
                    return (
                      <tr key={idx} className={!isValid ? "bg-rose-500/5 text-rose-600" : ""}>
                        <td className="py-2 px-3 text-[var(--text-faint)]">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-[var(--text-strong)]">{row.name || "—"}</td>
                        <td className="py-2 px-3 font-mono">{row.rollNo || "—"}</td>
                        <td className="py-2 px-3 text-[var(--text-muted)]">{row.email || "—"}</td>
                        <td className="py-2 px-3 truncate max-w-[140px]">{row.department || "—"}</td>
                        <td className="py-2 px-3 truncate max-w-[120px]">{row.domain || "—"}</td>
                        <td className="py-2 px-3">
                          <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 font-medium text-[10.5px]">
                            {row.role}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] italic">
              * Users will be able to log in immediately using their email and Roll Number as the default password.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
