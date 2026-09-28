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
  'Next Email Attempt At'
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
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Application')
    .setTitle(CONFIG.COMPANY_NAME + ' Careers')
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

  return {
    ok: true,
    id: id,
    applicantEmailSent: false,
    managementEmailSent: false,
    emailQueued: true,
    message: 'Application submitted successfully. Your reference is ' + id + '. Your confirmation email has been queued for automatic delivery.'
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
  const id = row[0];
  const name = row[2];
  const email = row[3];
  const phone = row[4];
  const position = row[5];
  const location = row[6];
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
  if (!row || typeof row.getValues !== 'function') {
    throw new Error('No valid application row was supplied.');
  }

  const values = row.getValues()[0];

  const id = values[0];
  const name = values[2];
  const email = String(values[3] || '').trim();
  const position = values[5];
  const status = String(values[13] || '').trim();
  const interviewDate = values[14];
  const interviewTime = values[15];
  const interviewLocation = values[16];
  const interviewType = values[17];

  if (!email) {
    throw new Error('This application does not contain an applicant email address.');
  }

  if (!status) {
    throw new Error('This application does not contain a status.');
  }

  let subject = 'TW&D application update — ' + status;

  let body =
    '<p>Dear ' + escapeHtml_(name || 'Applicant') + ',</p>' +
    '<p>Your application with <b>' + CONFIG.COMPANY_NAME + '</b> has been updated.</p>' +
    '<p><b>Application Reference:</b> ' + escapeHtml_(id) + '</p>' +
    '<p><b>Position:</b> ' + escapeHtml_(position) + '</p>' +
    '<p><b>Status:</b> ' + escapeHtml_(status) + '</p>';

  if (status === 'Interview Scheduled') {
    body +=
      '<h3>Interview Details</h3>' +
      '<p><b>Date:</b> ' + formatValue_(interviewDate, 'To be confirmed') + '</p>' +
      '<p><b>Time:</b> ' + formatValue_(interviewTime, 'To be confirmed') + '</p>' +
      '<p><b>Location:</b> ' + escapeHtml_(interviewLocation || 'To be confirmed') + '</p>' +
      '<p><b>Type:</b> ' + escapeHtml_(interviewType || 'To be confirmed') + '</p>';
  }

  body +=
    '<p>Thank you for your interest in joining TW&D Engineering Consult & Services Ltd.</p>' +
    '<p>Regards,<br><b>' + CONFIG.COMPANY_NAME + '</b></p>';

  sendTransactionalEmail_(email, subject, body);

  return 'Status email sent successfully to ' + email;
}

/**
 * Automatically runs when management edits the Applications spreadsheet.
 * Only a change in column 14 (Status) sends an applicant email.
 */
function onRecruitmentEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();

  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  if (range.getRow() === 1) return;

  // Only react to edits touching the Status column.
  if (range.getColumn() !== 14) return;

  const rowNumber = range.getRow();
  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length);

  const status = String(sheet.getRange(rowNumber, 14).getValue() || '').trim();

  if (!status) return;

  sendStatusEmail(row);
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
  'Started At','Expires At','Submitted At','Score','AI Assessment',
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
  if(!key) throw new Error('GEMINI_API_KEY is missing from Recruitment Apps Script → Project Settings → Script Properties.');
  // Use a capacity-friendly stable model first. Do not let an old Script Property force a congested model.\n  const configuredModel='gemini-3.5-flash-lite';

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
  allQuestions.forEach(function(q,i){
    if(!q.question||!Array.isArray(q.options)||q.options.length!==4||typeof q.answer!=='number'||q.answer<0||q.answer>3)
      throw new Error('Invalid AI question at number '+(i+1)+'.');
  });
  return allQuestions;
}


