# Complete workspace navigation and release path

The inspected main branch ends at PR #27 and does not contain Invoices or Reports navigation. Invoicing exists on the later font branch, and Reports PR #32 was merged into the document-preview branch rather than main. The Excel paystub branch includes all of those changes. This is a branch/release mismatch; the feature code was not removed from the complete workspace.

The complete update now targets main through PR #33, containing Invoices, Reports, read-only draft previews, statement identity/font changes and the revised client Excel PDF layout. The earlier stacked work is included; it does not need a separate partial deployment. No merge is performed automatically. Review the main-targeted diff and CI before merging. The main/production site remains older until that release is authorized.

Before a payroll schedule exists, explicit Payroll, Invoices and Reports navigation now provides direct access to billing and reporting. Opening the invoice entry action always opens Invoices, including after returning from Reports. After schedule setup, the existing sidebar retains both Invoices and Reports. Switching between invoice entry and Reports preserves unsaved edits and does not save or mutate financial records. Existing payroll calculations and the revised PDF are retained.

Use the workspace root URL to inspect application navigation. The /statement-preview.pdf path is an isolated document specimen and does not render a sidebar. Different preview origins use their own browser-tab exhibition storage; this is not production authentication or durable multi-user storage.

Verification: all 21 test files, typecheck, production build and whitespace checks pass. Production-build Chromium at 1440x900 and 390x900 verifies both destinations before setup, direct Reports access, correct selected navigation, unsaved invoice preservation/no storage writes, the return-to-invoices entry action, both sidebar destinations after schedule setup, both report tabs and the revised inline PDF route. No runtime errors or document overflow.

Rollback: reverting the small navigation follow-up restores the preceding setup links without removing the sidebar feature code. Reverting the combined main release restores the previous main application. Browser data is not deleted by this navigation change. No migrations, dependencies, environment changes or storage-format changes.
