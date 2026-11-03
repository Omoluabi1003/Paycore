import test from "node:test";
import assert from "node:assert/strict";
import {
  MAK_COMPANY_IDENTITY as identity,
  companyIdentity,
  initializeCompanyIdentity,
} from "../lib/company-identity.ts";
import { emptyStatementHeader } from "../lib/statement-header.ts";
import { invoiceLetterhead } from "../lib/company-settings.ts";

test("approved business identity initializes only the matching legal company, tolerating case and punctuation", () => {
  const name = identity.header.legalName;
  const result = initializeCompanyIdentity(
    name.toLowerCase().replaceAll(" ", "  "),
    emptyStatementHeader(),
  );
  for (const [field, value] of Object.entries(identity.header))
    assert.equal(result.header[field], value);
  assert.equal(result.revision, identity.revision);
  assert.ok(result.changed);
  for (const other of ["Synthetic Carrier LLC", "", name.replace("LLC", "INC")])
    assert.equal(companyIdentity(other), undefined);
});
test("applying the supplied identity preserves factoring, terms, logo-independent settings and period identifiers", () => {
  const header = {
    ...emptyStatementHeader(),
    factoringName: "Synthetic Factor LLC",
    factoringEmail: "factor@example.test",
    factoringAddress: "100 Example Road",
    invoiceFooter: "Approved footer",
    invoicePaymentInstructions: "Approved terms",
    payrollNumber: "SYN-PAYROLL",
    invoicePayDate: "2026-11-03",
  };
  const original = JSON.stringify(header),
    result = initializeCompanyIdentity(identity.header.legalName, header);
  for (const field of [
    "factoringName",
    "factoringEmail",
    "factoringAddress",
    "invoiceFooter",
    "invoicePaymentInstructions",
    "payrollNumber",
    "invoicePayDate",
  ])
    assert.equal(result.header[field], header[field]);
  assert.equal(JSON.stringify(header), original);
  assert.equal(
    invoiceLetterhead("Old display label", result.header).issuer,
    identity.header.legalName,
  );
  assert.equal(
    invoiceLetterhead("Old display label", result.header).factoringEmail,
    "factor@example.test",
  );
});
test("the identity is applied once, so later saved company edits survive reload", () => {
  const first = initializeCompanyIdentity(
    identity.header.legalName,
    emptyStatementHeader(),
  );
  const edited = { ...first.header, address: "100 Updated Example Road" };
  const result = initializeCompanyIdentity(
    identity.header.legalName,
    edited,
    first.revision,
  );
  assert.equal(result.header.address, edited.address);
  assert.equal(result.changed, false);
  assert.equal(result.header, edited);
});
test("a conflicting explicit legal entity or another workspace is never overwritten", () => {
  const saved = {
    ...emptyStatementHeader(),
    legalName: "Synthetic Different Entity",
    address: "100 Example Road",
  };
  assert.equal(
    initializeCompanyIdentity(identity.header.legalName, saved).header,
    saved,
  );
  const other = { ...emptyStatementHeader(), email: "synthetic@example.test" };
  assert.equal(
    initializeCompanyIdentity("Synthetic Company", other).header,
    other,
  );
  assert.equal(
    initializeCompanyIdentity("", emptyStatementHeader()).changed,
    false,
  );
});
test("the supplied identity corrects older company contact fields on the first upgrade only", () => {
  const stale = {
    ...emptyStatementHeader(),
    legalName: identity.header.legalName.toLowerCase(),
    address: "100 Previous Example Road",
    phone: "555-0000",
  };
  const upgraded = initializeCompanyIdentity(identity.header.legalName, stale);
  assert.equal(upgraded.header.address, identity.header.address);
  assert.equal(upgraded.header.phone, identity.header.phone);
  assert.equal(upgraded.header.legalName, identity.header.legalName);
  assert.equal(stale.address, "100 Previous Example Road");
});
