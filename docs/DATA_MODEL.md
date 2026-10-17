# PayCore V1 Data Model

## Company
Owns settings, payroll rules and users.

## User / Role
Initial roles: `ADMIN`, `PAYROLL_MANAGER`, `DATA_ENTRY`, `READ_ONLY`.

## Contractor
Identity/profile, status, default settlement rate, payment preference and masked payment metadata. Sensitive identifiers belong in encrypted storage, not source control.

## PayPeriod
Start/end dates and lifecycle state.

## Load
Contractor, load/pro number, dates, origin, destination, gross revenue, mileage metadata and source/import metadata. Duplicate detection uses company + normalized load number plus supporting fields.

## Expense
Contractor, category, amount, date, description, source and optional pay-period assignment.

## PayrollRun
Pay period, status (`DRAFT`, `REVIEW`, `APPROVED`, `PAID`, `LOCKED`), totals, creator, reviewer/approver and timestamps.

## Settlement
One contractor's immutable financial snapshot within an approved payroll run. Stores the effective rules/rates used at calculation time.

## SettlementLine
Earning, deduction, reimbursement, factoring or adjustment line with source reference and human-readable explanation.

## Adjustment
Post-approval correction linked to the original settlement/run. Never overwrites the original financial history.

## AuditEvent
Actor, action, entity type/id, timestamp, reason and safe before/after metadata. Sensitive raw values are excluded.

## Rule / Setting
Versioned business rules such as contractor percentage, factoring rate, recurring deductions and approval policy. No business percentage should be hard-coded in UI components.