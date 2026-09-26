# TW&D Client Project Portal

This backend stores client-submitted project documents in Google Drive and records each submission in Google Sheets.

## One-time setup
1. Open Google Apps Script.
2. Create a new project and paste `Code.gs`.
3. Run `testSetup` once and approve the Google permissions.
4. Deploy as **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the Web App URL.
6. Open `client-portal.html` in GitHub and replace:
   `PASTE_YOUR_CLIENT_PORTAL_WEB_APP_URL_HERE`
   with the Web App URL.
7. Commit the change.

The portal accepts PDF/JPG/JPEG/PNG/WEBP files up to 10 MB each. The company should still review every structural submission through qualified engineering professionals; the portal is a document intake system, not an automated structural safety certification system.