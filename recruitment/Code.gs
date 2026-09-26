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
  'Management Notes'
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

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
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

  const now = new Date();
  const id =
    'TWD-' +
    Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');

  let cvUrl = '';
  let docsUrl = '';

  if (data.cv && data.cv.base64) {
    const bytes = Utilities.base64Decode(data.cv.base64);
    const blob = Utilities.newBlob(
      bytes,
      data.cv.mimeType || 'application/octet-stream',
      data.cv.name || id + '-CV'
    );
    cvUrl = folder.createFile(blob).getUrl();
  }

  if (data.supporting && data.supporting.base64) {
    const bytes = Utilities.base64Decode(data.supporting.base64);
    const blob = Utilities.newBlob(
      bytes,
      data.supporting.mimeType || 'application/octet-stream',
      data.supporting.name || id + '-Supporting'
    );
    docsUrl = folder.createFile(blob).getUrl();
  }

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
    cvUrl,
    docsUrl,
    'Application Received',
    '',
    '',
    '',
    '',
    ''
  ];

  sheet.appendRow(row);

  // Notify management.
  sendManagementNewApplicationEmail_(row);

  // Confirm receipt to applicant.
  sendApplicantReceiptEmail_(row);

  return {
    ok: true,
    id: id,
    message: 'Application submitted successfully. Your reference is ' + id + '. A confirmation email has been sent.'
  };
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

  MailApp.sendEmail({
    to: CONFIG.MANAGEMENT_EMAIL,
    replyTo: 'careers@twdengineeringconsult.com',
    subject: 'New TW&D job application: ' + position,
    htmlBody: html
  });
}

/**
 * Confirmation email to applicant.
 */
function sendApplicantReceiptEmail_(row) {
  const id = row[0];
  const name = row[2];
  const email = row[3];
  const position = row[5];

  MailApp.sendEmail({
    to: email,
    replyTo: 'careers@twdengineeringconsult.com',
    subject: 'Application received — TW&D Engineering Consult & Services Ltd',
    htmlBody:
      '<p>Dear ' + escapeHtml_(name) + ',</p>' +
      '<p>Thank you for applying to <b>' + CONFIG.COMPANY_NAME + '</b>.</p>' +
      '<p><b>Application reference:</b> ' + escapeHtml_(id) + '</p>' +
      '<p><b>Position:</b> ' + escapeHtml_(position) + '</p>' +
      '<p>Your application has been received and will be reviewed by our management team. We will contact you regarding the next stage.</p>' +
      '<p>Regards,<br><b>' + CONFIG.COMPANY_NAME + '</b></p>'
  });
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

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: body
  });

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
