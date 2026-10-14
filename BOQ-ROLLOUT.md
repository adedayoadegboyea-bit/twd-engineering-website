# TW&D BOQ & Quotation module — staged rollout

This feature is isolated on branch `feature/boq-quotation-system`. It is not live on the GitHub Pages `main` branch yet.

## Files added
- `boq.html`: separate estimator workspace and sign-in screen
- `boq.css`: isolated styles
- `boq.js`: BOQ line calculations, catalog management, draft submission, staff review and printable quotation
- `boq-schema.sql`: additive tables and row-level security policies
- `boq-workflow.sql`: controlled customer submission function
- `boq-staff.sql`: separately authorised estimator access

## Apply database changes in order
In Supabase Dashboard → SQL Editor, run each file's contents in this order:
1. `boq-schema.sql`
2. `boq-workflow.sql`
3. `boq-staff.sql`

These scripts add BOQ-specific tables and policies; they do not replace the existing website schema or modify the existing quotations table. The price catalog intentionally has no seeded prices. An authorised TW&D administrator must enter verified current rates.

## Authorise estimators
An existing TW&D administrator can grant estimator access by inserting the estimator's existing Auth user UUID into `public.boq_staff`, for example:

```sql
insert into public.boq_staff (user_id, role, added_by)
values ('AUTH-USER-UUID-HERE', 'estimator', auth.uid());
```

Run this as an authenticated admin context where `auth.uid()` is set, or supply the administrator's UUID for `added_by` when running in the SQL editor. Do not grant estimator access to untrusted accounts.

## Current scope / review notes
- Login uses the existing Supabase account.
- Project-type starter BOQ lines are prompts only; quantities must be measured and checked against drawings and site conditions.
- Rates are editable by authorised staff. No fabricated market prices are seeded.
- Customer submissions are held for staff review. Only staff can approve and issue quotations.
- Issued quotations can be printed or saved as PDF from the browser print dialog.
- This is a staged feature branch. Do not merge to `main` until the database migration has been run and the login, rate permissions, calculations, approval, and print flow have been tested.
