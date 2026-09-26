const CONFIG = {
  SHEET_NAME: 'Applications',
  DRIVE_FOLDER_NAME: 'TW&D Recruitment Documents',
  MANAGEMENT_EMAIL: 'twdengineeringconsult@engineer.com',
  COMPANY_NAME: 'TW&D Engineering Consult & Services Ltd'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Application')
    .setTitle(CONFIG.COMPANY_NAME + ' Careers')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupRecruitment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create(CONFIG.COMPANY_NAME + ' Recruitment');
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Application ID','Timestamp','Applicant Name','Email','Phone','Position','Location','Qualifications','Experience','Professional Registration','Application Letter','CV Link','Supporting Documents','Status','Interview Date','Interview Time','Interview Location','Interview Type','Management Notes']);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,19).setFontWeight('bold');
    sheet.getRange(2,14,sheet.getMaxRows()-1,1).setValue('Application Received');
  }
  let folder;
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
  PropertiesService.getScriptProperties().setProperties({SHEET_ID:ss.getId(),FOLDER_ID:folder.getId()});
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => { if (trigger.getHandlerFunction() === 'onEdit') ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('onEdit').forSpreadsheet(ss).onEdit().create();
  return {sheetUrl:ss.getUrl(),folderUrl:folder.getUrl()};
}

function submitApplication(data) {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) setupRecruitment(), sheetId = props.getProperty('SHEET_ID');
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(CONFIG.SHEET_NAME);
  const id = 'TWD-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
  let cvUrl = '', docsUrl = '';
  if (data.cv && data.cv.base64) {
    const bytes = Utilities.base64Decode(data.cv.base64);
    const blob = Utilities.newBlob(bytes, data.cv.mimeType || 'application/pdf', data.cv.name || (id+'-CV'));
    cvUrl = folder.createFile(blob).getUrl();
  }
  if (data.supporting && data.supporting.base64) {
    const bytes = Utilities.base64Decode(data.supporting.base64);
    const blob = Utilities.newBlob(bytes, data.supporting.mimeType || 'application/pdf', data.supporting.name || (id+'-Supporting'));
    docsUrl = folder.createFile(blob).getUrl();
  }
  sheet.appendRow([id,new Date(),data.name,data.email,data.phone,data.position,data.location,data.qualifications,data.experience,data.registration,data.letter,cvUrl,docsUrl,'Application Received','','','','','']);
  MailApp.sendEmail({to:CONFIG.MANAGEMENT_EMAIL,subject:'New TW&D job application: '+data.position,htmlBody:'<b>New application received</b><br><br><b>Application ID:</b> '+id+'<br><b>Name:</b> '+data.name+'<br><b>Email:</b> '+data.email+'<br><b>Phone:</b> '+data.phone+'<br><b>Position:</b> '+data.position+'<br><b>CV:</b> '+(cvUrl||'Not supplied')+'<br><b>Supporting document:</b> '+(docsUrl||'Not supplied')});
  MailApp.sendEmail({to:data.email,subject:'Application received — TW&D Engineering Consult & Services Ltd',htmlBody:'Dear '+data.name+',<br><br>Thank you for applying to TW&D Engineering Consult & Services Ltd.<br><br>Your application reference is <b>'+id+'</b>. Our management team will review your submission and contact you regarding the next stage.<br><br>Regards,<br>TW&D Engineering Consult & Services Ltd'});
  return {ok:true,id:id};
}

function sendStatusEmail(row) {
  const values = row.getValues()[0];
  const email = values[3], name = values[2], status = values[13], interviewDate = values[14], interviewTime = values[15], location = values[16], type = values[17];
  if (!email || !status) return;
  let subject = 'TW&D application update — '+status;
  let body = 'Dear '+name+',<br><br>Your TW&D Engineering Consult & Services Ltd application status is now <b>'+status+'</b>.<br>';
  if (status === 'Interview Scheduled' || interviewDate) body += '<br><b>Interview date:</b> '+interviewDate+'<br><b>Interview time:</b> '+interviewTime+'<br><b>Location:</b> '+location+'<br><b>Type:</b> '+type+'<br>';
  body += '<br>Regards,<br>TW&D Engineering Consult & Services Ltd';
  MailApp.sendEmail({to:email,subject:subject,htmlBody:body});
}

function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range, sheet = range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME || range.getRow() === 1) return;
  // Send an applicant update only when Management changes the Status column.
  // Interview details should be entered first, then set Status to "Interview Scheduled".
  if (range.getColumn() === 14) {
    sendStatusEmail(sheet.getRange(range.getRow(),1,1,19));
  }
}
