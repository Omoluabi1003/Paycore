# PayCore interface upgrade

The upgrade applies UI/UX Pro Max guidance to PayCore's existing operational flows.
The reviewed decisions are in `design-system/paycore/MASTER.md`; the shared screen
styles are in `app/interface-upgrade.css`. The approved logo, splash artwork and
ETL GIS Consulting LLC attribution remain in use. The system font and inline SVGs
avoid new runtime dependencies, external font requests or client telemetry.

## Changed behavior and presentation

- Entry, schedule setup, the workspace shell, invoice screens and email-document
  pages share typography, spacing, surfaces, buttons and navigation treatment.
- Local profile access remains explicitly separate from verified mailbox sign-in.
  Profile edits are staged until Done; Cancel preserves the previous profile. A
  changed name/company still selects the existing corresponding local storage
  scope, with a visible explanation. Existing keys and records are not migrated.
  Storage failures produce visible feedback rather than an unhandled exception.
- The mobile menu uses a native modal dialog with focus containment, Escape,
  backdrop dismissal and focus restoration. Available sections use existing
  actions; unavailable payroll sections explain the pay-period prerequisite.
- Email pages share a shell, current-page navigation and real connection-state
  feedback. Search filters only the loaded document page and makes no API call;
  counts explicitly describe that page. Empty and unmatched states are distinct.
  Disconnect controls prevent duplicate submissions while pending.
- Financial tables retain their original data and calculations. The contractor
  table has a named keyboard-focusable scroll region. Local draft explanation
  is available through progressive disclosure; save/restore rules are unchanged.

Server permissions, Brice-only Microsoft ownership, request limits, polling retry
rules, scheduler safeguards, invoice/settlement calculations and approval gates
are retained. This change does not activate authentication, mailbox consent,
payment processing, cloud settings or compliance certification.

## Validation boundary

Use synthetic data to exercise entry, date setup, profile save/cancel, the mobile
menu, payroll and invoice navigation, saved company information, invoice edits,
PDF output, received-payment records, document search, empty/error states and
blocked browser storage. Verify the same records after a refresh. Check keyboard
focus/escape and layouts at 375, 768, 1024 and 1440px, including reduced motion.

Automated axe checks cover selected entry, setup, payroll, invoice, menu and email
states; they do not establish complete WCAG conformance. Full manual screen-reader,
physical Safari/iOS, zoom and every financial workflow remain separate checks.
Mailbox browser checks use mocked provider/document responses; no private client
mailbox was accessed during this interface work.

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. No additional database migration,
environment variable or application dependency is introduced by this UI upgrade.
Existing backend setup from the earlier security/cost work is still required.
Rollback is a reviewed code revert preserving existing records, storage keys,
server controls and approved financial snapshots.

The locally installed skill catalog is a development tool, not an application
runtime asset; it is not added to the production bundle. The interface does not
require Python or the skill files at runtime.

## Visual previews

The entry screenshots are captured from the production build, without a populated
profile or private records:

- [Desktop entry](previews/paycore-entry-desktop.png)
- [Mobile entry](previews/paycore-entry-mobile.png)
