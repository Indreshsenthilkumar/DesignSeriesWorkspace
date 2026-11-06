import { PERMISSIONS, ROLE_RANK, type Permission, type Role } from "./constants";

/** The shape every permission check works against. */
export type PermissionSubject = {
  role: string;
  systemStatus?: string;
} & Partial<Record<Permission, boolean>>;

export function isAdminLike(user: PermissionSubject): boolean {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STUDENT_ADMIN";
}

export function isStaff(user: PermissionSubject): boolean {
  return user.role !== "STUDENT";
}

/**
 * Super admins, admins and student+ admins bypass per-module flags.
 * Suspended accounts hold no permissions at all.
 */
export function can(user: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.systemStatus === "SUSPENDED") return false;
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "STUDENT_ADMIN") return true;
  return user[permission] === true;
}

export function canAny(user: PermissionSubject | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}

/** True when the user may open the admin console at all. */
export function canOpenConsole(user: PermissionSubject | null | undefined): boolean {
  if (!user) return false;
  if (user.systemStatus === "SUSPENDED") return false;
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "STUDENT_ADMIN" || user.role === "MENTOR") return true;
  return canAny(user, [...PERMISSIONS]);
}

/** Guards "actor edits target" — any admin/mentor can manage own and anyone's details. */
export function outranks(actor: PermissionSubject, targetRole: string): boolean {
  if (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN" || actor.role === "MENTOR" || actor.role === "STUDENT_ADMIN") {
    return true;
  }
  const a = ROLE_RANK[actor.role as Role] ?? 0;
  const t = ROLE_RANK[targetRole as Role] ?? 0;
  return a >= t;
}

export function grantedPermissions(user: PermissionSubject): Permission[] {
  return PERMISSIONS.filter((p) => can(user, p));
}