function fallbackAptitudeQuestions_(position){
  const bank=[
    ["Before starting excavation work, what should be confirmed first?",["The approved drawings, permits and underground-service information","The paint colour for the site office","The lunch schedule","The number of visitors"],0],
    ["What is the main purpose of a risk assessment?",["To identify hazards and establish suitable controls","To increase paperwork without changing work","To replace all site supervision","To determine staff salaries"],0],
    ["A worker notices damaged electrical insulation. What is the safest action?",["Stop using the equipment and report it for isolation and repair","Cover it with paper and continue","Ignore it if the equipment still works","Ask another worker to use it"],0],
    ["Why are PPE requirements important on a construction site?",["They reduce exposure to identified workplace hazards","They remove the need for training","They guarantee that accidents cannot happen","They replace safe work procedures"],0],
    ["What should a project engineer do when site conditions differ materially from the drawings?",["Document the difference and seek the appropriate technical review before proceeding","Change the drawings personally without approval","Continue regardless of the difference","Delete the affected drawing"],0],
    ["What is the best response to a near miss?",["Report and investigate it so controls can be improved","Hide it because nobody was injured","Wait until the end of the project","Blame the nearest worker"],0],
    ["Why is concrete curing important?",["It supports proper strength development and durability","It makes concrete change colour","It eliminates the need for reinforcement","It prevents all cracking"],0],
    ["What should be checked before lifting a heavy load?",["Load weight, lifting equipment capacity, rigging and the lifting plan","Only the colour of the crane","The weather forecast alone","The worker's phone battery"],0],
    ["What does good quality control primarily achieve?",["Conformance of work and materials with specified requirements","Faster work regardless of defects","Elimination of project documentation","Automatic approval of all variations"],0],
    ["If a drawing revision is issued, what should happen to obsolete copies?",["They should be controlled or withdrawn so the current revision is used","They should remain on every workbench","They should be mixed with current drawings","They should be given to visitors"],0],
    ["What is a key reason for keeping accurate site records?",["They provide traceable evidence of work, decisions and progress","They make meetings longer","They replace engineering calculations","They prevent every dispute"],0],
    ["What should an employee do if asked to falsify a project record?",["Refuse and report the concern through the appropriate channel","Sign it immediately","Delete the original record","Ask a colleague to sign it"],0],
    ["What is the purpose of a method statement?",["To describe how a task will be carried out safely and correctly","To advertise the contractor","To replace the contract","To calculate employee salaries"],0],
    ["What is the safest approach when a worker is unsure about a procedure?",["Pause and seek clarification from the responsible supervisor or competent person","Guess and continue","Copy an unrelated procedure","Ignore the uncertainty"],0],
    ["What is a practical purpose of surveying before construction?",["To establish reliable positions, levels and site information","To choose staff uniforms","To replace structural design","To determine electricity tariffs"],0],
    ["What does a borehole drilling investigation help determine?",["Subsurface conditions and groundwater information relevant to the investigation","The colour of a building facade","The project payroll","The office seating plan"],0],
    ["Why is geotechnical investigation important to building design?",["It helps characterize soil and groundwater conditions for foundation decisions","It guarantees zero construction cost changes","It replaces architectural drawings","It removes the need for site inspection"],0],
    ["What should happen when a safety control is found ineffective?",["Work should be reviewed and the control strengthened before unsafe work continues","The finding should be ignored","The control should be removed permanently","The worker should be blamed"],0],
    ["What is the purpose of a toolbox talk?",["To communicate task-specific hazards, controls and expectations before work","To approve staff leave","To replace all formal training","To discuss private matters"],0],
    ["Why should materials be inspected on delivery?",["To verify identity, condition and required specifications before use","To increase storage time","To avoid keeping records","To change the project scope"],0],
    ["What should a project manager do when a delay is identified?",["Assess its cause and impact, document it and coordinate corrective action","Hide it from the client","Stop all unrelated work automatically","Change the completion date without review"],0],
    ["What is the purpose of a bill of quantities?",["To describe measured work items and quantities for pricing and control","To replace architectural drawings","To record employee attendance","To certify every completed activity"],0],
    ["What is a professional way to handle a client complaint?",["Listen, document the issue and respond through the appropriate project process","Argue with the client","Delete the complaint","Promise an outcome without checking facts"],0],
    ["Why should site access be controlled?",["To manage safety, security and authorized movement around the work area","To prevent all deliveries","To avoid keeping attendance records","To reduce the need for supervision"],0],
    ["What is the main purpose of a project programme?",["To plan activities, sequencing, resources and target dates","To replace the contract","To determine employee passwords","To eliminate inspections"],0]
  ];
  const questions=[];
  for(let i=0;i<50;i++){
    const base=bank[i%bank.length];
    const cycle=Math.floor(i/bank.length);
    questions.push({
      question:(i+1)+'. '+base[0]+' Role focus: '+position+'.',
      options:base[1].slice(),
      answer:base[2]
    });
  }
  return questions;
}

