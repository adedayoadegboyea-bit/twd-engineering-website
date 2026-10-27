const CONFIG = {
  SHEET_NAME: 'Applications',
  DRIVE_FOLDER_NAME: 'TW&D Recruitment Documents',
  MANAGEMENT_EMAIL: 'admin@twdengineeringconsult.com',
  COMPANY_NAME: 'TW&D Engineering Consult & Services Ltd',
  TIMEZONE: 'Africa/Lagos'
};

const HEADERS = [
  'Application ID',
  'Timestamp',
  'Applicant Name',
  'Email',
  'Phone',
  'Position',
  'Location',
  'Qualifications',
  'Experience',
  'Professional Registration',
  'Application Letter',
  'CV Link',
  'Supporting Documents',
  'Status',
  'Interview Date',
  'Interview Time',
  'Interview Location',
  'Interview Type',
  'Management Notes',
  'Aptitude Test Status',
  'Aptitude Score',
  'Aptitude Submitted At',
  'AI Assessment',
  'Applicant Email Status',
  'Management Email Status',
  'Email Error',
  'Email Attempts',
  'Next Email Attempt At',
  'Aptitude Username',
  'Aptitude Password Hash',
  'Aptitude Test Link',
  'Approval Email Status'
];

const VALID_STATUSES = [
  'Application Received',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Successful',
  'Not Selected'
];

/**
 * Public recruitment portal.
 */
function doGet(e) {
  const page = e && e.parameter && String(e.parameter.page || '').toLowerCase();
  const file = page === 'aptitude' ? 'Aptitude' : 'Application';
  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle(page === 'aptitude' ? CONFIG.COMPANY_NAME + ' Aptitude Test' : CONFIG.COMPANY_NAME + ' Careers')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * First-time setup.
 * Safe to run repeatedly. It does not delete applications.
 */
function setupRecruitment() {
  const ss = getRecruitmentSpreadsheet_();
  const sheet = getApplicationsSheet_(ss);
  const folder = getRecruitmentFolder_();

  PropertiesService.getScriptProperties().setProperties({
    SHEET_ID: ss.getId(),
    FOLDER_ID: folder.getId()
  });

  installStatusTrigger_();
  installRecruitmentEmailTrigger_();

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    sheetUrl: ss.getUrl(),
    folderUrl: folder.getUrl(),
    message: 'Recruitment system is ready.'
  };
}

/**
 * Creates or returns the recruitment spreadsheet.
 * This works even when the Apps Script project is standalone.
 */
function getRecruitmentSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('SHEET_ID');

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (err) {
      props.deleteProperty('SHEET_ID');
    }
  }

  // Reuse the existing recruitment spreadsheet if this project has lost its
  // Script Property, rather than silently creating a second spreadsheet.
  const files = DriveApp.getFilesByName(CONFIG.COMPANY_NAME + ' Recruitment');
  if (files.hasNext()) {
    const file = files.next();
    try {
      const ss = SpreadsheetApp.openById(file.getId());
      props.setProperty('SHEET_ID', ss.getId());
      return ss;
    } catch (err) {
      // Continue below and create a valid spreadsheet if the matching file
      // is not a spreadsheet or cannot be opened.
    }
  }

  const ss = SpreadsheetApp.create(CONFIG.COMPANY_NAME + ' Recruitment');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

/**
 * Creates/repairs the Applications sheet without deleting existing data.
 */
function getApplicationsSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // Expand the sheet before reading/writing the newly added aptitude columns.
  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    let changed = false;

    for (let i = 0; i < HEADERS.length; i++) {
      if (!existing[i]) {
        existing[i] = HEADERS[i];
        changed = true;
      }
    }

    if (changed) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([existing]);
    }
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, HEADERS.length);

  return sheet;
}

/**
 * Creates or returns the private recruitment document folder.
 */
function getRecruitmentFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('FOLDER_ID');

  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (err) {
      props.deleteProperty('FOLDER_ID');
    }
  }

  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  const folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);

  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

/**
 * Installs exactly one spreadsheet edit trigger.
 * This is an installable trigger, so MailApp is authorized when it runs.
 */
function installStatusTrigger_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');

  if (!sheetId) {
    throw new Error('No recruitment spreadsheet is configured. Run setupRecruitment().');
  }

  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'onRecruitmentEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onRecruitmentEdit')
    .forSpreadsheet(sheetId)
    .onEdit()
    .create();
}

/**
 * Run this manually if you ever need to reinstall the edit trigger.
 */
function reinstallStatusTrigger() {
  setupRecruitment();
  return 'Status trigger installed successfully.';
}

/**
 * Receives a public application from Application.html.
 */
function submitApplication(data) {
  if (!data) {
    throw new Error('No application data was received.');
  }

  const required = ['name', 'email', 'phone', 'position', 'location', 'qualifications', 'experience', 'letter'];

  required.forEach(function(field) {
    if (!String(data[field] || '').trim()) {
      throw new Error('Please provide: ' + field);
    }
  });

  const email = String(data.email).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid email address.');
  }

  const props = PropertiesService.getScriptProperties();

  if (!props.getProperty('SHEET_ID') || !props.getProperty('FOLDER_ID')) {
    setupRecruitment();
  }

  const sheetId = props.getProperty('SHEET_ID');
  const folderId = props.getProperty('FOLDER_ID');

  const sheet = SpreadsheetApp
    .openById(sheetId)
    .getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error('Applications sheet is missing. Run setupRecruitment().');
  }

  const folder = DriveApp.getFolderById(folderId);

  // IMPORTANT: record the application BEFORE processing optional files.
  // A Drive/file failure must never prevent the applicant from appearing in the spreadsheet.
  const now = new Date();
  const id =
    'TWD-' +
    Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss') + '-' +
    Utilities.getUuid().slice(0, 6).toUpperCase();

  const row = [
    id,
    now,
    String(data.name).trim(),
    email,
    String(data.phone).trim(),
    String(data.position).trim(),
    String(data.location).trim(),
    String(data.qualifications).trim(),
    String(data.experience).trim(),
    String(data.registration || '').trim(),
    String(data.letter).trim(),
    '',
    '',
    'Application Received',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'PENDING',
    'PENDING',
    '',
    0,
    ''
  ];

  while (row.length < HEADERS.length) row.push('');

  const applicationRowNumber = sheet.getLastRow() + 1;
  sheet.getRange(applicationRowNumber, 1, 1, HEADERS.length).setValues([row]);
  SpreadsheetApp.flush();

  // Process uploaded files after the application record is safely written.
  // File failures are recorded in the spreadsheet instead of cancelling the application.
  let cvUrl = '';
  let docsUrl = '';
  const fileErrors = [];

  try {
    if (data.cv && data.cv.base64) {
      const bytes = Utilities.base64Decode(data.cv.base64);
      const blob = Utilities.newBlob(
        bytes,
        data.cv.mimeType || 'application/octet-stream',
        data.cv.name || id + '-CV'
      );
      cvUrl = folder.createFile(blob).getUrl();
      sheet.getRange(applicationRowNumber, 12).setValue(cvUrl);
    }
  } catch (e) {
    fileErrors.push('CV: ' + (e.message || String(e)));
  }

  try {
    if (data.supporting && data.supporting.base64) {
      const bytes = Utilities.base64Decode(data.supporting.base64);
      const blob = Utilities.newBlob(
        bytes,
        data.supporting.mimeType || 'application/octet-stream',
        data.supporting.name || id + '-Supporting'
      );
      docsUrl = folder.createFile(blob).getUrl();
      sheet.getRange(applicationRowNumber, 13).setValue(docsUrl);
    }
  } catch (e) {
    fileErrors.push('Supporting document: ' + (e.message || String(e)));
  }

  if (fileErrors.length) {
    sheet.getRange(applicationRowNumber, 26).setValue(
      'Application recorded; file upload issue: ' + fileErrors.join(' | ').slice(0, 900)
    );
  }

  // Send both confirmation messages immediately after the application row is
  // safely stored. If email delivery fails, the application remains recorded
  // and the exact error is written to the sheet for retry/diagnosis.
  let applicantEmailSent = false;
  let managementEmailSent = false;
  const emailErrors = [];

  try {
    sendApplicantReceiptEmail_(row);
    applicantEmailSent = true;
    sheet.getRange(applicationRowNumber, 24).setValue('SENT');
  } catch (e) {
    emailErrors.push('Applicant email: ' + (e.message || String(e)));
    sheet.getRange(applicationRowNumber, 24).setValue('PENDING');
  }

  try {
    sendManagementNewApplicationEmail_(row);
    managementEmailSent = true;
    sheet.getRange(applicationRowNumber, 25).setValue('SENT');
  } catch (e) {
    emailErrors.push('Management email: ' + (e.message || String(e)));
    sheet.getRange(applicationRowNumber, 25).setValue('PENDING');
  }

  if (emailErrors.length) {
    sheet.getRange(applicationRowNumber, 26).setValue(emailErrors.join(' | ').slice(0, 1000));
  }

  const ssUrl = sheet.getParent().getUrl();

  return {
    ok: true,
    id: id,
    applicantEmailSent: applicantEmailSent,
    managementEmailSent: managementEmailSent,
    emailQueued: emailErrors.length > 0,
    spreadsheetUrl: ssUrl,
    message: 'Application submitted successfully. Your reference is ' + id +
      '. Confirmation email: ' + (applicantEmailSent ? 'sent.' : 'pending.') +
      ' Your application has been recorded for management review.'
  };
}

