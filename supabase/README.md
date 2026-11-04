# TW&D Supabase integration — deployment guardrails

Project reference confirmed by owner: `dawrvqdrnunigmzehhim`.

The GitHub integration was configured in Supabase by the owner on 2026-11-04. Production deployment must remain **OFF** until the database changes have been reviewed and tested.

## Existing SQL files
- `staff-directory.sql` — proposed public staff directory and admin policies
- `employee-payroll.sql` — proposed private employee profiles and salary records

These are **draft SQL scripts, not production-ready Supabase CLI migrations**. They must not be automatically applied simply because GitHub is connected.

## Before creating versioned migrations
1. Export the existing production schema and review current tables, policies and extensions.
2. Create a separate nonproduction Supabase project or safe isolated test environment.
3. Convert the draft scripts into numbered files under `supabase/migrations/`, after reconciling them with the existing schema.
4. Test employee A cannot read employee B salary, anonymous users cannot access payroll, and payroll admins have precisely the intended access.
5. Verify directory administrators alone can modify staff and photo objects.
6. Review migration rollback, duplicate-policy behavior, storage rules, existing app compatibility and audit requirements.
7. Only after all checks pass, approve a protected production deployment.

Do not paste database passwords, service-role keys, access tokens or credentials into GitHub source or chat. Configure secrets only through the provider's secure settings.

GitHub Pages already publishes the public site from `main` automatically; Supabase migrations and Google Apps Script deployments are separate systems.