function generateAptitudeBatch_(position,first,last,key,configuredModel){
  const count=last-first+1;
  const prompt='Create exactly '+count+' concise multiple-choice aptitude questions, numbered '+first+' through '+last+
    ', for a Nigerian engineering and construction company applicant applying for the role: '+position+'. '+
    'Cover role knowledge, practical judgement, safety, problem solving, ethics and workplace scenarios. '+
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

  // Gemini capacity errors must never prevent an applicant from getting an exam.\n  console.warn('All Gemini models unavailable for batch '+first+'-'+last+'. Using built-in aptitude bank. Last error: '+lastError);\n  return fallbackAptitudeQuestions_(position).slice(first-1,last);
}

/**
 * Manual diagnostic. Run this from Apps Script once after deployment/update.
 * It generates 50 questions without creating an applicant or sending email.
 */
function recruitmentBuildInfo(){
  return 'TW&D RECRUITMENT BUILD 2026-09-28-EMAIL-QUEUE-06';
}

function testAptitudeAI(){
  const questions=generateAptitudeQuestions_('Site Engineer / Project Engineer');
  return recruitmentBuildInfo()+' | TEST PASSED: '+questions.length+' questions are available. Gemini is optional; the built-in fallback guarantees the exam if Gemini is unavailable.';
}

function startAptitudeTest(applicationId, position, email) {
  const sheet=getAptitudeSheet_();
  const values=sheet.getDataRange().getValues();
  for(let r=1;r<values.length;r++){
    if(String(values[r][1])===String(applicationId)){
      const status=String(values[r][4]||'');
      if(status==='IN_PROGRESS' && values[r][6] && new Date(values[r][6]).getTime()>Date.now()) {
        return aptitudeClientPayload_(values[r]);
      }
      if(status==='SUBMITTED_AI_MARKED_PENDING_ADMIN' || status==='APPROVED' || status==='REJECTED') {
        return {ok:false,status:status,message:'This aptitude test has already been submitted.'};
      }
    }
  }

  const questions=generateAptitudeQuestions_(position);
  const now=new Date();
  const expires=new Date(now.getTime()+60*60*1000);
  const testId='APT-'+Utilities.formatDate(now,CONFIG.TIMEZONE,'yyyyMMdd-HHmmss')+'-'+Math.floor(1000+Math.random()*9000);
  sheet.appendRow([testId,applicationId,position,email||'', 'IN_PROGRESS', now, expires, '', '', '', JSON.stringify(questions), '', 'PENDING', '']);
  return {
    ok:true,testId:testId,applicationId:applicationId,position:position,
    startedAt:now.toISOString(),expiresAt:expires.toISOString(),
    questions:questions.map(function(q){return {question:q.question,options:q.options};})
  };
}

function aptitudeClientPayload_(row) {
  const questions=JSON.parse(String(row[10]||'[]'));
  return {
    ok:true,testId:row[0],applicationId:row[1],position:row[2],
    startedAt:new Date(row[5]).toISOString(),expiresAt:new Date(row[6]).toISOString(),
    questions:questions.map(function(q){return {question:q.question,options:q.options};})
  };
}

