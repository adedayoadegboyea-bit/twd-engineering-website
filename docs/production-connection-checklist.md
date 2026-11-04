# TW&D production connection checklist — 2026-11-04

## Confirmed
- GitHub Pages publishes `main` repository root to `twdengineeringconsult.com` automatically. Cloudflare DNS proxies GitHub Pages.
- Apps Script project A: `1t11RBjRXgC6bXGCDIxxObZhcAxeJ3t10JhzNT6urncXOVp8YH1-tZr8o` (recruitment/SIWES file inventory supplied).
- Apps Script project B: `1UgRUNp92iL_yGqgBm3I5wc42nKqnej-NV63CPgx94VLelcUEjGvCP8DF` (TW&D.gs and marketplace-account.html).
- Proposed Supabase browser configuration exists in repository; **public publishable key is not a deployment credential**.

## Release blockers
1. Confirm CI checks actually pass on PR #7; manually validate desktop and mobile navigation, links, enquiry paths, assets, accessibility.
2. Test SQL migrations in a nonproduction Supabase project, including staff-directory admin function and RLS positive/negative cases for anonymous, employee A, employee B and payroll admin. Verify public staff photo access and prevent cross-employee salary reads.
3. Confirm owner/admin access and Supabase project ownership. Obtain credentials via secure provider/GitHub environment-secret setup, **never in chat, repo files or screenshots**. Use least-privilege deployment credentials.
4. Export and back up both existing Apps Script projects before using clasp. Determine their live deployment IDs and source mappings. Never run clasp push against either project until all existing files are mirrored and reviewed.
5. For Supabase, use versioned migrations, dry-run/preview, protected production environment and manual approval for destructive changes. No automatic destructive production migrations.
6. Keep payroll/admin pages inaccessible or unreleased until verified. Publishing a static login page does not constitute secure access control.
7. Merge approved public changes to main only after passing checks; GitHub Pages handles publishing automatically. Verify live domain and rollback path after merge.

## Not done
- No production Apps Script or Supabase credentials configured.
- No production Supabase migration applied.
- No production Apps Script deployment updated.
- No upgrade merged into main.

## Required owner action
- In Supabase dashboard, identify the existing project for the site and confirm it is the intended project. Do not send service-role keys.
- For Apps Script, supply current project code backup or grant a supported secure connector access if available; script IDs alone do not authorize deployment.
