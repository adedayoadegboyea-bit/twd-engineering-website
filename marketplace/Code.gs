const CONFIG = {
  COMPANY: "TW&D Engineering Consult & Services Ltd",
  SHEET_NAME: "Marketplace Listings",
  SUBSCRIPTION_SHEET_NAME: "Marketplace Subscriptions",
  FOLDER_NAME: "TW&D Marketplace Photos",
  MANAGEMENT_EMAIL: "admin@twdengineeringconsult.com",
  REPLY_TO: "marketplace@twdengineeringconsult.com",
  TIMEZONE: "Africa/Lagos",
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_TOTAL_FILE_BYTES: 15 * 1024 * 1024,

  // PAYMENT SETTINGS
  // Paste your real Payoneer payment link here when you create it.
  // PAYMENT LINKS — keep real payment URLs in Apps Script Properties, not GitHub.
  PAYONEER_PAYMENT_LINK: "",
  PAYSTACK_PAYMENT_LINK: "",

  // These are read privately from Apps Script Properties.
  BANK_NAME: "Moniepoint",
  BANK_ACCOUNT_NAME: "TW&D ENGINEERING CONSULT & SERVICES LTD",
  BANK_ACCOUNT_NUMBER: "",
  WHATSAPP_NUMBER: "2348035774420"
};

/**
 * ONE-TIME SETUP
 * Run setupMarketplace() manually once from Apps Script.
 */
function setupMarketplace() {
  const props = PropertiesService.getScriptProperties();

  let folder = null;
  const oldFolderId = props.getProperty("FOLDER_ID") || props.getProperty("MARKETPLACE_FOLDER_ID");
  if (oldFolderId) {
    try { folder = DriveApp.getFolderById(oldFolderId); } catch (err) { folder = null; }
  }
  if (!folder) {
    folder = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  }
  props.setProperty("FOLDER_ID", folder.getId());
  props.setProperty("MARKETPLACE_FOLDER_ID", folder.getId());

  let spreadsheet = null;
  const oldSheetId = props.getProperty("SHEET_ID") || props.getProperty("MARKETPLACE_SPREADSHEET_ID");
  if (oldSheetId) {
    try { spreadsheet = SpreadsheetApp.openById(oldSheetId); } catch (err) { spreadsheet = null; }
  }
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create("TW&D Marketplace Database");
  }

  props.setProperty("SHEET_ID", spreadsheet.getId());
  props.setProperty("MARKETPLACE_SPREADSHEET_ID", spreadsheet.getId());

  const listingsSheet = getOrCreateSheet_(
    spreadsheet,
    CONFIG.SHEET_NAME,
    [
      "Timestamp","Listing ID","Status","Seller / Business","Email",
      "Phone / WhatsApp","Category","Location","Listing Title","Price",
      "Condition","Description","Photo Folder","Photos Saved","Photo URLs","Video URLs"
    ]
  );

  const subscriptionsSheet = getOrCreateSheet_(
    spreadsheet,
    CONFIG.SUBSCRIPTION_SHEET_NAME,
    [
      "Timestamp","Subscription ID","Status","Plan",
      "Seller / Business","Email","Phone / WhatsApp","Listing ID",
      "Payment Method","Payment Reference","Payment Status"
    ]
  );

  listingsSheet.setFrozenRows(1);
  subscriptionsSheet.setFrozenRows(1);

  return json({
    ok: true,
    message: "TW&D Marketplace setup completed successfully.",
    folderId: folder.getId(),
    spreadsheetId: spreadsheet.getId()
  });
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (sheet.getRange(1, 1).getValue() === "") {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (sheet.getLastColumn() < headers.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, headers.length - sheet.getLastColumn()).setValues([headers.slice(sheet.getLastColumn())]);
  }

  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  return sheet;
}

/**
 * Website POST endpoint.
 */
function doPost(e) {
  try {
    const data = parseRequest_(e);

    if (data.action === "subscribe") {
      return handleSubscription_(data);
    }

    return submitListing(data);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json({
      ok: false,
      message: "The marketplace could not process this request. " + safeErrorMessage_(error)
    });
  }
}

