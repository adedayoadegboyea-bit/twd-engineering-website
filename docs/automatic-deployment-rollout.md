# TW&D automatic deployment rollout (not enabled yet)

## Recommended approach
1. Back up the current production site and document the existing Google Apps Script deployment and Cloudflare DNS/hosting configuration.
2. Confirm whether the domain is served by Cloudflare Pages, Cloudflare Workers, GitHub Pages, or Google Apps Script. Cloudflare DNS alone does not mean Cloudflare hosts the website.
3. Configure a Cloudflare Pages project with the existing GitHub repository. Set production branch to `main`, build command blank for this static HTML/CSS/JS repository, and output directory to repository root (`/`) if supported by the selected integration.
4. Test a preview deployment on a separate preview hostname before switching the domain. Check routes, images, forms, Apps Script links, Supabase authentication, SEO, mobile and desktop.
5. Only after explicit approval, switch the production domain to the tested hosting target. Preserve rollback instructions and previous DNS values.
6. Protect `main` with required reviews and checks. A merge to `main` then triggers production deployment; changes to other branches should remain previews.

## Supabase
- The repository currently has two setup scripts: `supabase/staff-directory.sql` and `supabase/employee-payroll.sql`. These are NOT applied by adding them to GitHub.
- Review and run those scripts in a controlled environment first; audit RLS with two test employees and an unauthorised user.
- After the initial baseline is applied and tested, adopt Supabase CLI versioned migrations under `supabase/migrations/`. Never blindly rerun non-idempotent setup scripts.
- Configure a GitHub Actions migration workflow only after the correct Supabase project reference, environment approval gates and secrets are configured. Prefer a manually approved production migration job; automatic *testing* on pull requests is safe, automatic production schema modification without approval is not.
- Keep `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and any service-role key in protected GitHub environment secrets, never committed to GitHub or exposed to browser JavaScript. The browser publishable key is not a secret.
- Do not use database migrations to store or publish real salary data. Payroll records are entered by authorised administrators in the app.
- Configure Auth redirect URLs to match the final production and preview origins.

## Launch checklist
- [ ] Confirm current hosting and DNS origin
- [ ] Confirm Cloudflare account/project access
- [ ] Create isolated preview and verify all existing pages
- [ ] Complete staff/payroll database setup and RLS tests
- [ ] Verify admin role provisioning
- [ ] Validate employee account approval and login
- [ ] Validate staff photo upload and visibility
- [ ] Validate payroll access isolation and payment status behavior
- [ ] Confirm backups, rollback and branch protection
- [ ] Obtain approval before live domain switch

No automatic production deployment is enabled by this document.