/**
 * Installs exactly one 1-minute background email queue trigger.
 * Application submission never waits for email delivery.
 */
function installRecruitmentEmailTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processRecruitmentEmailQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processRecruitmentEmailQueue')
    .timeBased()
    .everyMinutes(1)
    .create();
}

/**
 * Public/manual helper to reinstall the background email trigger.
 */
function reinstallRecruitmentEmailTrigger() {
  installRecruitmentEmailTrigger_();
  return 'Recruitment email queue trigger installed successfully.';
}

/**
 * Background worker. It retries pending email jobs without blocking applicants.
 * Column 24 = applicant status, 25 = management status, 26 = error.
 */
function processRecruitmentEmailQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 'Another recruitment email worker is already running.';

  try {
    const sheet = getApplicationsSheet_(getRecruitmentSpreadsheet_());
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return 'No recruitment emails pending.';

    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    let processed = 0;
    const nowMs = Date.now();

    for (let i = 0; i < rows.length && processed < 3; i++) {
      const row = rows[i];

      // Ignore blank/test/incomplete rows. They must never become email jobs.
      // A real application always has an Application ID, applicant name, email and position.
      const rowId = String(row[0] || '').trim();
      const rowName = String(row[2] || '').trim();
      const rowEmail = String(row[3] || '').trim();
      const rowPosition = String(row[5] || '').trim();
      if (!rowId || !rowName || !rowEmail || !rowPosition) {
        continue;
      }

      const applicantStatus = String(row[23] || 'PENDING').trim();
      const managementStatus = String(row[24] || 'PENDING').trim();
      const attempts = Number(row[26] || 0);
      const nextAttempt = row[27] ? new Date(row[27]).getTime() : 0;

      if (applicantStatus === 'SENT' && managementStatus === 'SENT') continue;
      if (nextAttempt && nextAttempt > nowMs) continue;

      const rowNumber = i + 2;
      let applicantError = '';
      let managementError = '';
      let hadFailure = false;

      if (applicantStatus !== 'SENT') {
        try {
          sendApplicantReceiptEmail_(row);
          sheet.getRange(rowNumber, 24).setValue('SENT');
        } catch (e) {
          hadFailure = true;
          applicantError = e.message || String(e);
          sheet.getRange(rowNumber, 24).setValue('PENDING');
        }
      }

      if (managementStatus !== 'SENT') {
        try {
          sendManagementNewApplicationEmail_(row);
          sheet.getRange(rowNumber, 25).setValue('SENT');
        } catch (e) {
          hadFailure = true;
          managementError = e.message || String(e);
          sheet.getRange(rowNumber, 25).setValue('PENDING');
        }
      }

      const combinedError = [applicantError, managementError].filter(Boolean).join(' | ');
      if (combinedError) {
        sheet.getRange(rowNumber, 26).setValue(combinedError.slice(0, 1000));
      } else {
        sheet.getRange(rowNumber, 26).clearContent();
      }

      const newAttempts = hadFailure ? attempts + 1 : attempts;
      sheet.getRange(rowNumber, 27).setValue(newAttempts);

      if (hadFailure) {
        const delayMinutes = Math.min(60, Math.pow(2, Math.min(newAttempts, 6)) * 5);
        sheet.getRange(rowNumber, 28).setValue(
          new Date(Date.now() + delayMinutes * 60 * 1000)
        );
      } else {
        sheet.getRange(rowNumber, 28).clearContent();
      }

      processed++;
      Utilities.sleep(500);
    }

    return 'Processed ' + processed + ' recruitment email job(s).';
  } finally {
    lock.releaseLock();
  }
}

/**
 * Email management when a new application arrives.
 */
function sendManagementNewApplicationEmail_(row) {
  const id = String(row[0] || '').trim();
  const name = String(row[2] || '').trim();
  const applicantEmail = String(row[3] || '').trim();
  const phone = String(row[4] || '').trim();
  const position = String(row[5] || '').trim();
  const location = String(row[6] || '').trim();

  if (!id || !name || !applicantEmail || !position) {
    throw new Error('Refusing to send an empty/incomplete management application email.');
  }
  const email = applicantEmail;
  const cvUrl = row[11];
  const docsUrl = row[12];

  const html =
    '<h2>New TW&D Job Application</h2>' +
    '<p><b>Application ID:</b> ' + escapeHtml_(id) + '</p>' +
    '<p><b>Name:</b> ' + escapeHtml_(name) + '</p>' +
    '<p><b>Email:</b> ' + escapeHtml_(email) + '</p>' +
    '<p><b>Phone:</b> ' + escapeHtml_(phone) + '</p>' +
    '<p><b>Position:</b> ' + escapeHtml_(position) + '</p>' +
    '<p><b>Location:</b> ' + escapeHtml_(location) + '</p>' +
    '<p><b>CV:</b> ' + (cvUrl ? '<a href="' + cvUrl + '">Open CV</a>' : 'Not supplied') + '</p>' +
    '<p><b>Supporting document:</b> ' + (docsUrl ? '<a href="' + docsUrl + '">Open document</a>' : 'Not supplied') + '</p>';

  return sendTransactionalEmail_(CONFIG.MANAGEMENT_EMAIL, 'New TW&D job application: ' + position, html);
}

/**
 * Confirmation email to applicant.
 */
function sendApplicantReceiptEmail_(row) {
  const id = row[0];
  const name = row[2];
  const email = row[3];
  const position = row[5];

  return sendTransactionalEmail_(
    email,
    'Application received — TW&D Engineering Consult & Services Ltd',
    '<p>Dear ' + escapeHtml_(name) + ',</p>' +
    '<p>Thank you for applying to <b>' + CONFIG.COMPANY_NAME + '</b>.</p>' +
    '<p><b>Application reference:</b> ' + escapeHtml_(id) + '</p>' +
    '<p><b>Position:</b> ' + escapeHtml_(position) + '</p>' +
    '<p>Your application has been received and will be reviewed by our management team. We will contact you regarding the next stage.</p>' +
    '<p>Regards,<br><b>' + CONFIG.COMPANY_NAME + '</b></p>'
  );
}

/**
 * Main status email function.
 * Expects a spreadsheet Range containing exactly one application row.
 */
