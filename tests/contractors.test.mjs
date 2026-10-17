import assert from "node:assert/strict";
import test from "node:test";
import { AccessDenied, contractorInputSchema, prepareContractorCreation, requireContractorAccess } from "../lib/contractors.ts";

const member = { userId: "test-user", workspaceId: "test-workspace", role: "DATA_ENTRY" };
const input = { name: "Fictional Contractor", reference: "pc-001" };

test("unauthenticated and incomplete access fails closed for reads and writes", () => {
  for (const access of [null, {}, { ...member, userId: "" }, { ...member, workspaceId: "" }, { ...member, role: "OWNER" }]) {
    for (const action of ["read", "create"]) {
      assert.throws(() => requireContractorAccess(access, action), AccessDenied);
    }
  }
});

test("read-only membership cannot prepare a write", () => {
  const viewer = { ...member, role: "READ_ONLY" };
  assert.equal(requireContractorAccess(viewer, "read").workspaceId, member.workspaceId);
  assert.throws(() => prepareContractorCreation(viewer, input), AccessDenied);
});

test("recognized write roles retain the authenticated workspace and actor", () => {
  for (const role of ["ADMIN", "PAYROLL_MANAGER", "DATA_ENTRY"]) {
    const prepared = prepareContractorCreation({ ...member, role }, input);
    assert.equal(prepared.workspaceId, member.workspaceId);
    assert.equal(prepared.actorId, member.userId);
    assert.equal(prepared.audit.action, "contractor.created");
  }
});

test("browser input cannot select another organization, role, actor, or sensitive fields", () => {
  for (const key of ["workspaceId", "actorId", "role", "bankAccount", "taxId", "rate"]) {
    assert.equal(contractorInputSchema.safeParse({ ...input, [key]: "injected" }).success, false);
  }
});

test("references are normalized before uniqueness checks", () => {
  assert.deepEqual(prepareContractorCreation(member, { name: "  Fictional Contractor  ", reference: " pc-001 " }).contractor,
    { name: "Fictional Contractor", reference: "PC-001" });
});

test("invalid and excessive contractor inputs are rejected", () => {
  for (const invalid of [{ ...input, name: " " }, { ...input, name: "x".repeat(121) },
    { ...input, reference: " " }, { ...input, reference: "x".repeat(33) },
    { ...input, reference: "../other" }, { ...input, reference: "a b" }]) {
    assert.equal(contractorInputSchema.safeParse(invalid).success, false);
  }
});

test("audit metadata does not duplicate personal information", () => {
  const result = prepareContractorCreation(member, input);
  assert.deepEqual(result.audit, { action: "contractor.created" });
});
