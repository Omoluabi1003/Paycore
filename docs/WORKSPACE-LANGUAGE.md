# Workspace language

PayCore screens describe the actual payroll task: contractor setup, activity entry, review, saved drafts, statements, invoices and reports. Do not frame ordinary work as a demo, exhibit or simulation.

Capabilities must remain accurate. Current workspace profiles are device-local and do not authenticate identity. Drafts and recorded approval/payment states remain local; recording approval does not submit payroll and recording payment status does not transfer funds. Show these facts at access, storage and approval/payment controls. Workspace information holds the broader connection status. Use test data until secure accounts and shared storage are configured.

This copy change does not add authentication, shared storage, payment execution or a production payroll backend. Developer identifiers, file/module names, storage keys, historical audit text and legacy statement references remain compatible. They are not product positioning. Example download datasets remain identified as examples so they cannot be mistaken for entered payroll records.

Approval remains an explicit human action. Calculations, validation, immutable snapshots, review reasons and audit generation are unchanged. Export status text identifies local records and states that no funds were transferred. Existing records are not rewritten to change their historical wording.

Validation: run the full test suite, typecheck and production build; check mobile entry, contractor setup, activity, review and exports. Revert the copy commit to roll back; no data migration is required.
