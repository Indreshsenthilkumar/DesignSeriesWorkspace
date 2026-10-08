export const LEAVE_TYPES = [
  "Emergency Leave",
  "OnDuty - Events",
  "OnDuty - Project Competition",
  "OnDuty - Internship",
  "OnDuty - Paper Presenation",
  "OnDuty - Technical Competition",
  "OnDuty - NSS/NCC",
  "OnDuty - Sports",
  "OnDuty - NPTEL Exam",
  "OnDuty - Offcampus Placement",
  "Onduty - Training Course",
  "Onduty - Govt Exams",
  "GP",
  "OnDuty - Clubs",
  "Leave",
  "Sick Leave",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export type LeaveFieldGroup = "REASON_ONLY" | "REMARKS_VENUE" | "REMARKS_COMPANY" | "REMARKS_VENUE_COMPANY";

export function getLeaveFieldGroup(type: string): LeaveFieldGroup {
  switch (type) {
    case "OnDuty - NSS/NCC":
    case "OnDuty - Sports":
    case "OnDuty - NPTEL Exam":
      return "REMARKS_VENUE";

    case "OnDuty - Events":
    case "OnDuty - Project Competition":
    case "OnDuty - Internship":
    case "OnDuty - Paper Presenation":
    case "OnDuty - Technical Competition":
      return "REMARKS_COMPANY";

    case "OnDuty - Offcampus Placement":
    case "Onduty - Training Course":
      return "REMARKS_VENUE_COMPANY";

    case "Leave":
    case "Sick Leave":
    case "Emergency Leave":
    case "Onduty - Govt Exams":
    case "GP":
    case "OnDuty - Clubs":
    default:
      return "REASON_ONLY";
  }
}

/** Compute human-friendly duration between two ISO / datetime-local strings. */
export function calculateDuration(fromStr: string, toStr: string): string {
  try {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const diffMs = to.getTime() - from.getTime();
    if (diffMs <= 0) return "0 hours";

    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.ceil(diffHours / 24);

    if (diffHours < 24) {
      const wholeHours = Math.floor(diffHours);
      const mins = Math.round((diffHours - wholeHours) * 60);
      if (mins === 0) return `${wholeHours} hour${wholeHours === 1 ? "" : "s"}`;
      return `${wholeHours}h ${mins}m`;
    }

    return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  } catch {
    return "";
  }
}

/** Formats a datetime string into 'MMM DD, YYYY, hh:mm A' (e.g. Sep 24, 2026, 08:00 AM). */
export function formatLeaveDateTime(val?: string | null): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return val;
  }
}

export function isLeaveTypeOnDuty(type: string): boolean {
  return type.toLowerCase().startsWith("onduty") || type.toLowerCase().startsWith("on duty");
}