function sendStatusEmail(row) {
  if (!row || typeof row.getValues !== 'function') throw new Error('No valid application row was supplied.');
  const values=row.getValues()[0];
  const id=values[0], name=values[2], email=String(values[3]||'').trim(), position=values[5], status=String(values[13]||'').trim();
  if(!email) throw new Error('This application does not contain an applicant email address.');
  if(!status) throw new Error('This application does not contain a status.');

  if(['SUCCESSFUL','APPROVED'].indexOf(status.toUpperCase())!==-1) return approveApplicantForAptitude_(row);

  let subject='TW&D application update — '+status;
  let body='<p>Dear '+escapeHtml_(name||'Applicant')+',</p><p>Your application with <b>'+CONFIG.COMPANY_NAME+'</b> has been updated.</p><p><b>Application Reference:</b> '+escapeHtml_(id)+'</p><p><b>Position:</b> '+escapeHtml_(position)+'</p><p><b>Status:</b> '+escapeHtml_(status)+'</p>';
  if(status==='Interview Scheduled'){
    body+='<h3>Interview Details</h3><p><b>Date:</b> '+formatValue_(values[14],'To be confirmed')+'</p><p><b>Time:</b> '+formatValue_(values[15],'To be confirmed')+'</p><p><b>Location:</b> '+escapeHtml_(values[16]||'To be confirmed')+'</p><p><b>Type:</b> '+escapeHtml_(values[17]||'To be confirmed')+'</p>';
  }
  body+='<p>Thank you for your interest in joining TW&D Engineering Consult & Services Ltd.</p><p>Regards,<br><b>'+CONFIG.COMPANY_NAME+'</b></p>';
  sendTransactionalEmail_(email,subject,body);
  return 'Status email sent successfully to '+email;
}

function approveApplicantForAptitude_(row) {
  const values=row.getValues()[0], sheet=row.getSheet(), rowNumber=row.getRow();
  const id=String(values[0]), name=String(values[2]||'Applicant'), email=String(values[3]||'').trim(), position=String(values[5]||'');
  if(!email) throw new Error('Cannot send aptitude-test invitation: applicant email is missing.');
  if(!position) throw new Error('Cannot send aptitude-test invitation: applied position is missing.');
  if(String(values[31]||'').trim()==='SENT') return 'Aptitude approval email has already been sent for '+id+'.';

  const username=values[28]?String(values[28]):generateAptitudeUsername_(id);
  const password=generateAptitudePassword_();
  const passwordHash=hashAptitudePassword_(password);
  const testUrl=getAptitudeTestUrl_();
  sheet.getRange(rowNumber,29,1,4).setValues([[username,passwordHash,testUrl,'PENDING']]);
  SpreadsheetApp.flush();

  const html='<h2>TW&D Engineering Consult &amp; Services Ltd — Aptitude Test Invitation</h2>'+
    '<p>Dear '+escapeHtml_(name)+',</p>'+
    '<p>Your application for <b>'+escapeHtml_(position)+'</b> has been approved for the next stage of the recruitment process.</p>'+
    '<p>Please use the credentials below to access your aptitude test:</p>'+
    '<div style="background:#f4f7fb;padding:18px;border-left:4px solid #f7bd18">'+
    '<p><b>Application Reference:</b> '+escapeHtml_(id)+'</p>'+
    '<p><b>Username:</b> '+escapeHtml_(username)+'</p>'+
    '<p><b>Temporary Password:</b> '+escapeHtml_(password)+'</p>'+
    '<p><b>Test Link:</b> <a href="'+testUrl+'">'+testUrl+'</a></p></div>'+
    '<h3>Test Instructions</h3><ul><li>50 position-related multiple-choice questions.</li><li>Time allowed: 1 hour.</li><li>The test submits automatically when the 1-hour period expires.</li><li>Only one submission is permitted.</li><li>Your score and AI assessment will be reviewed by TW&D management.</li></ul>'+
    '<p>Please keep these login details private.</p><p>Regards,<br><b>'+CONFIG.COMPANY_NAME+'</b></p>';

  try{
    sendTransactionalEmail_(email,'Aptitude Test Approved — Your TW&D Test Login',html);
    sheet.getRange(rowNumber,32).setValue('SENT');
    return 'Approval email with aptitude login details sent successfully to '+email;
  }catch(err){
    sheet.getRange(rowNumber,32).setValue('PENDING');
    sheet.getRange(rowNumber,26).setValue(('Aptitude approval email failed: '+(err.message||String(err))).slice(0,1000));
    throw err;
  }
}

function generateAptitudeUsername_(applicationId){
  return 'TWD-'+String(applicationId).replace(/[^A-Za-z0-9]/g,'').slice(-10).toUpperCase();
}
function generateAptitudePassword_(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; let p='';
  for(let i=0;i<12;i++) p+=chars.charAt(Math.floor(Math.random()*chars.length));
  return p;
}
function hashAptitudePassword_(password){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(password),Utilities.Charset.UTF_8);
  return bytes.map(function(b){const v=(b<0?b+256:b).toString(16);return v.length===1?'0'+v:v;}).join('');
}
function getAptitudeTestUrl_(){
  const configured=String(PropertiesService.getScriptProperties().getProperty('APTITUDE_TEST_URL')||'').trim();
  if(configured) return configured;
  const base=String(ScriptApp.getService().getUrl()||'').trim();
  if(!base) throw new Error('Aptitude test URL is not configured. Set Script Property APTITUDE_TEST_URL.');
  return base+'?page=aptitude';
}
function resendAptitudeApprovalForRow(rowNumber){
  rowNumber=Number(rowNumber);
  if(!rowNumber||rowNumber<2) throw new Error('Enter a valid application row number.');
  const sheet=getApplicationsSheet_(SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')));
  if(rowNumber>sheet.getLastRow()) throw new Error('That row does not exist.');
  const status=String(sheet.getRange(rowNumber,14).getValue()||'').trim();
  if(['SUCCESSFUL','APPROVED'].indexOf(status.toUpperCase())===-1) throw new Error('Only an approved applicant can receive aptitude-test credentials.');
  sheet.getRange(rowNumber,32).setValue('PENDING');
  return approveApplicantForAptitude_(sheet.getRange(rowNumber,1,1,HEADERS.length));
}

/**
 * Automatically runs when management edits the Applications spreadsheet.
 * Only a change in column 14 (Status) sends an applicant email.
 */
function onRecruitmentEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();

  if (range.getRow() === 1) return;

  // Applicant recruitment status changes.
  if (sheet.getName() === CONFIG.SHEET_NAME) {
    if (range.getColumn() !== 14) return;
    const rowNumber = range.getRow();
    const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length);
    const status = String(sheet.getRange(rowNumber, 14).getValue() || '').trim();
    if (!status) return;
    sendStatusEmail(row);
    return;
  }

  // Aptitude result approval: management changes Admin Decision (column 14)
  // to APPROVED after reviewing the AI score/report.
  if (sheet.getName() === 'Aptitude Tests') {
    if (range.getColumn() !== 14) return;
    const decision = String(sheet.getRange(range.getRow(), 14).getValue() || '').trim().toUpperCase();
    if (decision !== 'APPROVED') return;
    const testId = String(sheet.getRange(range.getRow(), 1).getValue() || '').trim();
    if (!testId) return;
    approveAptitudeResult(testId, String(sheet.getRange(range.getRow(), 14).getValue() || '').trim());
  }
}

/**
 * Sends the status email for a specific spreadsheet row.
 * Example: run sendStatusEmailForRow(2)
 */
