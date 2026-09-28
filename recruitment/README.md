# TW&D Recruitment Backend

This folder contains the Google Apps Script backend for the TW&D Careers & Recruitment Portal.

## What it provides
- Application intake
- CV and supporting-document storage in a private Google Drive folder
- Recruitment spreadsheet/dashboard
- Applicant confirmation email
- Management new-application notification
- Status/interview update emails when the management sheet is edited

Google Apps Script web apps require a `doGet`/ `doPost` entry point and are deployed from the Apps Script editor. See Google's web-app documentation: https://developers.google.com/apps-script/guides/web

## Setup
1. Open https://script.google.com/ and create a new standalone Apps Script project.
2. Create two files: `Code.gs` and `Application.html`.
3. Copy the matching files from this folder into the Apps Script project.
4. In `Code.gs`, confirm `MANAGEMENT_EMAIL` is the TW&D recruitment/management email.
5. Run `setupRecruitment` once and authorize Google Sheets, Drive and Mail access.
6. Deploy > New deployment > Web app. For a public applicant portal, Google documents the access setting as `Anyone, even anonymous`; execute as the deploying account so applications are stored under TW&D's account.
7. Copy the deployed web-app URL.
8. Replace the placeholder backend URL in the public careers page with that URL, or link the Apply button directly to it.
9. Use the generated Google Sheet as the private recruitment dashboard. Management can update Status, Interview Date, Interview Time, Interview Location and Interview Type; the script sends an applicant update email when those fields are edited.

Use a versioned deployment for public use rather than the test /dev deployment.

## Security
Do not place Google credentials, Sheet IDs, Drive IDs or secrets in the public GitHub website. The backend should remain in the TW&D Google account.


## Safe consolidation / suspected split spreadsheets

`Migration.gs` is a **non-destructive consolidation tool** for the recruitment system.

It will:
- create one canonical spreadsheet named **TW&D Recruitment Master**;
- find the currently configured recruitment spreadsheet and other spreadsheets whose names clearly identify them as TW&D recruitment spreadsheets;
- import `Applications` and `Aptitude Tests` records into the master using header-name mapping;
- avoid importing the same Application ID or Test ID twice;
- preserve records that have no ID by assigning a migration-only ID in the master;
- create a **Migration Log** showing every source spreadsheet and what was imported;
- create a **Drive File Inventory** for every file in the existing `TW&D Recruitment Documents` folder and its subfolders;
- change the Apps Script `SHEET_ID` property to the master only after the consolidation completes;
- reinstall the recruitment triggers against the master;
- **never delete, trash, move, rename, or overwrite any source spreadsheet or recruitment document**.

### One-time migration

After adding `Migration.gs` to the same Apps Script project as `Code.gs`:

1. Save the project.
2. Run `consolidateRecruitmentNow()` once.
3. Approve the requested Google permissions.
4. Copy the returned master spreadsheet URL.
5. Run `verifyRecruitmentConsolidation()` and confirm the reported counts.
6. Do not delete the old spreadsheets. Keep them as preserved historical backups until the master has been tested.

The migration uses Google Apps Script's Spreadsheet and Drive services to open spreadsheets by ID and inventory Drive files. Google documents these services and authorization requirements here:
https://developers.google.com/apps-script/guides/services/
https://developers.google.com/apps-script/guides/services/authorization
