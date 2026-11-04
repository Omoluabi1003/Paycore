import { verifiedBrice } from "../microsoft/ownership.ts";
import { auth0 } from "../auth0.ts";
import { scoped } from "./database.ts";
import { listDocumentMemberships } from "./repository.ts";
import {
  resolveCompanyAccess,
  requirePermission,
  PermissionDenied,
} from "../access.ts";
import type { CompanyAccess } from "../access.ts";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function authenticatedUser() {
  const session = await auth0().getSession();
  if (!session?.user.sub)
    throw new ApiError(401, "Sign in to your secure PayCore account.");
  return {
    id: session.user.sub,
    canManageMicrosoft: verifiedBrice(session.user),
    authenticatedAt: session.internal.createdAt * 1000,
  };
}
export async function companies() {
  const user = await authenticatedUser();
  return scoped("", user.id, (sql) => listDocumentMemberships(sql, user.id));
}
export async function companyAccess(
  companyId: string,
  permission: "documents.read" | "documents.connect",
): Promise<CompanyAccess> {
  const user = await authenticatedUser();
  try {
    const now = Date.now();
    const access = await resolveCompanyAccess(
      {
        verifySession: async () => ({
          userId: user.id,
          expiresAt: now + 30000,
          authenticatedAt: user.authenticatedAt,
          assurance: "PASSWORD",
          revoked: false,
        }),
        findMembership: async () =>
          scoped(companyId, user.id, async (sql) => {
            const row = (
              await sql.query(
                "SELECT roles,active FROM document_company_memberships WHERE company_id=$1 AND user_id=$2",
                [companyId, user.id],
              )
            ).rows[0];
            return row
              ? {
                  userId: user.id,
                  companyId,
                  roles: row.roles,
                  active: row.active,
                }
              : null;
          }),
      },
      "verified-auth0-cookie",
      companyId,
      now,
    );
    requirePermission(access, permission, now);
    return access;
  } catch (error) {
    if (error instanceof PermissionDenied)
      throw new ApiError(
        403,
        "You do not have access to this company mailbox.",
      );
    throw error;
  }
}
export function apiError(error: unknown) {
  const status = error instanceof ApiError ? error.status : 503;
  return Response.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "Mailbox service is temporarily unavailable.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireMicrosoftOwner() {
  const user = await authenticatedUser();
  if (!user.canManageMicrosoft)
    throw new ApiError(403, "Only Brice’s verified account can manage this mailbox.");
  return user;
}