function sendStatusEmailForRow(rowNumber) {
  rowNumber = Number(rowNumber);

  if (!rowNumber || rowNumber < 2) {
    throw new Error('Enter a valid application row number, for example 2.');
  }

  const sheet = getApplicationsSheet_(
    SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty('SHEET_ID')
    )
  );

  if (rowNumber > sheet.getLastRow()) {
    throw new Error('That row does not exist.');
  }

  return sendStatusEmail(
    sheet.getRange(rowNumber, 1, 1, HEADERS.length)
  );
}

/**
 * Fully automatic test.
 * Creates a separate TEST application and sends its status email
 * to the management email address.
 */
function testStatusEmail() {
  const setup = setupRecruitment();

  const ss = SpreadsheetApp.openById(setup.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  const now = new Date();
  const id =
    'TEST-' +
    Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');

  const testRow = [
    id,
    now,
    'TW&D Test Applicant',
    CONFIG.MANAGEMENT_EMAIL,
    '08000000000',
    'Site Engineer / Project Engineer',
    'Ibadan, Oyo State',
    'Test Engineering Qualification',
    'Test Professional Experience',
    'Test Registration',
    'This is an automated recruitment system test.',
    '',
    '',
    'Interview Scheduled',
    'Test Interview Date',
    '10:00 AM',
    'TW&D Engineering Office',
    'In Person',
    'Automated system test'
  ];

  sheet.appendRow(testRow);

  const rowNumber = sheet.getLastRow();

  const result = sendStatusEmail(
    sheet.getRange(rowNumber, 1, 1, HEADERS.length)
  );

  return 'SUCCESS — ' + result + ' | Test ID: ' + id;
}

/**
 * Tests basic outgoing email without touching the Applications sheet.
 */
function testApplicantConfirmationEmail() {
  const to = CONFIG.MANAGEMENT_EMAIL;
  const result = sendTransactionalEmail_(
    to,
    'TW&D Recruitment Email Diagnostic',
    '<h2>TW&D Recruitment Email Diagnostic</h2>' +
    '<p>This is a diagnostic email from the TW&D recruitment system.</p>' +
    '<p>If you received this message, outgoing email is working.</p>' +
    '<p><b>Recipient:</b> ' + escapeHtml_(to) + '</p>' +
    '<p><b>Time:</b> ' +
    escapeHtml_(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd MMMM yyyy, HH:mm:ss')) +
    '</p>'
  );
  return 'SUCCESS: confirmation-email transport is working. Test sent to ' + to;
}

function testRecruitmentEmail() {
  MailApp.sendEmail({
    to: CONFIG.MANAGEMENT_EMAIL,
    subject: 'TW&D Recruitment System Test',
    htmlBody:
      '<h2>TW&D Recruitment System Test</h2>' +
      '<p>This confirms that the recruitment system can send email successfully.</p>' +
      '<p>If you received this message, email authorization is working.</p>'
  });

  return 'Test email sent to ' + CONFIG.MANAGEMENT_EMAIL;
}

/**
 * Checks the recruitment system configuration.
 */
function checkRecruitmentSetup() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  const folderId = props.getProperty('FOLDER_ID');

  if (!sheetId) {
    return {
      ok: false,
      message: 'SHEET_ID is missing. Run setupRecruitment().'
    };
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'onRecruitmentEdit';
    });

  return {
    ok: true,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: sheetId,
    applicationsSheetExists: !!sheet,
    applicationCount: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
    folderConfigured: !!folderId,
    statusTriggersInstalled: triggers.length,
    message: 'Recruitment system check completed.'
  };
}

/**
 * Simple helper for HTML-safe email text.
 */
function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats dates and ordinary values safely for emails.
 */
function formatValue_(value, fallback) {
  if (value === '' || value == null) return fallback;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return escapeHtml_(
      Utilities.formatDate(value, CONFIG.TIMEZONE, 'dd MMMM yyyy')
    );
  }

  return escapeHtml_(value);
}


/* ============================================================
   AI APTITUDE TEST SYSTEM
   Requires Script Property: GEMINI_API_KEY
   Optional Script Property: GEMINI_MODEL
   ============================================================ */

const APTITUDE_HEADERS = [
  'Test ID','Application ID','Position','Applicant Email','Status',
  'Started At','Expires At','Submitted At','Score','Score Over 100','AI Assessment',
  'Questions JSON','Answers JSON','Admin Decision','Admin Notes'
];