function submitAptitudeTest(testId, answers) {
  const sheet=getAptitudeSheet_();
  const data=sheet.getDataRange().getValues();
  let rowNumber=-1,row=null;
  for(let r=1;r<data.length;r++) if(String(data[r][0])===String(testId)){rowNumber=r+1;row=data[r];break;}
  if(rowNumber<0) throw new Error('Aptitude test not found.');
  if(String(row[4])!=='IN_PROGRESS') throw new Error('This aptitude test is no longer open.');
  if(new Date(row[6]).getTime()<Date.now()) {
    sheet.getRange(rowNumber,5).setValue('EXPIRED');
    throw new Error('The 1-hour aptitude test window has expired.');
  }

  const questions=JSON.parse(String(row[10]||'[]'));
  if(!Array.isArray(answers) || answers.length!==50) throw new Error('Please answer all 50 questions before submitting.');

  const key=questions.map(function(q){return Number(q.answer);});
  let score=0;
  for(let i=0;i<50;i++) if(Number(answers[i])===key[i]) score++;

  let assessment='AI assessment unavailable.';
  try { assessment=markAptitudeWithAI_(row[2],questions,answers,score); }
  catch(aiError) { console.error('AI marking failed:',aiError); assessment='Automatic score: '+score+'/50. AI assessment is pending administrator review.'; }

  const submitted=new Date();
  sheet.getRange(rowNumber,5,1,10).setValues([[
    'SUBMITTED_AI_MARKED_PENDING_ADMIN',row[5],row[6],submitted,score,assessment,row[10],JSON.stringify(answers),'PENDING',row[13]||''
  ]]);
  updateApplicationAptitude_(row[1],score,assessment,submitted);
  notifyAptitudeAdmin_(row,score,assessment);

  return {ok:true,score:score,total:50,status:'SUBMITTED_AI_MARKED_PENDING_ADMIN',message:'Your aptitude test has been submitted. Your application and result have been sent to TW&D management for review. The recruitment result will be communicated within 24 hours.'};
}

function markAptitudeWithAI_(position,questions,answers,score) {
  const key=PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if(!key) return 'Automatic score: '+score+'/50. AI assessment pending administrator review.';
  const model=PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-3.8-flash';
  const compact=questions.map(function(q,i){return {n:i+1,q:q.question,options:q.options,correct:q.answer,applicant:answers[i]};});
  const prompt='Assess an applicant aptitude test for the role '+position+'. There are 50 multiple-choice questions. The automatic score is '+score+'/50. Review the answer pattern and provide a concise professional assessment for the administrator: strengths, notable gaps, safety/ethics concerns if any, and a suggested review focus. Do not make a final hiring decision. Return plain text. DATA: '+JSON.stringify(compact);
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
  const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},muteHttpExceptions:true,payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}})});
  const code=response.getResponseCode();
  const raw=response.getContentText();
  if(code<200 || code>=300){
    let detail=raw;
    try{
      const apiErr=JSON.parse(raw);
      detail=(apiErr.error&&(apiErr.error.message||apiErr.error.status))||raw;
    }catch(ignore){}
    throw new Error('AI marking failed HTTP '+code+': '+String(detail).slice(0,500));
  }
  const body=JSON.parse(raw);
  const text=body.candidates&&body.candidates[0]&&body.candidates[0].content&&body.candidates[0].content.parts&&body.candidates[0].content.parts[0]&&body.candidates[0].content.parts[0].text;
  return text || ('Automatic score: '+score+'/50.');
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
  const html='<h2>Applicant aptitude test submitted</h2><p><b>Application ID:</b> '+escapeHtml_(row[0])+'</p><p><b>Applicant:</b> '+escapeHtml_(row[2])+'</p><p><b>Position:</b> '+escapeHtml_(row[5])+'</p><p><b>Score:</b> '+score+'/50</p><p><b>AI assessment:</b><br>'+escapeHtml_(assessment).replace(/\n/g,'<br>')+'</p><p>The application is awaiting administrator review and approval.</p>';
  try { sendTransactionalEmail_(CONFIG.MANAGEMENT_EMAIL,subject,html); } catch(e) { console.error(e); }
}

function sendTransactionalEmail_(to,subject,htmlBody) {
  to = String(to || '').trim();
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