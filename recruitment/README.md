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