function getAptitudeSheet_() {
  const ss = getRecruitmentSpreadsheet_();
  let sheet = ss.getSheetByName('Aptitude Tests');
  if (!sheet) sheet = ss.insertSheet('Aptitude Tests');
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,APTITUDE_HEADERS.length).setValues([APTITUDE_HEADERS]);
  else {
    const row = sheet.getRange(1,1,1,APTITUDE_HEADERS.length).getValues()[0];
    let changed=false;
    APTITUDE_HEADERS.forEach(function(h,i){ if(!row[i]){row[i]=h;changed=true;} });
    if(changed) sheet.getRange(1,1,1,APTITUDE_HEADERS.length).setValues([row]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function generateAptitudeQuestions_(position) {
  const props=PropertiesService.getScriptProperties();
  const key=String(props.getProperty('GEMINI_API_KEY')||'').trim();

  // Gemini is optional. The built-in bank guarantees that every applicant
  // receives an exam even when the API key is missing or Gemini is unavailable.
  if(!key) return fallbackAptitudeQuestions_(position);

  const configuredModel='gemini-3.5-flash-lite';

  const allQuestions=[];
  for(let batch=0;batch<5;batch++){
    const first=batch*10+1;
    const last=first+9;
    try {
      const questions=generateAptitudeBatch_(position,first,last,key,configuredModel);
      questions.forEach(function(q){allQuestions.push(q);});
    } catch(batchError) {
      console.warn('Gemini batch '+first+'-'+last+' failed: '+batchError.message);
      return fallbackAptitudeQuestions_(position);
    }
  }
  if(allQuestions.length!==50) throw new Error('AI generated '+allQuestions.length+' questions instead of exactly 50.');
  const seenQuestions={};
  for(let i=0;i<allQuestions.length;i++){const key=String(allQuestions[i].question||'').replace(/^\s*\d+\.\s*/,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seenQuestions[key]){console.warn('Duplicate/empty AI aptitude question detected; using the unique fallback bank.');return fallbackAptitudeQuestions_(position);}seenQuestions[key]=true;}
  allQuestions.forEach(function(q,i){
    if(!q.question||!Array.isArray(q.options)||q.options.length!==4||typeof q.answer!=='number'||q.answer<0||q.answer>3)
      throw new Error('Invalid AI question at number '+(i+1)+'.');
  });
  return allQuestions;
}


function fallbackAptitudeQuestions_(position){
  const role=String(position||'').toLowerCase();
  const driverRole=/driver|chauffeur|delivery|vehicle operator|transport/.test(role);
  const common=[
    ["What should you do if a supervisor gives an instruction that appears unsafe?",["Pause and clarify the safe procedure before proceeding","Follow it without question","Ask an untrained colleague to decide","Ignore the hazard"],0],
    ["Why should incidents and near misses be reported?",["To identify causes and prevent similar events","Only to assign blame","To avoid maintaining records","Only when equipment is destroyed"],0],
    ["What is the best way to protect confidential company information?",["Share it only with authorised people for a legitimate work purpose","Post it publicly","Send it to any personal contact","Leave it visible in a public area"],0],
    ["A customer raises a complaint. What is the most professional response?",["Listen, record the facts and follow the correct reporting process","Argue immediately","Promise anything to end the discussion","Delete the complaint"],0],
    ["What should you do when you discover a mistake in a work record?",["Report it and correct it transparently using the approved process","Hide the original entry","Change unrelated records","Ask someone to conceal it"],0],
    ["Why is punctuality important at work?",["It supports reliable service and team coordination","It removes the need for quality checks","It guarantees promotion","It means breaks are unnecessary"],0],
    ["What should you do if you do not understand a work instruction?",["Ask the responsible person to explain it","Guess and hope it is correct","Ignore the instruction","Copy an unrelated task"],0],
    ["How should company tools or equipment be treated?",["Use them correctly, inspect them and report defects","Lend them without permission","Ignore damage","Use them for any personal purpose"],0],
    ["What is a good response to a workplace disagreement?",["Discuss the facts respectfully and use the proper escalation route if needed","Threaten the other person","Spread rumours","Stop sharing important safety information"],0],
    ["Why should workers follow approved procedures?",["They help maintain consistent, safe and accountable work","They eliminate all need for judgement","They guarantee no delays","They replace every form of training"],0],
    ["What should you do if you notice a spill that may cause a slip?",["Warn others, secure the area if safe and report or arrange proper cleanup","Walk away without telling anyone","Cover it with paper and leave it","Wait for an accident"],0],
    ["How should you handle a request to falsify attendance or work records?",["Decline and report the request through the proper channel","Comply to avoid questions","Erase the records","Ask a coworker to do it"],0],
    ["What is the purpose of personal protective equipment?",["To reduce exposure to specific hazards when correctly selected and used","To replace every other safety control","To guarantee that no injury is possible","To remove the need for training"],0],
    ["What should happen before using unfamiliar equipment?",["Receive suitable instruction and confirm authorisation","Try it at full speed","Ask a bystander to guess","Remove warning labels"],0],
    ["Why should work-related handovers be clear?",["They help the next person understand status, risks and outstanding tasks","They replace all written records","They prevent every future issue","They are needed only after a failure"],0],
    ["What is the correct response to a conflict of interest?",["Disclose it to the appropriate manager and follow company policy","Hide it if a deal is profitable","Use company resources for personal gain","Ask a client to keep it secret"],0],
    ["How can an employee reduce avoidable waste?",["Use materials responsibly and follow approved storage and disposal practices","Discard usable supplies without checking","Order duplicates without approval","Ignore leaks and damage"],0],
    ["What should you do when a task is beyond your training or authorisation?",["Stop and seek a competent authorised person","Attempt it secretly","Let an unqualified person do it","Remove safety controls"],0],
    ["Why should customer information be checked before processing a request?",["To reduce errors and ensure the request is assigned correctly","To delay the work unnecessarily","To avoid documenting decisions","To share the data more widely"],0],
    ["What makes a useful workplace report?",["Accurate facts, clear timing and relevant actions taken","Rumours and assumptions presented as facts","Only personal opinions","Missing dates and details"],0],
    ["What should you do when two urgent tasks conflict?",["Inform the supervisor and clarify priorities","Silently abandon one task","Choose randomly without telling anyone","Claim both are complete"],0],
    ["How should a worker respond to a safety warning sign?",["Observe it and follow the stated restriction or instruction","Move it to make the route easier","Ignore it if busy","Cover it from view"],0],
    ["Why is respectful communication important in a team?",["It improves coordination and helps resolve issues constructively","It removes the need to do the work","It means concerns should never be raised","It guarantees everyone will agree"],0],
    ["What should you do if company property is lost or damaged?",["Report it promptly with accurate details","Conceal the loss","Create a false replacement record","Wait until someone else notices"],0],
    ["What is the best way to respond to feedback about your work?",["Consider it professionally and clarify practical improvements","Reject all feedback automatically","Blame a colleague","Stop reporting progress"],0]
  ];
  const driver=[
    ["What should a driver check before starting a company vehicle?",["Tyres, brakes, lights, mirrors, fluid leaks and required safety equipment","Only the radio volume","Only the paintwork","The passenger seats only"],0],
    ["What should you do if the brakes feel abnormal before a trip?",["Do not drive; report the defect and arrange inspection","Drive slowly and hope they improve","Carry passengers to test them","Ignore it if the route is short"],0],
    ["What is the safest action when you feel sleepy while driving?",["Stop at a safe place and report the need to rest","Open the window and continue regardless","Drive faster to finish sooner","Use a phone to stay awake"],0],
    ["How should a driver approach a pedestrian crossing?",["Slow down, observe carefully and give way as required","Accelerate through it","Sound the horn continuously instead of slowing","Overtake another vehicle at the crossing"],0],
    ["What should you do after a road traffic collision?",["Stop safely, protect people from further danger, seek assistance and report it","Leave without checking anyone","Argue before checking for injuries","Hide the company vehicle"],0],
    ["Why is maintaining a safe following distance important?",["It provides time and space to react and brake","It allows tailgating","It reduces the need to observe traffic","It guarantees faster arrival"],0],
    ["When should a driver use a seat belt?",["Before moving the vehicle and throughout the journey","Only on highways","Only when carrying a manager","Only when traffic is heavy"],0],
    ["What should you do if a tyre is visibly damaged before a journey?",["Do not use the vehicle until the tyre is assessed and made safe","Inflate it beyond its rating","Hide the damage with a cover","Drive at high speed"],0],
    ["What is the correct approach to speed limits?",["Obey posted limits and drive slower when conditions require it","Exceed them when running late","Follow the fastest vehicle","Ignore limits on familiar roads"],0],
    ["What should you do with a mobile phone while driving?",["Avoid handling it; stop in a safe legal place if communication is necessary","Text while moving slowly","Hold it near the steering wheel","Read messages at traffic lights regardless of safety"],0],
    ["How should cargo be carried in a vehicle?",["Secure it and keep within the vehicle's rated load capacity","Stack it so it blocks the driver's view","Leave heavy items loose","Overload if the trip is short"],0],
    ["What should you do if visibility becomes poor in heavy rain?",["Reduce speed, increase following distance and stop safely if necessary","Use high speed to leave the rain sooner","Follow closely behind a truck","Switch off the headlights at night"],0],
    ["Why should vehicle documents be checked before an assigned trip?",["To ensure required documents are valid and available","To avoid vehicle inspection","To replace a pre-trip check","To determine the passenger's job title"],0],
    ["What should a driver do if a warning light indicates a serious fault?",["Stop safely when appropriate and follow the vehicle fault-reporting procedure","Cover the warning light","Continue until the engine stops","Disconnect the dashboard"],0],
    ["What is defensive driving?",["Anticipating hazards and allowing for mistakes by other road users","Assuming everyone will follow the rules","Driving aggressively to claim space","Using the horn instead of observing"],0],
    ["When reversing a vehicle in a restricted area, what should you do?",["Check all around, use a guide if needed and reverse slowly","Reverse quickly to reduce exposure","Rely only on the horn","Look only in one mirror"],0],
    ["What should you do if a passenger is not wearing a required seat belt?",["Ensure the issue is addressed before moving where legally and safely required","Start moving immediately","Ask the passenger to hold the belt","Ignore it on short journeys"],0],
    ["Why should fuel purchases and mileage be recorded accurately?",["To support accountability, maintenance planning and cost control","To allow records to be estimated later","To conceal excessive fuel use","To avoid checking vehicle condition"],0],
    ["What should a driver do when approaching an emergency vehicle using warning signals?",["Give way safely according to traffic rules and the situation","Race ahead of it","Block its path","Stop abruptly in a dangerous position"],0],
    ["How should a driver handle an unfamiliar route?",["Plan the route before departure and use navigation without unsafe distraction","Study a phone while driving","Make sudden turns without checking","Speed to recover missed turns"],0],
    ["What should you do when a vehicle begins to aquaplane?",["Ease off the accelerator, avoid sudden manoeuvres and regain control smoothly","Brake hard and jerk the steering","Accelerate sharply","Turn the steering repeatedly"],0],
    ["Why is regular vehicle maintenance important?",["It helps identify wear and faults before they create unsafe or costly failures","It removes the need for daily checks","It guarantees no breakdown can occur","It is needed only after a collision"],0],
    ["What should you do if asked to carry more passengers than the vehicle is designed for?",["Decline the unsafe overload and report the request","Accept if the journey is short","Ask passengers to stand","Hide passengers from inspection"],0],
    ["What should a driver do at a railway crossing?",["Follow signals, stop when required and cross only when it is safe and permitted","Race the train","Stop on the tracks to check directions","Follow the vehicle ahead without observing signals"],0],
    ["What is the safest way to manage a delivery schedule?",["Plan realistic travel time and communicate delays instead of driving recklessly","Speed whenever behind schedule","Skip vehicle checks","Use the phone while driving"],0]
  ];
  const bank=[
    ["What is the purpose of a bill of quantities?",["To describe measured work items and quantities for pricing and control","To replace architectural drawings","To record employee attendance","To certify every completed activity"],0],
    ["What should be confirmed before excavation starts?",["Approved drawings, permits and underground-service information","The paint colour for the site office","The lunch schedule","The number of visitors"],0],
    ["What is a practical purpose of surveying before construction?",["To establish reliable positions, levels and site information","To choose staff uniforms","To replace structural design","To determine electricity tariffs"],0],
    ["Why is concrete curing important?",["It supports proper strength development and durability","It changes the colour of concrete","It eliminates reinforcement","It prevents every crack"],0],
    ["What should happen when site conditions differ from the drawings?",["Document the difference and seek technical review before proceeding","Change drawings without approval","Continue regardless","Delete the affected drawing"],0],
    ["What is the main purpose of a project programme?",["To plan activities, sequencing, resources and target dates","To replace the contract","To determine passwords","To eliminate inspections"],0],
    ["What should be checked before lifting a heavy load?",["Load weight, equipment capacity, rigging and the lifting plan","Only the crane colour","Only the weather","The phone battery"],0],
    ["Why inspect materials when they arrive?",["To verify identity, condition and specifications before use","To increase storage time","To avoid records","To change project scope"],0],
    ["What is the purpose of a method statement?",["To explain how a task will be performed safely and correctly","To advertise the contractor","To replace the contract","To calculate salaries"],0],
    ["What should happen to obsolete drawing revisions?",["Control or withdraw them so the current revision is used","Keep them at every workstation","Mix them with current drawings","Give them to visitors"],0],
    ["What does quality control primarily achieve?",["Work and materials conform to specified requirements","Faster work regardless of defects","No project documentation","Automatic approval of variations"],0],
    ["Why are accurate site records important?",["They provide traceable evidence of work, decisions and progress","They lengthen meetings","They replace calculations","They prevent every dispute"],0],
    ["What should happen if a safety control is ineffective?",["Review the task and strengthen the control before unsafe work continues","Ignore the finding","Remove the control permanently","Blame the worker"],0],
    ["What is the purpose of a toolbox talk?",["To discuss task-specific hazards and controls before work","To approve leave","To replace all formal training","To discuss private matters"],0],
    ["What should a project manager do when a delay is identified?",["Assess cause and impact, document it and coordinate corrective action","Hide it from the client","Stop all unrelated work automatically","Change the date without review"],0],
    ["What is a professional way to handle a client complaint?",["Listen, document the issue and respond through the project process","Argue with the client","Delete the complaint","Promise an outcome without checking facts"],0],
    ["What does a risk assessment help a team do?",["Identify hazards and establish suitable controls","Increase paperwork without changing work","Replace all supervision","Set salaries"],0],
    ["What should an employee do if asked to falsify a project record?",["Refuse and report the concern appropriately","Sign it immediately","Delete the original","Ask a colleague to sign"],0],
    ["What does geotechnical investigation help establish?",["Soil and groundwater conditions relevant to foundation decisions","Building facade colour","Payroll totals","Office seating"],0],
    ["Why should site access be controlled?",["To manage safety, security and authorised movement","To prevent all deliveries","To avoid attendance records","To remove supervision"],0],
    ["What should you do before using unfamiliar equipment?",["Receive suitable instruction and confirm authorisation","Try it at full speed","Guess how it works","Remove warning labels"],0],
    ["How should work priorities be handled when deadlines conflict?",["Clarify priorities with the responsible supervisor","Silently abandon one task","Choose randomly","Claim both are complete"],0],
    ["Why should project variations be documented?",["To record the change, its approval and its cost or time impact","To avoid client communication","To replace all drawings","To remove accountability"],0],
    ["What is the best response to a near miss?",["Report and investigate it to improve controls","Hide it because no one was hurt","Wait until the project ends","Blame the nearest worker"],0],
    ["What should be done when a worker is unsure about a procedure?",["Pause and seek clarification from a competent supervisor","Guess and continue","Copy an unrelated procedure","Ignore the uncertainty"],0]
  ];
  const selected=driverRole?driver:bank;
  const questions=selected.concat(common).map(function(q){return {question:q[0],options:q[1].slice(),answer:q[2]};});
  const seen={};
  const unique=questions.filter(function(q){const key=q.question.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(seen[key])return false;seen[key]=true;return true;});
  if(unique.length<50) throw new Error('The built-in aptitude question bank needs at least 50 unique questions.');
  return unique.slice(0,50).map(function(q,i){return {question:(i+1)+'. '+q.question,options:q.options,answer:q.answer};});
}

function generateAptitudeBatch_(position,first,last,key,configuredModel){
  const count=last-first+1;
  const prompt='Live generation seed: '+Utilities.getUuid()+'. Create exactly '+count+' concise multiple-choice aptitude questions, numbered '+first+' through '+last+
    ', for a Nigerian engineering and construction company applicant applying for the role: '+position+'. '+
    'Every question must directly match the applicant role. For a Driver, use driving rules, vehicle checks, road safety, passenger/cargo handling, trip records and defensive driving; do not ask quantity-surveying or engineering-calculation questions. Cover role knowledge, practical judgement, safety, problem solving, ethics and workplace scenarios. '+
    'Generate a fresh randomized question set for this applicant. Do not repeat or paraphrase any question within the 50-question exam, including across batches; each question must test a distinct skill or scenario. '+
    'Each question must have exactly 4 options and exactly one correct answer. '+
    'Do not use private company information. Keep questions and options concise. Do not include explanations.';

  const schema={type:'OBJECT',properties:{questions:{type:'ARRAY',minItems:count,maxItems:count,items:{
    type:'OBJECT',properties:{
      question:{type:'STRING'},
      options:{type:'ARRAY',minItems:4,maxItems:4,items:{type:'STRING'}},
      answer:{type:'INTEGER',minimum:0,maximum:3}
    },required:['question','options','answer']
  }}},required:['questions']};

  const payload={contents:[{parts:[{text:prompt}]}],generationConfig:{
    responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:7000
  }};

  const models=[];
  [configuredModel,'gemini-3.8-flash','gemini-3.6-flash','gemini-3.1-flash-lite'].forEach(function(m){
    if(m&&models.indexOf(m)===-1) models.push(m);
  });

  let lastError='';
  for(let mi=0;mi<models.length;mi++){
    const activeModel=models[mi];
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(activeModel)+':generateContent';

    for(let attempt=0;attempt<4;attempt++){
      let response=null;
      try{
        response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
          headers:{'x-goog-api-key':key},muteHttpExceptions:true,payload:JSON.stringify(payload)});
      }catch(e){lastError='Could not reach Gemini ('+activeModel+'): '+e.message;}

      if(!response){
        if(attempt<3){Utilities.sleep((3000*Math.pow(2,attempt))+Math.floor(Math.random()*1500));continue;}
        break;
      }

      const code=response.getResponseCode();
      const raw=response.getContentText();

      if(code>=200&&code<300){
        try{
          const body=JSON.parse(raw);
          const candidate=body.candidates&&body.candidates[0];
          const text=candidate&&candidate.content&&candidate.content.parts&&candidate.content.parts[0]&&candidate.content.parts[0].text;
          if(!text) throw new Error('Gemini returned no question content.');
          const parsed=JSON.parse(text);
          if(!parsed.questions||!Array.isArray(parsed.questions)||parsed.questions.length!==count)
            throw new Error('Gemini generated '+((parsed.questions&&parsed.questions.length)||0)+' questions for batch '+first+'-'+last+'.');
          return parsed.questions;
        }catch(e){
          lastError='Gemini response error ('+activeModel+'): '+e.message;
          break;
        }
      }

      let detail=raw;
      try{const apiErr=JSON.parse(raw);detail=(apiErr.error&&(apiErr.error.message||apiErr.error.status))||raw;}catch(ignore){}
      lastError='Gemini API error HTTP '+code+' ('+activeModel+'): '+String(detail).slice(0,700);

      if(code===503||code===429||code===408||code===500||code===502||code===504){
        if(attempt<3){Utilities.sleep((3000*Math.pow(2,attempt))+Math.floor(Math.random()*1500));continue;}
      }
      break;
    }
  }

  // Gemini capacity errors must never prevent an applicant from getting an exam.
  console.warn('All Gemini models unavailable for batch '+first+'-'+last+'. Using built-in aptitude bank. Last error: '+lastError);
  return fallbackAptitudeQuestions_(position).slice(first-1,last);
}