/**
 * Simple GET endpoint for health checking.
 */
function doGet(e) {
  const action = e && e.parameter ? String(e.parameter.action || "") : "";

  if (action === "health") {
    return json({
      ok: true,
      service: "TW&D Marketplace",
      status: "online",
      time: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    });
  }

  if (action === "listings") {
    try {
      return json({ ok: true, listings: getApprovedListings_() });
    } catch (error) {
      console.error("Public listings error:", error);
      return json({ ok: false, listings: [], message: safeErrorMessage_(error) });
    }
  }

  return json({
    ok: true,
    service: "TW&D Marketplace",
    message: "Marketplace backend is online. Use POST for listings and subscription requests."
  });
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("No POST data was received.");
  }

  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("The submitted data was not valid JSON.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid marketplace request.");
  }

  return data;
}

/**
 * Main listing workflow:
 * validate -> create folder -> save photos -> write spreadsheet -> email.
 *
 * Email errors are deliberately isolated so an email problem cannot erase
 * an otherwise successful listing submission.
 */
function submitListing(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Listing data was not supplied.");
  }

  const sellerName = required_(data.sellerName, "Seller / Business Name");
  const email = requiredEmail_(data.email);
  const phone = required_(data.phone, "Phone / WhatsApp");
  const category = required_(data.category, "Category");
  const location = required_(data.location, "Location");
  const title = required_(data.title, "Listing Title");
  const price = required_(data.price, "Price");
  const condition = clean_(data.condition || "");
  const description = required_(data.description, "Description");

  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("FOLDER_ID") || props.getProperty("MARKETPLACE_FOLDER_ID");
  const spreadsheetId = props.getProperty("SHEET_ID") || props.getProperty("MARKETPLACE_SPREADSHEET_ID");

  if (!folderId) {
    throw new Error("Marketplace storage is not configured. Run setupMarketplace() first.");
  }
  if (!spreadsheetId) {
    throw new Error("Marketplace spreadsheet is not configured. Run setupMarketplace() first.");
  }

  const media = Array.isArray(data.photos) ? data.photos : [];
  let totalBytes = 0;

  media.forEach(function(photo) {
    if (!photo || !photo.data || !photo.name) return;

    const declaredSize = Number(photo.size || 0);
    if (declaredSize > CONFIG.MAX_FILE_BYTES) {
      throw new Error("Media file is larger than 5 MB: " + clean_(photo.name));
    }
    totalBytes += declaredSize;
  });

  if (totalBytes > CONFIG.MAX_TOTAL_FILE_BYTES) {
    throw new Error("The combined photo/video upload is too large. Please keep all media together below 15 MB.");
  }

  const listingId =
    "TWM-" +
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss") +
    "-" +
    Math.floor(1000 + Math.random() * 9000);

  const mainFolder = DriveApp.getFolderById(folderId);
  const listingFolder = mainFolder.createFolder(listingId + " - " + safeFolderName_(title));

  const savedPhotos = [];
  const savedVideos = [];

  media.forEach(function(photo) {
    if (!photo || !photo.data || !photo.name) return;

    try {
      const base64 = String(photo.data).replace(/^data:[^;]+;base64,/, "");
      const bytes = Utilities.base64Decode(base64);

      if (bytes.length > CONFIG.MAX_FILE_BYTES) {
        throw new Error("Media file exceeds the 5 MB limit.");
      }

      const contentType = allowedMediaType_(photo.type);
      const blob = Utilities.newBlob(bytes, contentType, safeFileName_(photo.name));
      const file = listingFolder.createFile(blob);

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        console.error("Public photo sharing could not be enabled:", sharingError);
      }

      const mediaRecord = {name:file.getName(),id:file.getId(),url:"https://drive.google.com/uc?export=view&id=" + file.getId(),type:contentType};
      if (contentType.indexOf("video/") === 0) savedVideos.push(mediaRecord); else savedPhotos.push(mediaRecord);
    } catch (photoError) {
      console.error("Photo save error:", photoError);
      throw new Error("Could not save photo: " + clean_(photo.name));
    }
  });

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.SHEET_NAME, ["Timestamp","Listing ID","Status","Seller / Business","Email","Phone / WhatsApp","Category","Location","Listing Title","Price","Condition","Description","Photo Folder","Photos Saved","Photo URLs","Video URLs"]);

  if (!sheet) {
    throw new Error("Marketplace Listings sheet was not found. Run setupMarketplace() again.");
  }

  sheet.appendRow([
    new Date(),
    listingId,
    "PENDING_REVIEW",
    sellerName,
    email,
    phone,
    category,
    location,
    title,
    price,
    condition,
    description,
    listingFolder.getUrl(),
    savedPhotos.length,
    JSON.stringify(savedPhotos.map(function(photo) { return photo.url; })),
    JSON.stringify(savedVideos.map(function(video) { return video.url; }))
  ]);

  const listingInfo = {
    listingId: listingId,
    seller: sellerName,
    email: email,
    phone: phone,
    category: category,
    location: location,
    title: title,
    price: price,
    condition: condition,
    description: description,
    photoCount: savedPhotos.length,
    videoCount: savedVideos.length,
    folderUrl: listingFolder.getUrl()
  };

  safeSendManagementNotification_(listingInfo);
  safeSendSellerConfirmation_(listingInfo);

  return json({
    ok: true,
    message: "Listing submitted successfully and is awaiting TW&D review.",
    listingId: listingId,
    status: "PENDING_REVIEW",
    photosSaved: savedPhotos.length
  });
}

