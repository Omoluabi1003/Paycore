import { z } from "zod";

export const roles = ["OWNER_ADMIN", "PAYROLL_SPECIALIST", "PAYROLL_MANAGER", "APPROVER", "FINANCE", "AUDITOR", "CONTRACTOR"] as const;
export type Role = typeof roles[number];
export type Permission = "company.configure" | "contractor.read" | "contractor.write" | "payroll.prepare" | "payroll.read" | "payroll.approve" | "ledger.read" | "ledger.post" | "audit.read" | "portal.read";
const grants: Record<Role, readonly Permission[]> = {
  OWNER_ADMIN: ["company.configure", "contractor.read", "contractor.write", "payroll.read", "ledger.read", "audit.read"],
  PAYROLL_SPECIALIST: ["contractor.read", "contractor.write", "payroll.prepare", "payroll.read", "ledger.read"],
  PAYROLL_MANAGER: ["contractor.read", "contractor.write", "payroll.prepare", "payroll.read", "ledger.read", "ledger.post", "audit.read"],
  APPROVER: ["payroll.read", "payroll.approve", "ledger.read", "audit.read"],
  FINANCE: ["payroll.read", "ledger.read", "ledger.post"],
  AUDITOR: ["contractor.read", "payroll.read", "ledger.read", "audit.read"],
  CONTRACTOR: ["portal.read"],
};
const identifier = z.string().trim().min(1).max(128);
const instant = z.number().int().safe().nonnegative();
const sessionSchema = z.object({ userId: identifier, expiresAt: instant, authenticatedAt: instant, assurance: z.enum(["PASSWORD", "MFA"]), revoked: z.boolean() }).strict();
const membershipSchema = z.object({ userId: identifier, companyId: identifier, active: z.boolean(), roles: z.array(z.enum(roles)).min(1), contractorId: identifier.optional() }).strict();
export type VerifiedSession = z.infer<typeof sessionSchema>;
export type CompanyMembership = z.infer<typeof membershipSchema>;
// Implement only in trusted server composition with the managed identity provider
// and a membership repository. Never use browser-supplied identity or role claims.
export interface AccessDependencies {
  verifySession: (opaqueSession: string) => Promise<VerifiedSession | null>;
  findMembership: (userId: string, companyId: string) => Promise<CompanyMembership | null>;
}
const issued = new WeakSet<object>();
export type CompanyAccess = Readonly<{ userId: string; companyId: string; roles: readonly Role[]; contractorId?: string; expiresAt: number; authenticatedAt: number; assurance: "PASSWORD" | "MFA" }>;
export class PermissionDenied extends Error { constructor() { super("You do not have access to this action. Sign in again or ask your company administrator."); } }
export async function resolveCompanyAccess(dependencies: AccessDependencies, opaqueSession: string, companyId: string, now: number): Promise<CompanyAccess> {
  if (!identifier.safeParse(companyId).success || !z.string().min(1).max(8192).safeParse(opaqueSession).success || !instant.safeParse(now).success) throw new PermissionDenied();
  const session = sessionSchema.safeParse(await dependencies.verifySession(opaqueSession));
  if (!session.success || session.data.revoked || session.data.expiresAt <= now || session.data.authenticatedAt > now) throw new PermissionDenied();
  const membership = membershipSchema.safeParse(await dependencies.findMembership(session.data.userId, companyId));
  if (!membership.success || !membership.data.active || membership.data.userId !== session.data.userId || membership.data.companyId !== companyId) throw new PermissionDenied();
  const access = Object.freeze({ ...session.data, companyId, roles: Object.freeze([...membership.data.roles]), contractorId: membership.data.contractorId });
  issued.add(access); return access;
}
export function requirePermission(access: CompanyAccess, permission: Permission, now: number): void {
  if (!access || !issued.has(access) || !instant.safeParse(now).success || access.expiresAt <= now || !access.roles.some(role => grants[role].includes(permission))) throw new PermissionDenied();
  if (["payroll.approve", "ledger.post", "company.configure"].includes(permission) && (access.assurance !== "MFA" || access.authenticatedAt > now || now - access.authenticatedAt > 10 * 60 * 1000)) throw new PermissionDenied();
}
export function requireOwnContractor(access: CompanyAccess, companyId: string, contractorId: string, now: number) {
  requirePermission(access, "portal.read", now);
  if (access.companyId !== companyId || !access.contractorId || access.contractorId !== contractorId) throw new PermissionDenied();
}
