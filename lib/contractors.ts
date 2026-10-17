import { z } from "zod";

// Resolve these claims from the verified session on the server, never from form
// fields, query strings, or an organization ID supplied by the browser.
export type WorkspaceAccess = Readonly<{
  userId: string;
  workspaceId: string;
  role: "ADMIN" | "PAYROLL_MANAGER" | "DATA_ENTRY" | "READ_ONLY";
}>;

const accessSchema = z.object({
  userId: z.string().trim().min(1).max(256),
  workspaceId: z.string().trim().min(1).max(256),
  role: z.enum(["ADMIN", "PAYROLL_MANAGER", "DATA_ENTRY", "READ_ONLY"]),
}).strict();

export class AccessDenied extends Error {
  constructor() { super("You do not have access to this action."); }
}

export function requireContractorAccess(
  verifiedAccess: WorkspaceAccess | null,
  action: "read" | "create",
): WorkspaceAccess {
  const result = accessSchema.safeParse(verifiedAccess);
  if (!result.success || (action === "create" && result.data.role === "READ_ONLY")) {
    throw new AccessDenied();
  }
  return Object.freeze(result.data);
}

// Deliberately excludes bank accounts, tax IDs, and payroll amounts. Rates and
// their effective dates belong to the later versioned agreement workflow.
export const contractorInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the contractor’s name.").max(120),
  reference: z.string().trim().min(1).max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use letters, numbers, hyphens, or underscores.")
    .transform((value) => value.toUpperCase()),
}).strict();

export type ContractorInput = z.infer<typeof contractorInputSchema>;

export function prepareContractorCreation(verifiedAccess: WorkspaceAccess | null, input: unknown) {
  const access = requireContractorAccess(verifiedAccess, "create");
  const contractor = contractorInputSchema.parse(input);
  return {
    workspaceId: access.workspaceId,
    actorId: access.userId,
    contractor,
    audit: { action: "contractor.created" as const },
  };
}