function handleSubscription_(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Subscription data was not supplied.");
  }

  const plan = required_(data.plan, "Subscription Plan");
  const seller = required_(data.sellerName, "Seller / Business Name");
  const email = requiredEmail_(data.email);
  const phone = required_(data.phone, "Phone / WhatsApp");
  const listingId = clean_(data.listingId || "");
  const paymentMethod = clean_(data.paymentMethod || "payoneer").toLowerCase();

  const allowedPaymentMethods = ["flutterwave", "payoneer", "paystack", "bank_transfer"];
  if (allowedPaymentMethods.indexOf(paymentMethod) === -1) {
    throw new Error("Please select a valid payment method.");
  }

  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SHEET_ID") || props.getProperty("MARKETPLACE_SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("Marketplace spreadsheet is not configured. Run setupMarketplace() first.");
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getOrCreateSheet_(
    spreadsheet,
    CONFIG.SUBSCRIPTION_SHEET_NAME,
    [
      "Timestamp","Subscription ID","Status","Plan",
      "Seller / Business","Email","Phone / WhatsApp","Listing ID",
      "Payment Method","Payment Reference","Payment Status"
    ]
  );

  const subscriptionId =
    "TWS-" +
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss") +
    "-" +
    Math.floor(1000 + Math.random() * 9000);

  const paymentStatus = "PAYMENT_PENDING";

  sheet.appendRow([
    new Date(),
    subscriptionId,
    paymentStatus,
    plan,
    seller,
    email,
    phone,
    listingId,
    paymentMethod,
    "",
    paymentStatus
  ]);

  const details = {
    subscriptionId: subscriptionId,
    plan: plan,
    seller: seller,
    email: email,
    phone: phone,
    listingId: listingId,
    paymentMethod: paymentMethod
  };

  safeSendSubscriptionManagement_(details);
  safeSendSubscriptionConfirmation_(details);

  const paymentSettings = getPaymentSettings_();

  const response = {
    ok: true,
    message: "Your subscription request has been received. Please complete payment using your selected payment method.",
    subscriptionId: subscriptionId,
    status: paymentStatus,
    paymentMethod: paymentMethod,
    paymentUrl: paymentMethod === "flutterwave"
      ? getFlutterwavePaymentLink_(plan)
      : paymentMethod === "payoneer"
        ? paymentSettings.payoneerPaymentLink
        : paymentMethod === "paystack"
          ? paymentSettings.paystackPaymentLink
          : "",
    payoneerEmail: "adedayo.adegboyea@gmail.com",
    paystackEnabled: Boolean(paymentSettings.paystackPaymentLink),
    whatsappNumber: paymentSettings.whatsappNumber,
    bankTransfer: paymentSettings.bankTransfer
  };

  return json(response);
}

