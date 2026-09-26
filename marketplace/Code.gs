const CONFIG={SHEET_NAME:"Marketplace Listings",FOLDER_NAME:"TW&D Marketplace Photos",MANAGEMENT_EMAIL:"admin@twdengineeringconsult.com",REPLY_TO:"marketplace@twdengineeringconsult.com",TIMEZONE:"Africa/Lagos",MAX_FILE_BYTES:5*1024*1024};

function setupMarketplace(){
 const props=PropertiesService.getScriptProperties();
 let folder;const fid=props.getProperty("FOLDER_ID");
 try{folder=fid?DriveApp.getFolderById(fid):null}catch(e){folder=null}
 if(!folder)folder=DriveApp.createFolder(CONFIG.FOLDER_NAME);
 props.setProperty("FOLDER_ID",folder.getId());
 let ss;const sid=props.getProperty("SHEET_ID");
 try{ss=sid?SpreadsheetApp.openById(sid):null}catch(e){ss=null}
 if(!ss)ss=SpreadsheetApp.create(CONFIG.SHEET_NAME);
 props.setProperty("SHEET_ID",ss.getId());
 let sh=ss.getSheets()[0];sh.setName(CONFIG.SHEET_NAME);
 if(sh.getLastRow()===0)sh.appendRow(["Timestamp","Listing ID","Status","Seller","Email","Phone","Category","Location","Title","Price","Condition","Description","Photo Folder"]);
 return {folderId:folder.getId(),sheetId:ss.getId(),webAppNote:"Deploy this project as a Web App: Execute as Me; access Anyone."};
}

function doPost(e){
 try{
  const data=JSON.parse(e.postData.contents||"{}");
  if(data.action==="subscribe")return json({ok:true,message:"Subscription request received. Connect Paystack/Flutterwave before enabling live payment collection."});
  return submitListing(data);
 }catch(err){return json({ok:false,message:String(err)});}
}

function submitListing(d){
 ["sellerName","email","phone","category","location","title","price","description"].forEach(k=>{if(!d[k])throw new Error("Missing field: "+k);});
 const folder=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("FOLDER_ID"));
 const id="TWM-"+Utilities.formatDate(new Date(),CONFIG.TIMEZONE,"yyyyMMdd-HHmmss")+"-"+Math.floor(Math.random()*900+100);
 const itemFolder=folder.createFolder(id+" - "+safe(d.title));
 const photoLinks=[];
 (d.photos||[]).forEach(p=>{
  if(Number(p.size)>CONFIG.MAX_FILE_BYTES)throw new Error("Photo too large: "+p.name);
  const bytes=Utilities.base64Decode(p.data);const blob=Utilities.newBlob(bytes,p.type||"image/jpeg",p.name);
  const file=itemFolder.createFile(blob);photoLinks.push(file.getUrl());
 });
 const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
 ss.getSheetByName(CONFIG.SHEET_NAME).appendRow([new Date(),id,"PENDING_REVIEW",d.sellerName,d.email,d.phone,d.category,d.location,d.title,d.price,d.condition||"",d.description,itemFolder.getUrl()]);
 MailApp.sendEmail({to:CONFIG.MANAGEMENT_EMAIL,replyTo:CONFIG.REPLY_TO,subject:"New TW&D Marketplace listing: "+id,htmlBody:"<p>A new marketplace listing was submitted.</p><p><b>"+esc(d.title)+"</b><br>Seller: "+esc(d.sellerName)+"<br>Category: "+esc(d.category)+"<br>Location: "+esc(d.location)+"<br>Price: ₦"+esc(d.price)+"</p><p>Listing ID: "+id+"<br><a href='"+itemFolder.getUrl()+"'>Open photo folder</a></p>"});
 MailApp.sendEmail({to:d.email,replyTo:CONFIG.REPLY_TO,subject:"TW&D Marketplace listing received — "+id,htmlBody:"<p>Thank you. Your listing <b>"+esc(d.title)+"</b> has been received and is pending review.</p><p>Reference: "+id+"</p>"});
 return json({ok:true,message:"Listing submitted for review. Reference: "+id});
}
function safe(s){return String(s).replace(/[^a-z0-9 _-]/gi,"").slice(0,70)||"Listing";}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function testSetup(){return setupMarketplace();}