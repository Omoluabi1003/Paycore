# PayCore engineering guidance

Follow the principles in Omoluabi1003/GeoAware-Core: security, accessible interfaces, clear architecture, focused changes, and human approval of consequential actions. PayCore retains its own payroll data model and brand.

- Never commit real payroll workbooks, personal financial data, credentials, or private exports.
- Do not present fictional data or local-only interactions as working payroll operations.
- Verify sessions, membership, and permissions on the server for every private read and write.
- Keep calculations deterministic; AI may assist but cannot approve or pay payroll.
- Keep ordinary user screens brief and nontechnical. Explain operational setup in developer documentation.
- Preserve the PayCore logo and ETL GIS Consulting LLC attribution.
- Report implemented behavior, test results, unverified integrations, risks, and rollback in PRs.
- Do not merge without human authorization.
