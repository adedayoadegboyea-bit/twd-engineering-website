# TW&D deployment automation plan

This repository contains a static website, browser-side Supabase client configuration, and **SQL migrations that have not been applied**.

## Current state
- Live site: https://twdengineeringconsult.com
- Current deployment method reported by owner: manual deployment (Google Apps Script, Cloudflare and GitHub have been mentioned).
- Google Apps Script project ID supplied by the owner: `1t11RBjRXgC6bXGCDIxxObZhcAxeJ3t10JhzNT6urncXOVp8YH1-tZr8o` (project ownership and live deployment mapping not independently verified).\n- Owner confirms manual deployment through Google Apps Script. Hosting origin, DNS routing, the exact Apps Script code structure and Cloudflare role are **not yet verified**.
- **Do not enable automatic production deployment until hosting and rollback are confirmed.**
- GitHub validation workflow runs on pull requests and main commits; it does not deploy.

## Google Apps Script preparation\n- Confirm the existing Apps Script project contains the website serving code and whether it uses `HtmlService`, `doGet`, separate HTML partials or external assets.\n- Do not run `clasp push` against this project until we have compared and backed up its current code. The repository contains standalone HTML/CSS/JS files, which cannot simply be pushed as-is into an Apps Script project.\n- Once the mapping is known, create a dedicated Apps Script source directory and a clasp config with the supplied script ID.\n- Configure scoped GitHub Actions credentials through repository environment secrets and a protected `production` environment.\n- Test on a separate Apps Script deployment/version before changing the existing live deployment.\n\n## Proposed release process
1. Develop on a branch and open a PR.
2. Run automated syntax and file-presence checks; add browser, auth and RLS tests before payroll release.
3. Review changes and confirm a production backup.
4. After the deployment destination is verified, add a GitHub Actions release job using GitHub Environment `production`, required reviewers and minimal scoped credentials.
5. Publish static files using the **verified** hosting provider integration (e.g. Cloudflare Pages if it actually serves the domain; otherwise the verified Apps Script deployment mechanism).
6. Run smoke tests and keep a rollback path.

## Supabase
- Use the Supabase CLI migrations workflow only after confirming project identity, migration history and a database backup.
- Existing SQL files: `supabase/staff-directory.sql` and `supabase/employee-payroll.sql` are **draft scripts**, not an applied migration history. Review for idempotence, correct authorization and schema compatibility first.
- Run migrations in a staging Supabase project, validate RLS with two distinct employee accounts and an admin, then promote to production behind a required approval.
- Use GitHub Environments secrets for any deploy token/database connection; never put service-role keys or database passwords into the website.
- Do not automatically seed real employee profiles, salary records or admin user IDs.
- Payroll status is manually recorded and does not transfer funds.

## Information needed before enabling production deploy
- Where does `twdengineeringconsult.com` actually serve its HTML from (Cloudflare Pages, Workers, Apps Script, another host)?
- Which repository branch currently drives live deployment?
- Is the Supabase project at the URL in `supabase-config.js` the production project, and is there a staging project?
- Who approves production releases and holds rollback access?

## Manual safety
The existing draft PR remains unmerged. This automation setup does not change DNS, Cloudflare, Google Apps Script deployments, Supabase schema or production site content.

## Existing Apps Script file inventory supplied by owner (2026-11-04)
- `Adminpreview.gs`, `Recruitment.gs`, `Application.html`, `Aptitude.html`, `AptitudeAdminPrevie.html`, `RecruitmentDecision_old.html`, `AptitudeReview.html`, `RecruitmentDecision.gs`, `RecruitmentManagement.html`, `RecruitmentManagementBackend.gs`, `TWD_SIWES_Module.gs`, `TWD_SIWES_Dashboard_Panel.html`.
- These names suggest recruitment and SIWES workflows; their code and deployment configuration have **not** been inspected. Do not replace them or assume this Apps Script project hosts the public website.
- Before automation, export/back up the Apps Script project, inspect `doGet`/`doPost` entry points and frontend links, and identify how `twdengineeringconsult.com` is actually served.
- A GitHub Actions `clasp push` would replace the remote Apps Script source with the configured local source; never enable it against this production project without a complete verified source mirror and rollback.

## Second Apps Script project reported by owner
- Script ID: `1UgRUNp92iL_yGqgBm3I5wc42nKqnej-NV63CPgx94VLelcUEjGvCP8DF`.
- Purpose and file inventory unknown; do not deploy to this project until its existing code, deployments and role are verified.
- There are now two reported Apps Script project IDs; maintain separate source mappings, secrets and release workflows if both require automation.

## Second Apps Script project file inventory supplied by owner
- `TW&D.gs`
- `marketplace-account.html`
- Likely marketplace/account backend, based on filenames only. Code, live deployments and relationships to the domain are not verified.
- Do not overwrite or automate this project until current source is backed up and the live deployment mapping is confirmed.
