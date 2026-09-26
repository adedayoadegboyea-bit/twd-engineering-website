const CONFIG = {
  COMPANY: "TW&D Engineering Consult & Services Ltd",
  FOLDER_NAME: "TW&D Client Project Submissions",
  SHEET_NAME: "Client Submissions",
  MANAGEMENT_EMAIL: "admin@twdengineeringconsult.com",
  REPLY_TO: "projects@twdengineeringconsult.com",
  TIMEZONE: "Africa/Lagos",
  MAX_FILE_BYTES: 10 * 1024 * 1024
};

function setupClientPortal() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty("CLIENT_FOLDER_ID");
  let folder;
  if (folderId) {
    try { folder = DriveApp.getFolderById(folderId); } catch(e) {}
  }
  if (!folder) {
    folder = DriveApp.createFolder(CONFIG.FOLDER_NAME);
    props.setProperty("CLIENT_FOLDER_ID", folder.getId());
  }
  let ssId = props.getProperty("CLIENT_SHEET_ID");
  let ss;
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch(e) {}
  }
  if (!ss) {
    ss = SpreadsheetApp.create("TW&D Client Project Submissions");
    props.setProperty("CLIENT_SHEET_ID", ss.getId());
  }
  const sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(["Timestamp","Reference","Client","Email","Phone","Location","Project Type","Description","Files","Folder","Status"]);
  return {folderId:folder.getId(), sheetId:ss.getId()};
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const setup = setupClientPortal();
    const folder = DriveApp.getFolderById(setup.folderId);
    const stamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss");
    const safeClient = String(data.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,60);
    const projectFolder = folder.createFolder(stamp + "_" + safeClient);
    const files = Array.isArray(data.filesPayload) ? data.filesPayload : [];
    const fileLinks = [];
    files.forEach(f => {
      if (!f || !f.data || Number(f.size) > CONFIG.MAX_FILE_BYTES) return;
      const bytes = Utilities.base64Decode(f.data);
      const blob = Utilities.newBlob(bytes, f.type || MimeType.BINARY, f.name || "project-file");
      const file = projectFolder.createFile(blob);
      fileLinks.push(file.getUrl());
    });
    const ss = SpreadsheetApp.openById(setup.sheetId);
    const sh = ss.getSheetByName(CONFIG.SHEET_NAME);
    const ref = data.reference || ("TWD-CLIENT-" + stamp);
    sh.appendRow([new Date(),ref,data.clientName||"",data.email||"",data.phone||"",data.location||"",data.projectType||"",data.description||"",fileLinks.join("\n"),projectFolder.getUrl(),"New"]);
    MailApp.sendEmail({to:CONFIG.MANAGEMENT_EMAIL,replyTo:CONFIG.REPLY_TO,subject:"New TW&D Client Project Submission: "+ref,htmlBody:"<p>A new client project submission has been received.</p><p><b>Client:</b> "+esc(data.clientName)+"<br><b>Email:</b> "+esc(data.email)+"<br><b>Phone:</b> "+esc(data.phone)+"<br><b>Location:</b> "+esc(data.location)+"<br><b>Project:</b> "+esc(data.projectType)+"<br><b>Reference:</b> "+esc(ref)+"</p><p><b>Project folder:</b> <a href='"+projectFolder.getUrl()+"'>Open files</a></p>"});
    if (data.email) MailApp.sendEmail({to:data.email,replyTo:CONFIG.REPLY_TO,subject:"TW&D received your project submission — "+ref,htmlBody:"<p>Dear "+esc(data.clientName)+",</p><p>TW&D Engineering Consult & Services Ltd has received your project information and documents.</p><p>Your reference is <b>"+esc(ref)+"</b>. Our team will review the submission and contact you.</p><p>Thank you.</p>"});
    return ContentService.createTextOutput(JSON.stringify({ok:true,reference:ref})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}
function esc(v){return String(v||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function testSetup(){ return setupClientPortal(); }