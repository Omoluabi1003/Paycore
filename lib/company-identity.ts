import { StatementHeaderSchema } from "./statement-header.ts";
import type { StatementHeader } from "./statement-header.ts";
// Client-supplied business identity, explicitly approved for reuse in this project.
// This is a letterhead preset, never an identity or company-membership credential.
export const MAK_COMPANY_IDENTITY = Object.freeze({
  revision: "mak-freight-services-llc:1",
  header: Object.freeze({
    legalName: "MAK FREIGHT SERVICES LLC",
    address: "2624 Manderson Street",
    cityStateZip: "Omaha, NE 68111",
    mcNumber: "1032752",
    usdotNumber: "3271220",
    email: "brice@makfreightservices.com",
    phone: "(402) 609-9946",
  }),
});
const normalize = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
export function companyIdentity(name: string) {
  return normalize(name) === normalize(MAK_COMPANY_IDENTITY.header.legalName)
    ? MAK_COMPANY_IDENTITY
    : undefined;
}
export const companyIdentityRevisionKey = (scope: string) =>
  `paycore-company-identity-revision-v1:${encodeURIComponent(scope)}`;
export function initializeCompanyIdentity(
  companyName: string,
  header: StatementHeader,
  appliedRevision?: string | null,
) {
  const identity = companyIdentity(
    companyName.trim() || header.legalName || "",
  );
  if (
    !identity ||
    (header.legalName?.trim() &&
      normalize(header.legalName) !== normalize(identity.header.legalName))
  )
    return { header, revision: undefined, changed: false };
  if (appliedRevision === identity.revision)
    return { header, revision: identity.revision, changed: false };
  // Apply the approved identity once. Preserve factoring, logo, terms and period data.
  const next = StatementHeaderSchema.parse({ ...header, ...identity.header });
  return {
    header: next,
    revision: identity.revision,
    changed: JSON.stringify(next) !== JSON.stringify(header),
  };
}
