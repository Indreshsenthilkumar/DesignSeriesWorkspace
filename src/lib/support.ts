import { Prisma } from "@prisma/client";

export type TicketCategory =
  | "DASHBOARD"
  | "MISSED_OTP"
  | "WORKLOG"
  | "TASK"
  | "ACCOUNT"
  | "AUTH"
  | "TECHNICAL"
  | "GENERAL"
  | "OTHER";

export type TicketModule =
  | "DASHBOARD"
  | "ATTENDANCE"
  | "WORKLOG"
  | "TASKS"
  | "PROFILE"
  | "GENERAL"
  | "OTHER";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_STUDENT"
  | "RESOLVED"
  | "CLOSED";

export const CATEGORIES_CONFIG: Record<
  TicketCategory,
  {
    label: string;
    description: string;
    module: TicketModule;
    subcategories: string[];
  }
> = {
  DASHBOARD: {
    label: "Dashboard Issues",
    description: "Statistics mismatch, missing tiles, synchronization or visual errors on your overview.",
    module: "DASHBOARD",
    subcategories: [
      "Streak count incorrect",
      "Stats / charts mismatch",
      "Attendance percentage difference",
      "Loading or display error",
      "Other dashboard issue",
    ],
  },
  MISSED_OTP: {
    label: "Missed OTP / Attendance",
    description: "Logged hour discrepancies, missed OTP submissions, cutoffs, or verification queries.",
    module: "ATTENDANCE",
    subcategories: [
      "Logged hours not reflected",
      "Missed OTP check-in blocked",
      "Cutoff time missed due to technical glitch",
      "Discrepancy in absent days calculation",
      "Pending attendance verification",
      "Other attendance issue",
    ],
  },
  WORKLOG: {
    label: "Worklog Issues",
    description: "Slot submission failures, locked date extension disputes, or mentor remark revisions.",
    module: "WORKLOG",
    subcategories: [
      "Worklog submission failed / lost draft",
      "Extension request not reviewed",
      "Locked date reopening enquiry",
      "Flagged worklog revision dispute",
      "Slot text formatting issue",
      "Other worklog issue",
    ],
  },
  TASK: {
    label: "Task Management",
    description: "Assigned tasks not visible, status synchronization, or sprint deliverable issues.",
    module: "TASKS",
    subcategories: [
      "Assigned task not appearing in list",
      "Cannot mark task complete",
      "Mentor sign-off pending",
      "Task points not credited",
      "Other task issue",
    ],
  },
  ACCOUNT: {
    label: "Account & Profile",
    description: "Academic information updates, domain/department discrepancies, or mentor details.",
    module: "PROFILE",
    subcategories: [
      "Incorrect department / year",
      "Mentor information mismatch",
      "Contact number / email correction",
      "Domain change request",
      "Other profile request",
    ],
  },
  AUTH: {
    label: "Login & Authentication",
    description: "Session expirations, password resets, account lockouts, or device authorization.",
    module: "PROFILE",
    subcategories: [
      "Password change not applying",
      "Frequent unexpected logout",
      "Account access restricted",
      "Other login query",
    ],
  },
  TECHNICAL: {
    label: "Technical Issues",
    description: "System bugs, layout breaking on specific devices, or network connection problems.",
    module: "GENERAL",
    subcategories: [
      "Mobile navigation or display glitch",
      "Browser compatibility issue",
      "Slow response / 500 error",
      "Other technical bug",
    ],
  },
  GENERAL: {
    label: "General Queries",
    description: "Portal policies, design series guidelines, certifications, or operational questions.",
    module: "GENERAL",
    subcategories: [
      "Design series schedule question",
      "Portal policy clarification",
      "Reward points criteria query",
      "General feedback or question",
    ],
  },
  OTHER: {
    label: "Other Institutional Requests",
    description: "Formal institutional requests, administrative permissions, or special grievances.",
    module: "OTHER",
    subcategories: [
      "Special administrative permission",
      "Grievance redressal",
      "Official certificate / attendance letter",
      "Other request",
    ],
  },
};

export const MODULES_CONFIG: Record<
  TicketModule,
  { label: string; href: string; icon: string }
> = {
  DASHBOARD: { label: "Dashboard", href: "/dashboard", icon: "grid" },
  ATTENDANCE: { label: "Missed OTP Attendance", href: "/attendance", icon: "clock" },
  WORKLOG: { label: "Worklog", href: "/worklog", icon: "clipboard" },
  TASKS: { label: "Task Management", href: "/tasks", icon: "target" },
  PROFILE: { label: "Account & Profile", href: "/profile", icon: "user" },
  GENERAL: { label: "General Portal", href: "/dashboard", icon: "layers" },
  OTHER: { label: "Institutional", href: "/dashboard", icon: "shield" },
};

export const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; tone: "blue" | "amber" | "green" | "red" | "slate"; description: string }
> = {
  NEW: { label: "New", tone: "blue", description: "Submitted and waiting for admin assignment." },
  OPEN: { label: "Open", tone: "blue", description: "Acknowledged by support team." },
  ASSIGNED: { label: "Assigned", tone: "amber", description: "Assigned to an administrator." },
  IN_PROGRESS: { label: "In Progress", tone: "amber", description: "Currently under active investigation." },
  WAITING_STUDENT: { label: "Waiting for Student", tone: "amber", description: "Staff requested additional information from you." },
  RESOLVED: { label: "Resolved", tone: "green", description: "Issue resolved. Awaiting your rating and confirmation." },
  CLOSED: { label: "Closed", tone: "slate", description: "Request finalized and completed." },
};

export const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; tone: "slate" | "blue" | "amber" | "red"; responseHours: number; resolveHours: number }
> = {
  LOW: { label: "Low", tone: "slate", responseHours: 48, resolveHours: 96 },
  MEDIUM: { label: "Medium", tone: "blue", responseHours: 24, resolveHours: 72 },
  HIGH: { label: "High", tone: "amber", responseHours: 12, resolveHours: 36 },
  CRITICAL: { label: "Critical", tone: "red", responseHours: 4, resolveHours: 24 },
};

export const CANNED_RESPONSES = [
  {
    title: "Request details",
    text: "Thank you for reaching out. Could you please provide the exact date, slot or screenshot description of what you were working on when this occurred?",
  },
  {
    title: "Attendance verified",
    text: "We have reviewed your attendance record against the studio logs. The requested hours have been verified and updated in the system.",
  },
  {
    title: "Worklog extension granted",
    text: "Your extension request for the locked worklog has been reviewed and approved. Please log your slots today before 11:30 PM.",
  },
  {
    title: "Issue resolved",
    text: "The reported issue has now been resolved. Please check your portal section and confirm if everything looks correct.",
  },
  {
    title: "Assigned to department",
    text: "Your request has been routed to the respective academic faculty and administrative lead for resolution.",
  },
];
