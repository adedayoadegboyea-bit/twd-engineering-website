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
  'AI Assessment'
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
    '',
    '',
    '',
    '',
    ''
  ];

  sheet.appendRow(row);

  // Email failures must never cancel a valid application.
  try { sendManagementNewApplicationEmail_(row); } catch (mailError) { console.error('Management email failed:', mailError); }
  try { sendApplicantReceiptEmail_(row); } catch (mailError) { console.error('Applicant receipt email failed:', mailError); }


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

  sendTransactionalEmail_(CONFIG.MANAGEMENT_EMAIL, 'New TW&D job application: ' + position, html);
}

/**
 * Confirmation email to applicant.
 */
function sendApplicantReceiptEmail_(row) {
  const id = row[0];
  const name = row[2];
  const email = row[3];
  const position = row[5];

  sendTransactionalEmail_(
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

  const model=String(props.getProperty('GEMINI_MODEL')||'gemini-3.8-flash').trim();
  const prompt =
    'Create exactly 50 concise multiple-choice aptitude questions for a Nigerian engineering and construction company applicant applying for the role: '+position+'. '+
    'Cover role knowledge, practical judgement, safety, problem solving, ethics and workplace scenarios appropriate to that role. '+
    'Each question must have exactly 4 options and exactly one correct answer. Do not use private company information. '+
    'Keep each question and option concise so all 50 questions fit in one response. Do not include explanations.';

  const schema={
    type:'OBJECT',
    properties:{
      questions:{
        type:'ARRAY',
        minItems:50,
        maxItems:50,
        items:{
          type:'OBJECT',
          properties:{
            question:{type:'STRING'},
            options:{type:'ARRAY',minItems:4,maxItems:4,items:{type:'STRING'}},
            answer:{type:'INTEGER',minimum:0,maximum:3}
          },
          required:['question','options','answer']
        }
      }
    },
    required:['questions']
  };

  const payload={
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{
      responseMimeType:'application/json',
      responseSchema:schema,
      maxOutputTokens:30000
    }
  };

  /*
   * Gemini can temporarily return HTTP 503 when model capacity is busy.
   * Use bounded exponential backoff, then fall back to a lighter current
   * Flash-Lite model. We never retry permanent 4xx configuration errors.
   */
  const modelsToTry=[model];
  if(model!=='gemini-3.5-flash-lite'){
    modelsToTry.push('gemini-3.5-flash-lite');
  }

  let response=null;
  let lastError='';

  for(let modelIndex=0;modelIndex<modelsToTry.length;modelIndex++){
    const activeModel=modelsToTry[modelIndex];
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(activeModel)+':generateContent';

    for(let attempt=0;attempt<4;attempt++){
      try{
        response=UrlFetchApp.fetch(url,{
          method:'post',
          contentType:'application/json',
          headers:{'x-goog-api-key':key},
          muteHttpExceptions:true,
          payload:JSON.stringify(payload)
        });
      }catch(fetchError){
        lastError='Could not reach Gemini ('+activeModel+'): '+fetchError.message;
        response=null;
      }

      if(response){
        const code=response.getResponseCode();
        const body=response.getContentText();

        if(code>=200&&code<300){
          break;
        }

        let detail=body;
        try{
          const apiErr=JSON.parse(body);
          detail=(apiErr.error&&(apiErr.error.message||apiErr.error.status))||body;
        }catch(ignore){}

        lastError='Gemini API error HTTP '+code+' ('+activeModel+'): '+String(detail).slice(0,900);

        /*
         * Retry only transient server/rate-limit errors.
         * 503 is the error currently being reported.
         */
        if(code===503 || code===429 || code===408 || code===500 || code===502 || code===504){
          if(attempt<3){
            const delay=(5000*Math.pow(2,attempt))+Math.floor(Math.random()*2000);
            Utilities.sleep(delay);
            continue;
          }
        }

        response=null;
        break;
      }

      break;
    }

    if(response && response.getResponseCode()>=200 && response.getResponseCode()<300){
      break;
    }

    response=null;
  }

  if(!response){
    throw new Error(
      lastError ||
      'Gemini could not generate the aptitude questions after the available retries.'
    );
  }

  let outer;
  try{outer=JSON.parse(body);}
  catch(e){throw new Error('Gemini returned invalid JSON: '+body.slice(0,700));}

  if(!outer.candidates||!outer.candidates.length){
    const reason=outer.promptFeedback&&outer.promptFeedback.blockReason;
    throw new Error('Gemini returned no candidate'+(reason?' — '+reason:'')+'.');
  }

  const candidate=outer.candidates[0];
  const finishReason=String(candidate.finishReason||'');
  const text=candidate.content&&candidate.content.parts&&candidate.content.parts[0]&&candidate.content.parts[0].text;
  if(!text){
    if(finishReason==='MAX_TOKENS'){
      throw new Error('Gemini stopped before all 50 questions were generated. The response reached the output limit. Try again; the generator is configured to retry transient API failures.');
    }
    throw new Error('Gemini returned no question content. Finish reason: '+(finishReason||'unknown'));
  }

  let parsed;
  try{parsed=JSON.parse(text);}
  catch(e){throw new Error('Gemini structured response could not be parsed: '+text.slice(0,700));}

  if(!parsed.questions||!Array.isArray(parsed.questions)||parsed.questions.length!==50){
    throw new Error('AI generated '+((parsed.questions&&parsed.questions.length)||0)+' questions instead of exactly 50.');
  }

  parsed.questions.forEach(function(q,i){
    if(!q.question||!Array.isArray(q.options)||q.options.length!==4||typeof q.answer!=='number'||q.answer<0||q.answer>3){
      throw new Error('Invalid AI question at number '+(i+1)+'.');
    }
  });

  return parsed.questions;
}

/**
 * Manual diagnostic. Run this from Apps Script once after deployment/update.
 * It generates 50 questions without creating an applicant or sending email.
 */
function testAptitudeAI(){
  const questions=generateAptitudeQuestions_('Site Engineer / Project Engineer');
  return 'AI TEST PASSED: '+questions.length+' questions generated successfully using Gemini.';
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
  const key=PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');
  if(key){
    const response=UrlFetchApp.fetch('https://api.resend.com/emails',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+key},muteHttpExceptions:true,payload:JSON.stringify({from:'TW&D Engineering Consult & Services Ltd <contact@twdengineeringconsult.com>',to:[to],subject:subject,html:htmlBody})});
    if(response.getResponseCode()>=200 && response.getResponseCode()<300) return true;
    throw new Error('Resend email failed: HTTP '+response.getResponseCode());
  }
  if(MailApp.getRemainingDailyQuota()<=0) throw new Error('Email quota exceeded.');
  MailApp.sendEmail({to:to,subject:subject,htmlBody:htmlBody});
  return true;
}