function getFlutterwavePaymentLink_(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.indexOf("starter") === 0) return "https://flutterwave.com/pay/tpdl5uufd62l";
  if (p.indexOf("business") === 0) return "https://flutterwave.com/pay/26nqlxpttr1t";
  if (p.indexOf("pro") === 0) return "https://flutterwave.com/pay/frhgwtnzuaez";
  throw new Error("No Flutterwave payment link is configured for the selected plan.");
}

function getPaymentSettings_() {
  const props = PropertiesService.getScriptProperties();
  return {
    payoneerPaymentLink: props.getProperty("PAYONEER_PAYMENT_LINK") || CONFIG.PAYONEER_PAYMENT_LINK,
    paystackPaymentLink: props.getProperty("PAYSTACK_PAYMENT_LINK") || CONFIG.PAYSTACK_PAYMENT_LINK,
    whatsappNumber: props.getProperty("WHATSAPP_NUMBER") || CONFIG.WHATSAPP_NUMBER,
    bankTransfer: {
      primary: {
        bankName: props.getProperty("BANK_NAME") || CONFIG.BANK_NAME,
        accountName: props.getProperty("BANK_ACCOUNT_NAME") || CONFIG.BANK_ACCOUNT_NAME,
        accountNumber: props.getProperty("BANK_ACCOUNT_NUMBER") || CONFIG.BANK_ACCOUNT_NUMBER
      },
      secondary: {
        bankName: props.getProperty("PREMIUM_BANK_NAME") || "Premium Trust Bank",
        accountName: props.getProperty("PREMIUM_BANK_ACCOUNT_NAME") || CONFIG.BANK_ACCOUNT_NAME,
        accountNumber: props.getProperty("PREMIUM_BANK_ACCOUNT_NUMBER") || ""
      }
    }
  };
}

function getPaymentDetails_() {
  return getPaymentSettings_();
}

function safeSendManagementNotification_(data) {
  try {
    const subject = "New TW&D Marketplace Listing: " + data.listingId;
    const body =
      "NEW MARKETPLACE LISTING\n\n" +
      "Listing ID: " + data.listingId + "\n" +
      "Seller / Business: " + data.seller + "\n" +
      "Email: " + data.email + "\n" +
      "Phone / WhatsApp: " + data.phone + "\n" +
      "Category: " + data.category + "\n" +
      "Location: " + data.location + "\n" +
      "Title: " + data.title + "\n" +
      "Price: " + data.price + "\n" +
      "Condition: " + data.condition + "\n" +
      "Photos saved: " + data.photoCount + "\n" + "Videos saved: " + (data.videoCount || 0) + "\n\n" +
      "Description:\n" + data.description + "\n\n" +
      "Drive folder: " + data.folderUrl + "\n\n" +
      "STATUS: PENDING REVIEW";

    MailApp.sendEmail({
      to: CONFIG.MANAGEMENT_EMAIL,
      subject: subject,
      body: body,
      replyTo: CONFIG.REPLY_TO
    });
  } catch (error) {
    console.error("Management email failed:", error);
  }
}

function safeSendSellerConfirmation_(data) {
  if (!data || !data.email) return;

  try {
    const subject = "TW&D Marketplace Listing Received - " + data.listingId;
    const body =
      "Dear " + data.seller + ",\n\n" +
      "Thank you for submitting your listing to " + CONFIG.COMPANY + ".\n\n" +
      "Listing ID: " + data.listingId + "\n" +
      "Listing: " + data.title + "\n\n" +
      "Your listing has been received and is currently pending review by TW&D management.\n\n" +
      "You will be contacted after the review process.\n\n" +
      "TW&D Engineering Consult & Services Ltd\n" +
      "We design and we build to last.\n" +
      "WhatsApp: +234 803 577 4420";

    MailApp.sendEmail({
      to: data.email,
      subject: subject,
      body: body,
      replyTo: CONFIG.REPLY_TO
    });
  } catch (error) {
    console.error("Seller confirmation email failed:", error);
  }
}