/**
 * Manual diagnostic. Run this from Apps Script once after deployment/update.
 * It generates 50 questions without creating an applicant or sending email.
 */
function recruitmentBuildInfo(){
  return 'TW&D RECRUITMENT BUILD 2026-09-28-AI-LIVE-SCORE100-09';
}

function testAptitudeAI(){
  const questions=generateAptitudeQuestions_('Site Engineer / Project Engineer');
  return recruitmentBuildInfo()+' | TEST PASSED: '+questions.length+' questions are available. Gemini is optional; the built-in fallback guarantees the exam if Gemini is unavailable.';
}

function startAptitudeTest(applicationId, position, email) {
  const appSheet=getApplicationsSheet_(getRecruitmentSpreadsheet_()), appData=appSheet.getDataRange().getValues();
  let approved=false, approvedPosition=position, approvedEmail=email;
  for(let r=1;r<appData.length;r++) if(String(appData[r][0])===String(applicationId)){
    const status=String(appData[r][13]||'').trim();
    if(status!=='Successful'&&status!=='Approved') throw new Error('Your application has not yet been approved for the aptitude test.');
    approved=true; approvedPosition=String(appData[r][5]||position); approvedEmail=String(appData[r][3]||email); break;
  }
  if(!approved) throw new Error('Approved application record not found.');

  const sheet=getAptitudeSheet_(), values=sheet.getDataRange().getValues();
  for(let r=1;r<values.length;r++) if(String(values[r][1])===String(applicationId)){
    const status=String(values[r][4]||'');
    if(status==='IN_PROGRESS'&&values[r][6]&&new Date(values[r][6]).getTime()>Date.now()){
      // Repair older active tests that were created with generic or repeated questions.
      let savedQuestions=[];
      try{savedQuestions=JSON.parse(String(values[r][11]||'[]'));}catch(ignore){}
      const seenSaved={};
      let hasDuplicate=false;
      savedQuestions.forEach(function(q){const key=String(q.question||'').replace(/^\\s*\\d+\\.\\s*/,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seenSaved[key])hasDuplicate=true;seenSaved[key]=true;});
      const isDriver=/driver|chauffeur|delivery|vehicle operator|transport/i.test(approvedPosition);
      const driverTerms=/\\b(vehicle|brakes|tyres?|traffic|seat belt|driving|road|pedestrian|cargo|mileage|fuel|reversing|speed limit|aquaplaning|railway crossing)\\b/i;
      const driverRelevant=savedQuestions.filter(function(q){return driverTerms.test(String(q.question||''));}).length;
      if(savedQuestions.length!==50||hasDuplicate||(isDriver&&driverRelevant<8)){
        const repaired=generateAptitudeQuestions_(approvedPosition);
        sheet.getRange(r+1,12).setValue(JSON.stringify(repaired));
        values[r][11]=JSON.stringify(repaired);
      }
      return aptitudeClientPayload_(values[r]);
    }
    if(status==='SUBMITTED_AI_MARKED_PENDING_ADMIN'||status==='APPROVED'||status==='REJECTED') return {ok:false,status:status,message:'This aptitude test has already been submitted.'};
  }

  const questions=generateAptitudeQuestions_(approvedPosition), now=new Date(), expires=new Date(now.getTime()+60*60*1000);
  const testId='APT-'+Utilities.formatDate(now,CONFIG.TIMEZONE,'yyyyMMdd-HHmmss')+'-'+Math.floor(1000+Math.random()*9000);
  // Keep each value aligned with APTITUDE_HEADERS: Questions JSON is column L (12), not K.
  sheet.appendRow([testId,applicationId,approvedPosition,approvedEmail,'IN_PROGRESS',now,expires,'','','','',JSON.stringify(questions),'','PENDING','']);
  return {ok:true,testId:testId,applicationId:applicationId,position:approvedPosition,email:approvedEmail,startedAt:now.toISOString(),expiresAt:expires.toISOString(),questions:questions.map(function(q){return {question:q.question,options:q.options};})};
}