function safeSendSubscriptionManagement_(data) {
  try {
    MailApp.sendEmail({
      to: CONFIG.MANAGEMENT_EMAIL,
      subject: "TW&D Marketplace Subscription Request - " + data.subscriptionId,
      body:
        "NEW MARKETPLACE SUBSCRIPTION REQUEST\n\n" +
        "Subscription ID: " + data.subscriptionId + "\n" +
        "Plan: " + data.plan + "\n" +
        "Seller / Business: " + data.seller + "\n" +
        "Email: " + data.email + "\n" +
        "Phone: " + data.phone + "\n" +
        "Listing ID: " + (data.listingId || "Not specified") + "\n" +
        "Payment Method: " + (data.paymentMethod || "Payoneer") + "\n\n" +
        "STATUS: PAYMENT PENDING"
    });
  } catch (error) {
    console.error("Subscription management email failed:", error);
  }
}

function safeSendSubscriptionConfirmation_(data) {
  if (!data || !data.email) return;

  try {
    MailApp.sendEmail({
      to: data.email,
      subject: "TW&D Marketplace Subscription Request - " + data.subscriptionId,
      body:
        "Dear " + data.seller + ",\n\n" +
        "We received your request for the " + data.plan + " marketplace subscription.\n\n" +
        "Reference: " + data.subscriptionId + "\n" +
        "Listing ID: " + (data.listingId || "Not specified") + "\n" +
        "Payment Method: " + (data.paymentMethod || "Payoneer") + "\n\n" +
        "Payment has not yet been verified. Please complete payment using the instructions shown on the marketplace.\n\n" +
        "TW&D Engineering Consult & Services Ltd\n" +
        "WhatsApp: +234 803 577 4420",
      replyTo: CONFIG.REPLY_TO
    });
  } catch (error) {
    console.error("Subscription confirmation email failed:", error);
  }
}

function getApprovedListings_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SHEET_ID") || props.getProperty("MARKETPLACE_SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Marketplace spreadsheet is not configured.");

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(value) { return String(value); });
  const index = {};
  headers.forEach(function(header, i) { index[header] = i; });

  return values.slice(1).filter(function(row) {
    const status = String(row[index["Status"]] || "").trim().toUpperCase();
    const seller = String(row[index["Seller / Business"]] || "").trim().toLowerCase();

    // Public Marketplace listings must come from visitors/sellers.
    // Company project/gallery records and demo listings must never be published here.
    const isCompanyOrDemoSeller =
      seller.includes("tw&d") ||
      seller.includes("twd engineering") ||
      seller.includes("marketplace demo") ||
      seller.includes("system test");

    return status === "APPROVED" && !isCompanyOrDemoSeller;
  }).map(function(row) {
    let photoUrls = [];
    let videoUrls = [];
    const rawPhotos = index["Photo URLs"] !== undefined ? row[index["Photo URLs"]] : "";
    const rawVideos = index["Video URLs"] !== undefined ? row[index["Video URLs"]] : "";

    if (rawPhotos) {
      try {
        const parsed = JSON.parse(String(rawPhotos));
        if (Array.isArray(parsed)) {
          photoUrls = parsed.filter(Boolean).map(function(url) {
            return String(url).trim();
          }).filter(Boolean);
        } else if (typeof parsed === "string" && parsed.trim()) {
          photoUrls = [parsed.trim()];
        }
      } catch (error) {
        // Support older rows where Photo URLs may contain one plain URL.
        const legacyUrl = String(rawPhotos).trim();
        if (legacyUrl && legacyUrl !== "[]") photoUrls = [legacyUrl];
      }
    }

    if (rawVideos) {
      try {
        const parsedVideos = JSON.parse(String(rawVideos));
        if (Array.isArray(parsedVideos)) videoUrls = parsedVideos.filter(Boolean).map(function(url){return String(url).trim();}).filter(Boolean);
        else if (typeof parsedVideos === "string" && parsedVideos.trim()) videoUrls = [parsedVideos.trim()];
      } catch (error) {
        const legacyVideoUrl = String(rawVideos).trim();
        if (legacyVideoUrl && legacyVideoUrl !== "[]") videoUrls = [legacyVideoUrl];
      }
    }

    // Older approved listings were created before the Photo URLs column was added.
    // Recover their real uploaded photos directly from the saved listing folder.
    if (!photoUrls.length) {
      photoUrls = recoverPhotoUrlsFromFolder_(
        String(row[index["Photo Folder"]] || "").trim()
      );
    }

    return {
      id: String(row[index["Listing ID"]] || ""),
      category: String(row[index["Category"]] || ""),
      location: String(row[index["Location"]] || ""),
      title: String(row[index["Listing Title"]] || ""),
      price: String(row[index["Price"]] || ""),
      seller: String(row[index["Seller / Business"]] || ""),
      condition: String(row[index["Condition"]] || ""),
      description: String(row[index["Description"]] || ""),
      phone: String(row[index["Phone / WhatsApp"]] || ""),
      images: photoUrls,
      image: photoUrls.length ? photoUrls[0] : "",
      videos: videoUrls
    };
  }).filter(function(item) {
    return Array.isArray(item.images) && item.images.length > 0;
  });
}

function recoverPhotoUrlsFromFolder_(folderUrl) {
  if (!folderUrl) return [];

  const match = String(folderUrl).match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!match || !match[1]) return [];

  try {
    const folder = DriveApp.getFolderById(match[1]);
    const files = folder.getFiles();
    const urls = [];

    while (files.hasNext()) {
      const file = files.next();
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        console.error("Could not enable public photo sharing:", sharingError);
      }
      urls.push("https://drive.google.com/uc?export=view&id=" + file.getId());
    }

    return urls;
  } catch (error) {
    console.error("Could not recover listing photos from folder:", error);
    return [];
  }
}

function required_(value, label) {
  const result = clean_(value);
  if (!result) throw new Error("Missing required field: " + label);
  return result.substring(0, 10000);
}

function requiredEmail_(value) {
  const email = clean_(value).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please provide a valid email address.");
  }
  return email.substring(0, 320);
}

function clean_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeFolderName_(value) {
  return clean_(value).replace(/[\\/:*?"<>|#%{}]/g, "").substring(0, 80) || "Listing";
}

function safeFileName_(value) {
  const name = clean_(value).replace(/[\\/:*?"<>|#%{}]/g, "_").substring(0, 150);
  return name || ("photo-" + new Date().getTime() + ".jpg");
}

function allowedMediaType_(type) {
  const allowed = ["image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"];
  if (allowed.indexOf(type) >= 0) return type;
  throw new Error("Unsupported media type. Use JPG, PNG, WEBP, MP4, WEBM or MOV.");
}

function allowedImageType_(type) { return allowedMediaType_(type); }

function safeErrorMessage_(error) {
  if (!error) return "Please try again.";
  const message = clean_(error.message || error);
  return message.substring(0, 500);
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * SAFE TEST:
 * This verifies the spreadsheet/folder setup without pretending
 * that submitListing() was called from the website.
 */
function testMarketplaceWrite() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SHEET_ID") || props.getProperty("MARKETPLACE_SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Run setupMarketplace() first.");

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName("Marketplace Tests");
  if (!sheet) sheet = spreadsheet.insertSheet("Marketplace Tests");
  if (sheet.getLastRow() === 0) sheet.appendRow(["Timestamp","Test ID","Result","Message"]);

  const testId = "TEST-" + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss");
  sheet.appendRow([
    new Date(),
    testId,
    "PASS",
    "Backend spreadsheet write test. This test is intentionally kept out of Marketplace Listings."
  ]);

  return "TEST PASSED: " + testId + " was written to Marketplace Tests. Marketplace Listings was not modified.";
}