function loginAptitude(username,password){
  username=String(username||'').trim(); password=String(password||'');
  if(!username||!password) throw new Error('Enter your aptitude-test username and password.');
  const sheet=getApplicationsSheet_(getRecruitmentSpreadsheet_()), data=sheet.getDataRange().getValues();
  for(let r=1;r<data.length;r++){
    const row=data[r];
    if(String(row[28]||'').trim()!==username) continue;
    const status=String(row[13]||'').trim();
    if(['SUCCESSFUL','APPROVED'].indexOf(status.toUpperCase())===-1) throw new Error('This application is not approved for the aptitude test.');
    if(hashAptitudePassword_(password)!==String(row[29]||'').trim()) throw new Error('Invalid aptitude-test username or password.');
    return startAptitudeTest(row[0],row[5],row[3]);
  }
  throw new Error('Invalid aptitude-test username or password.');
}

function aptitudeClientPayload_(row) {
  const questions=JSON.parse(String(row[11]||'[]'));
  return {
    ok:true,testId:row[0],applicationId:row[1],position:row[2],
    startedAt:new Date(row[5]).toISOString(),expiresAt:new Date(row[6]).toISOString(),
    email:String(row[3]||''),
    questions:questions.map(function(q){return {question:q.question,options:q.options};})
  };
}

function submitAptitudeTest(testId, answers) {
  const sheet=getAptitudeSheet_(), data=sheet.getDataRange().getValues();
  let rowNumber=-1,row=null;
  for(let r=1;r<data.length;r++) if(String(data[r][0])===String(testId)){rowNumber=r+1;row=data[r];break;}
  if(rowNumber<0) throw new Error('Aptitude test not found.');
  if(String(row[4])!=='IN_PROGRESS') throw new Error('This aptitude test is no longer open.');
  const expired=new Date(row[6]).getTime()<Date.now();
  const questions=JSON.parse(String(row[11]||'[]'));
  if(!Array.isArray(questions)||questions.length!==50) throw new Error('The saved aptitude test does not contain 50 questions. Please contact recruitment support.');
  if(!Array.isArray(answers)||answers.length!==50) throw new Error('The aptitude test submission is incomplete.');

  const key=questions.map(function(q){return Number(q.answer);});
  let correct=0;
  for(let i=0;i<50;i++) if(Number(answers[i])===key[i]) correct++;
  const score100=Math.round((correct/50)*100);

  let assessment='Automatic score: '+score100+'/100. AI assessment is pending administrator review.';
  try{assessment=markAptitudeWithAI_(row[2],questions,answers,score100);}catch(aiError){console.error('AI marking failed:',aiError);}
  if(expired) assessment='Automatic score: '+score100+'/100. '+assessment+' The test was submitted automatically at the end of the 1-hour window.';

  const submitted=new Date();
  sheet.getRange(rowNumber,5,1,11).setValues([[
    'SUBMITTED_AI_MARKED_PENDING_ADMIN',row[5],row[6],submitted,correct,score100,assessment,row[11],JSON.stringify(answers),'PENDING',row[14]||''
  ]]);
  updateApplicationAptitude_(row[1],score100,assessment,submitted);
  notifyAptitudeAdmin_(row,score100,assessment);
  return {ok:true,score:score100,total:100,status:'SUBMITTED_AI_MARKED_PENDING_ADMIN',message:'Your aptitude test has been submitted. The AI-marked result has been sent to TW&D management for review. The result will be released after administrator approval, within 24 hours.'};
}


function markAptitudeWithAI_(position,questions,answers,score100) {
  const key=String(PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')||'').trim();
  if(!key) return 'Automatic score: '+score100+'/100. AI assessment is pending administrator review.';
  const model=String(PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL')||'gemini-3.8-flash').trim();
  const compact=questions.map(function(q,i){return {n:i+1,q:q.question,options:q.options,correct:q.answer,applicant:answers[i]};});
  const prompt='Assess this 50-question aptitude test for the applicant position "'+position+'". The objective score is '+score100+'/100. Analyze the answer pattern and provide a concise administrator report with overall performance, strengths, technical gaps, safety/ethics concerns, and topics to verify at interview. Do not make a hiring decision and do not change the numeric score. Return plain text. DATA: '+JSON.stringify(compact);
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
  const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},muteHttpExceptions:true,payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}})});
  const code=response.getResponseCode(),raw=response.getContentText();
  if(code<200||code>=300) throw new Error('AI marking failed HTTP '+code+': '+raw.slice(0,500));
  const body=JSON.parse(raw);
  const text=body.candidates&&body.candidates[0]&&body.candidates[0].content&&body.candidates[0].content.parts&&body.candidates[0].content.parts[0]&&body.candidates[0].content.parts[0].text;
  return text||('Automatic score: '+score100+'/100. AI assessment pending administrator review.');
}

function approveAptitudeResult(testId,adminNotes) {
  const sheet=getAptitudeSheet_(),data=sheet.getDataRange().getValues();
  for(let r=1;r<data.length;r++) if(String(data[r][0])===String(testId)){
    const row=data[r];
    if(String(row[4])!=='SUBMITTED_AI_MARKED_PENDING_ADMIN') throw new Error('This aptitude result is not awaiting administrator approval.');
    const score100=Number(row[9]||0),assessment=String(row[10]||''),notes=String(adminNotes||row[13]||'').trim();
    const releasedAt=new Date();
    sheet.getRange(r+1,14,1,3).setValues([['APPROVED',notes,releasedAt]]);
    sendAptitudeResultToApplicant_(row,score100,assessment,notes,releasedAt);
    return 'Aptitude result approved and released to the applicant.';
  }
  throw new Error('Aptitude test not found.');
}

function sendAptitudeResultToApplicant_(row,score100,assessment,adminNotes,releasedAt) {
  const email=String(row[3]||'').trim();
  if(!email) throw new Error('Applicant email is missing.');
  const subject='TW&D Aptitude Test Result — '+row[2];
  const html='<h2>TW&D Engineering Consult &amp; Services Ltd — Aptitude Test Result</h2>'+
    '<p>Dear Applicant,</p><p>Your aptitude test result has been reviewed and approved by TW&amp;D management.</p>'+
    '<p><b>Position:</b> '+escapeHtml_(row[2])+'</p><p><b>Score:</b> '+score100+'/100</p>'+
    '<h3>Assessment</h3><p>'+escapeHtml_(assessment).replace(/\n/g,'<br>')+'</p>'+
    (adminNotes?'<h3>Management Note</h3><p>'+escapeHtml_(adminNotes).replace(/\n/g,'<br>')+'</p>':'')+
    '<p>Your result has been released following the recruitment review process. Final recruitment communication is expected within 24 hours.</p>'+
    '<p>Regards,<br><b>'+CONFIG.COMPANY_NAME+'</b></p>';
  sendTransactionalEmail_(email,subject,html);
}


function updateApplicationAptitude_(applicationId,score,assessment,submitted) {
  const sheet=getApplicationsSheet_(getRecruitmentSpreadsheet_());
  const data=sheet.getDataRange().getValues();
  for(let r=1;r<data.length;r++) if(String(data[r][0])===String(applicationId)){
    sheet.getRange(r+1,20,1,4).setValues([['SUBMITTED_AI_MARKED_PENDING_ADMIN',score,submitted,assessment]]);
    return;
  }
}

function notifyAptitudeAdmin_(row,score,assessment) {
  const subject='TW&D aptitude test submitted: '+row[5];
  const html='<h2>Applicant aptitude test submitted</h2><p><b>Application ID:</b> '+escapeHtml_(row[0])+'</p><p><b>Applicant:</b> '+escapeHtml_(row[2])+'</p><p><b>Position:</b> '+escapeHtml_(row[5])+'</p><p><b>Score:</b> '+score+'/100</p><p><b>AI assessment:</b><br>'+escapeHtml_(assessment).replace(/\n/g,'<br>')+'</p><p>The application is awaiting administrator review and approval.</p>';
  try { sendTransactionalEmail_(CONFIG.MANAGEMENT_EMAIL,subject,html); } catch(e) { console.error(e); }
}

function sendTransactionalEmail_(to,subject,htmlBody) {
  to = String(to || '').trim();
  subject = String(subject || '').trim();
  htmlBody = String(htmlBody || '').trim();

  if (!subject) throw new Error('Refusing to send an email without a subject.');
  if (!htmlBody || htmlBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() === '') {
    throw new Error('Refusing to send an email with an empty body.');
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Invalid recipient email address.');
  }

  const key = String(
    PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY') || ''
  ).trim();

  // Resend is attempted once only. A rate limit is never retried synchronously.
  // This prevents email-provider problems from blocking the recruitment workflow.
  const resendPausedUntil = Number(
    PropertiesService.getScriptProperties().getProperty('RESEND_PAUSED_UNTIL') || 0
  );
  const resendPaused = resendPausedUntil > Date.now();

  if (key && !resendPaused) {
    try {
      const response = UrlFetchApp.fetch(
        'https://api.resend.com/emails',
        {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + key },
          muteHttpExceptions: true,
          payload: JSON.stringify({
            from: 'TW&D Engineering Consult & Services Ltd <contact@twdengineeringconsult.com>',
            to: [to],
            subject: subject,
            html: htmlBody
          })
        }
      );

      const code = response.getResponseCode();
      const raw = response.getContentText();

      if (code >= 200 && code < 300) {
        PropertiesService.getScriptProperties().deleteProperty('RESEND_PAUSED_UNTIL');
        return true;
      }

      if (code === 429) {
        PropertiesService.getScriptProperties().setProperty(
          'RESEND_PAUSED_UNTIL',
          String(Date.now() + 60 * 60 * 1000)
        );
        console.warn('Resend HTTP 429. Resend paused for 60 minutes; using MailApp.');
      } else {
        console.warn('Resend unavailable HTTP ' + code + '. Falling back to MailApp immediately.');
      }
    } catch (e) {
      console.warn('Resend request failed. Falling back to MailApp: ' + (e.message || String(e)));
    }
  }

  if (MailApp.getRemainingDailyQuota() <= 0) {
    throw new Error(
      'All email transports are temporarily unavailable. The application remains queued and will retry automatically.'
    );
  }

  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: htmlBody,
      body: String(htmlBody)
        .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    });
    return true;
  } catch (e) {
    throw new Error(
      'MailApp delivery failed. The email remains queued for automatic retry: ' +
      (e.message || String(e))
    );
  }
}