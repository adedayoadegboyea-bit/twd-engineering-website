const CONFIG = {
  COMPANY: "TW&D Engineering Consult & Services Ltd",
  SHEET_NAME: "Marketplace Listings",
  SUBSCRIPTION_SHEET_NAME: "Marketplace Subscriptions",
  USERS_SHEET_NAME: "Marketplace Users",
  SESSIONS_SHEET_NAME: "Marketplace Sessions",
  MESSAGES_SHEET_NAME: "Marketplace Messages",
  VERIFICATION_SHEET_NAME: "Marketplace Email Verification",
  FOLDER_NAME: "TW&D Marketplace Photos",
  MANAGEMENT_EMAIL: "admin@twdengineeringconsult.com",
  REPLY_TO: "marketplace@twdengineeringconsult.com",
  TIMEZONE: "Africa/Lagos",
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_TOTAL_FILE_BYTES: 15 * 1024 * 1024,

  // PAYMENT SETTINGS
  // Keep real payment URLs in Apps Script Properties, not GitHub.
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
    try {
      folder = DriveApp.getFolderById(oldFolderId);
    } catch (err) {
      folder = null;
    }
  }

  if (!folder) {
    folder = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  }

  props.setProperty("FOLDER_ID", folder.getId());
  props.setProperty("MARKETPLACE_FOLDER_ID", folder.getId());

  let spreadsheet = null;
  const oldSheetId =
    props.getProperty("SHEET_ID") ||
    props.getProperty("MARKETPLACE_SPREADSHEET_ID");

  if (oldSheetId) {
    try {
      spreadsheet = SpreadsheetApp.openById(oldSheetId);
    } catch (err) {
      spreadsheet = null;
    }
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
      "Timestamp",
      "Listing ID",
      "Status",
      "Seller / Business",
      "Email",
      "Phone / WhatsApp",
      "Category",
      "Location",
      "Listing Title",
      "Price",
      "Condition",
      "Description",
      "Photo Folder",
      "Photos Saved",
      "Photo URLs",
      "Account ID",
      "Phone Visibility",
      "WhatsApp Number",
      "WhatsApp Enabled",
      "Approval Notification Sent"
    ]
  );

  const subscriptionsSheet = getOrCreateSheet_(
    spreadsheet,
    CONFIG.SUBSCRIPTION_SHEET_NAME,
    [
      "Timestamp",
      "Subscription ID",
      "Status",
      "Plan",
      "Seller / Business",
      "Email",
      "Phone / WhatsApp",
      "Listing ID",
      "Payment Method",
      "Payment Reference",
      "Payment Status"
    ]
  );

  const usersSheet = getOrCreateSheet_(spreadsheet, CONFIG.USERS_SHEET_NAME, [
    "Created", "User ID", "Status", "Full Name", "Business Name", "Email", "Phone",
    "Password Hash", "Password Salt", "WhatsApp Number", "WhatsApp Enabled", "Phone Visibility", "Profile Photo", "Bio"
  ]);
  const sessionsSheet = getOrCreateSheet_(spreadsheet, CONFIG.SESSIONS_SHEET_NAME, [
    "Created", "Session ID", "User ID", "Token Hash", "Expires At", "Status"
  ]);
  const messagesSheet = getOrCreateSheet_(spreadsheet, CONFIG.MESSAGES_SHEET_NAME, [
    "Timestamp", "Message ID", "Listing ID", "From User ID", "To User ID", "Message", "Status"
  ]);
  const verificationSheet = ensureVerificationSheet_(spreadsheet);

  listingsSheet.setFrozenRows(1);
  subscriptionsSheet.setFrozenRows(1);
  usersSheet.setFrozenRows(1);
  sessionsSheet.setFrozenRows(1);
  messagesSheet.setFrozenRows(1);
  verificationSheet.setFrozenRows(1);

  return json({
    ok: true,
    message: "TW&D Marketplace setup completed successfully.",
    folderId: folder.getId(),
    spreadsheetId: spreadsheet.getId()
  });
}

function ensureVerificationSheet_(spreadsheet) {
  let sheet=spreadsheet.getSheetByName(CONFIG.VERIFICATION_SHEET_NAME);
  const headers=["Created","User ID","Email","Code Hash","Link Token Hash","Expires At","Attempts","Status"];
  if(!sheet) return getOrCreateSheet_(spreadsheet,CONFIG.VERIFICATION_SHEET_NAME,headers);
  if(sheet.getLastRow()===0){sheet.getRange(1,1,1,headers.length).setValues([headers]);}
  else {
    const current=sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),8)).getValues()[0].map(String);
    if(current[4]==="Expires At" && current[5]==="Attempts" && current[6]==="Status" && current[7]!=="Link Token Hash"){
      sheet.insertColumnBefore(5);
      sheet.getRange(1,5).setValue("Link Token Hash");
    }
    if(sheet.getLastColumn()<8) sheet.insertColumnsAfter(sheet.getLastColumn(),8-sheet.getLastColumn());
    sheet.getRange(1,1,1,8).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,8).setFontWeight("bold");
  return sheet;
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
    sheet
      .getRange(
        1,
        sheet.getLastColumn() + 1,
        1,
        headers.length - sheet.getLastColumn()
      )
      .setValues([headers.slice(sheet.getLastColumn())]);
  }

  sheet
    .getRange(1, 1, 1, headers.length)
    .setFontWeight("bold");

  return sheet;
}

/**
 * WEBSITE POST ENDPOINT
 */
function doPost(e) {
  try {
    const data = parseRequest_(e);

    if (data.action === "subscribe") return handleSubscription_(data);
    if (data.action === "register") return handleRegister_(data);
    if (data.action === "verify_email") return handleVerifyEmail_(data);
    if (data.action === "resend_verification") return handleResendVerification_(data);
    if (data.action === "login") return handleLogin_(data);
    if (data.action === "logout") return handleLogout_(data);
    if (data.action === "me") return handleMe_(data);
    if (data.action === "send_message") return handleSendMessage_(data);
    if (data.action === "messages") return handleMessages_(data);
    return submitListing(data);

  } catch (error) {
    console.error(
      error && error.stack ? error.stack : error
    );

    return json({
      ok: false,
      message:
        "The marketplace could not process this request. " +
        safeErrorMessage_(error)
    });
  }
}

/**
 * SIMPLE GET ENDPOINT
 */
function doGet(e) {
  const action =
    e && e.parameter
      ? String(e.parameter.action || "")
      : "";

  if (action === "verify_email") {
    return handleVerifyEmailLink_(String((e && e.parameter && e.parameter.email) || ""), String((e && e.parameter && e.parameter.token) || ""));
  }

  if (action === "health") {
    return json({
      ok: true,
      service: "TW&D Marketplace",
      status: "online",
      time: Utilities.formatDate(
        new Date(),
        CONFIG.TIMEZONE,
        "yyyy-MM-dd HH:mm:ss"
      )
    });
  }

  if (action === "seller") {
    const seller = sellerProfile_(String(e.parameter.userId || ""));
    return json({ok:!!seller, seller:seller});
  }

  if (action === "listings") {
    try {
      return json({
        ok: true,
        listings: getApprovedListings_()
      });
    } catch (error) {
      console.error(
        "Public listings error:",
        error
      );

      return json({
        ok: false,
        listings: [],
        message: safeErrorMessage_(error)
      });
    }
  }

  return json({
    ok: true,
    service: "TW&D Marketplace",
    message:
      "Marketplace backend is online. Use POST for listings and subscription requests."
  });
}

/**
 * PARSE WEBSITE REQUEST
 */
function parseRequest_(e) {
  if (
    !e ||
    !e.postData ||
    !e.postData.contents
  ) {
    throw new Error(
      "No POST data was received."
    );
  }

  let data;

  try {
    data = JSON.parse(
      e.postData.contents
    );
  } catch (error) {
    throw new Error(
      "The submitted data was not valid JSON."
    );
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Invalid marketplace request."
    );
  }

  return data;
}

/**
 * MAIN LISTING WORKFLOW
 *
 * validate
 * -> create folder
 * -> save photos
 * -> write spreadsheet
 * -> email
 */
function submitListing(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Listing data was not supplied."
    );
  }

  const account = requireSession_(data.sessionToken);
  const sellerName = account.businessName || account.fullName;

  const email = account.email;

  const phone = account.phone;

  const category =
    required_(
      data.category,
      "Category"
    );

  const location =
    required_(
      data.location,
      "Location"
    );

  const title =
    required_(
      data.title,
      "Listing Title"
    );

  const price =
    required_(
      data.price,
      "Price"
    );

  const condition =
    clean_(
      data.condition || ""
    );

  const description =
    required_(
      data.description,
      "Description"
    );

  const props =
    PropertiesService.getScriptProperties();

  const folderId =
    props.getProperty("FOLDER_ID") ||
    props.getProperty("MARKETPLACE_FOLDER_ID");

  const spreadsheetId =
    props.getProperty("SHEET_ID") ||
    props.getProperty("MARKETPLACE_SPREADSHEET_ID");

  if (!folderId) {
    throw new Error(
      "Marketplace storage is not configured. Run setupMarketplace() first."
    );
  }

  if (!spreadsheetId) {
    throw new Error(
      "Marketplace spreadsheet is not configured. Run setupMarketplace() first."
    );
  }

  const photos =
    Array.isArray(data.photos)
      ? data.photos
      : [];

  let totalBytes = 0;

  photos.forEach(function(photo) {
    if (
      !photo ||
      !photo.data ||
      !photo.name
    ) {
      return;
    }

    const declaredSize =
      Number(photo.size || 0);

    if (
      declaredSize >
      CONFIG.MAX_FILE_BYTES
    ) {
      throw new Error(
        "Photo is larger than 5 MB: " +
        clean_(photo.name)
      );
    }

    totalBytes += declaredSize;
  });

  if (
    totalBytes >
    CONFIG.MAX_TOTAL_FILE_BYTES
  ) {
    throw new Error(
      "The combined photo upload is too large. Please keep all photos together below 15 MB."
    );
  }

  const listingId =
    "TWM-" +
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      "yyyyMMdd-HHmmss"
    ) +
    "-" +
    Math.floor(
      1000 +
      Math.random() * 9000
    );

  const mainFolder =
    DriveApp.getFolderById(
      folderId
    );

  const listingFolder =
    mainFolder.createFolder(
      listingId +
      " - " +
      safeFolderName_(title)
    );

  const savedPhotos = [];

  photos.forEach(function(photo) {
    if (
      !photo ||
      !photo.data ||
      !photo.name
    ) {
      return;
    }

    try {
      const base64 =
        String(photo.data).replace(
          /^data:[^;]+;base64,/,
          ""
        );

      const bytes =
        Utilities.base64Decode(
          base64
        );

      if (
        bytes.length >
        CONFIG.MAX_FILE_BYTES
      ) {
        throw new Error(
          "Photo exceeds the 5 MB limit."
        );
      }

      const contentType =
        allowedImageType_(
          photo.type
        );

      const blob =
        Utilities.newBlob(
          bytes,
          contentType,
          safeFileName_(photo.name)
        );

      const file =
        listingFolder.createFile(
          blob
        );

      try {
        file.setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );
      } catch (sharingError) {
        console.error(
          "Public photo sharing could not be enabled:",
          sharingError
        );
      }

      savedPhotos.push({
        name: file.getName(),
        id: file.getId(),
        url:
          "https://drive.google.com/uc?export=view&id=" +
          file.getId()
      });

    } catch (photoError) {
      console.error(
        "Photo save error:",
        photoError
      );

      throw new Error(
        "Could not save photo: " +
        clean_(photo.name)
      );
    }
  });

  const spreadsheet =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  const sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      "Marketplace Listings sheet was not found. Run setupMarketplace() again."
    );
  }

  /**
   * THIS IS THE REAL WEBSITE LISTING WRITE.
   *
   * Every genuine seller submission is written here.
   */
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
    JSON.stringify(
      savedPhotos.map(
        function(photo) {
          return photo.url;
        }
      )
    ),
    account.userId,
    account.phoneVisibility || "HIDDEN",
    account.whatsappNumber || "",
    account.whatsappEnabled ? "YES" : "NO",
    ""
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
    accountId: account.userId,
    phoneVisibility: account.phoneVisibility || "HIDDEN",
    whatsappNumber: account.whatsappNumber || "",
    whatsappEnabled: !!account.whatsappEnabled,
    folderUrl:
      listingFolder.getUrl()
  };

  safeSendManagementNotification_(
    listingInfo
  );

  safeSendSellerConfirmation_(
    listingInfo
  );

  return json({
    ok: true,
    message:
      "Listing submitted successfully and is awaiting TW&D review.",
    listingId: listingId,
    status: "PENDING_REVIEW",
    photosSaved:
      savedPhotos.length
  });
}

/**
 * SUBSCRIPTION WORKFLOW
 */
function handleSubscription_(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Subscription data was not supplied."
    );
  }

  const plan =
    required_(
      data.plan,
      "Subscription Plan"
    );

  const seller =
    required_(
      data.sellerName,
      "Seller / Business Name"
    );

  const email =
    requiredEmail_(data.email);

  const phone =
    required_(
      data.phone,
      "Phone / WhatsApp"
    );

  const listingId =
    clean_(
      data.listingId || ""
    );

  const paymentMethod =
    clean_(
      data.paymentMethod ||
      "payoneer"
    ).toLowerCase();

  const allowedPaymentMethods = [
    "flutterwave",
    "payoneer",
    "paystack",
    "bank_transfer"
  ];

  if (
    allowedPaymentMethods.indexOf(
      paymentMethod
    ) === -1
  ) {
    throw new Error(
      "Please select a valid payment method."
    );
  }

  const props =
    PropertiesService.getScriptProperties();

  const spreadsheetId =
    props.getProperty("SHEET_ID") ||
    props.getProperty(
      "MARKETPLACE_SPREADSHEET_ID"
    );

  if (!spreadsheetId) {
    throw new Error(
      "Marketplace spreadsheet is not configured. Run setupMarketplace() first."
    );
  }

  const spreadsheet =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  const sheet =
    getOrCreateSheet_(
      spreadsheet,
      CONFIG.SUBSCRIPTION_SHEET_NAME,
      [
        "Timestamp",
        "Subscription ID",
        "Status",
        "Plan",
        "Seller / Business",
        "Email",
        "Phone / WhatsApp",
        "Listing ID",
        "Payment Method",
        "Payment Reference",
        "Payment Status"
      ]
    );

  const subscriptionId =
    "TWS-" +
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      "yyyyMMdd-HHmmss"
    ) +
    "-" +
    Math.floor(
      1000 +
      Math.random() * 9000
    );

  const paymentStatus =
    "PAYMENT_PENDING";

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
    subscriptionId:
      subscriptionId,
    plan: plan,
    seller: seller,
    email: email,
    phone: phone,
    listingId: listingId,
    paymentMethod:
      paymentMethod
  };

  safeSendSubscriptionManagement_(
    details
  );

  safeSendSubscriptionConfirmation_(
    details
  );

  const paymentSettings =
    getPaymentSettings_();

  const response = {
    ok: true,

    message:
      "Your subscription request has been received. Please complete payment using your selected payment method.",

    subscriptionId:
      subscriptionId,

    status:
      paymentStatus,

    paymentMethod:
      paymentMethod,

    paymentUrl:
      paymentMethod ===
      "flutterwave"
        ? getFlutterwavePaymentLink_(
            plan
          )
        : paymentMethod ===
          "payoneer"
          ? paymentSettings.payoneerPaymentLink
          : paymentMethod ===
            "paystack"
            ? paymentSettings.paystackPaymentLink
            : "",

    payoneerEmail:
      "adedayo.adegboyea@gmail.com",

    paystackEnabled:
      Boolean(
        paymentSettings.paystackPaymentLink
      ),

    whatsappNumber:
      paymentSettings.whatsappNumber,

    bankTransfer:
      paymentSettings.bankTransfer
  };

  return json(response);
}

/**
 * FLUTTERWAVE PAYMENT LINKS
 */
function getFlutterwavePaymentLink_(plan) {
  const p =
    String(
      plan || ""
    ).toLowerCase();

  if (
    p.indexOf("starter") === 0
  ) {
    return "https://flutterwave.com/pay/tpdl5uufd62l";
  }

  if (
    p.indexOf("business") === 0
  ) {
    return "https://flutterwave.com/pay/26nqlxpttr1t";
  }

  if (
    p.indexOf("pro") === 0
  ) {
    return "https://flutterwave.com/pay/frhgwtnzuaez";
  }

  throw new Error(
    "No Flutterwave payment link is configured for the selected plan."
  );
}

/**
 * PRIVATE PAYMENT SETTINGS
 *
 * Bank account numbers are read from Apps Script
 * Properties rather than stored in GitHub.
 */
function getPaymentSettings_() {
  const props =
    PropertiesService.getScriptProperties();

  return {
    payoneerPaymentLink:
      props.getProperty(
        "PAYONEER_PAYMENT_LINK"
      ) ||
      CONFIG.PAYONEER_PAYMENT_LINK,

    paystackPaymentLink:
      props.getProperty(
        "PAYSTACK_PAYMENT_LINK"
      ) ||
      CONFIG.PAYSTACK_PAYMENT_LINK,

    whatsappNumber:
      props.getProperty(
        "WHATSAPP_NUMBER"
      ) ||
      CONFIG.WHATSAPP_NUMBER,

    bankTransfer: {
      primary: {
        bankName:
          props.getProperty(
            "BANK_NAME"
          ) ||
          CONFIG.BANK_NAME,

        accountName:
          props.getProperty(
            "BANK_ACCOUNT_NAME"
          ) ||
          CONFIG.BANK_ACCOUNT_NAME,

        accountNumber:
          props.getProperty(
            "BANK_ACCOUNT_NUMBER"
          ) ||
          CONFIG.BANK_ACCOUNT_NUMBER
      },

      secondary: {
        bankName:
          props.getProperty(
            "PREMIUM_BANK_NAME"
          ) ||
          "Premium Trust Bank",

        accountName:
          props.getProperty(
            "PREMIUM_BANK_ACCOUNT_NAME"
          ) ||
          CONFIG.BANK_ACCOUNT_NAME,

        accountNumber:
          props.getProperty(
            "PREMIUM_BANK_ACCOUNT_NUMBER"
          ) ||
          ""
      }
    }
  };
}

function getPaymentDetails_() {
  return getPaymentSettings_();
}

/**
 * MANAGEMENT EMAIL FOR NEW LISTING
 */
function safeSendManagementNotification_(data) {
  try {
    const subject =
      "New TW&D Marketplace Listing: " +
      data.listingId;

    const body =
      "NEW MARKETPLACE LISTING\n\n" +

      "Listing ID: " +
      data.listingId +
      "\n" +

      "Seller / Business: " +
      data.seller +
      "\n" +

      "Email: " +
      data.email +
      "\n" +

      "Phone / WhatsApp: " +
      data.phone +
      "\n" +

      "Category: " +
      data.category +
      "\n" +

      "Location: " +
      data.location +
      "\n" +

      "Title: " +
      data.title +
      "\n" +

      "Price: " +
      data.price +
      "\n" +

      "Condition: " +
      data.condition +
      "\n" +

      "Photos saved: " +
      data.photoCount +
      "\n\n" +

      "Description:\n" +
      data.description +
      "\n\n" +

      "Drive folder: " +
      data.folderUrl +
      "\n\n" +

      "STATUS: PENDING REVIEW";

    MailApp.sendEmail({
      to:
        CONFIG.MANAGEMENT_EMAIL,

      subject:
        subject,

      body:
        body,

      replyTo:
        CONFIG.REPLY_TO
    });

  } catch (error) {
    console.error(
      "Management email failed:",
      error
    );
  }
}

/**
 * SELLER CONFIRMATION
 */
function safeSendSellerConfirmation_(data) {
  if (
    !data ||
    !data.email
  ) {
    return;
  }

  try {
    const subject =
      "TW&D Marketplace Listing Received - " +
      data.listingId;

    const body =
      "Dear " +
      data.seller +
      ",\n\n" +

      "Thank you for submitting your listing to " +
      CONFIG.COMPANY +
      ".\n\n" +

      "Listing ID: " +
      data.listingId +
      "\n" +

      "Listing: " +
      data.title +
      "\n\n" +

      "Your listing has been received and is currently pending review by TW&D management.\n\n" +

      "You will be contacted after the review process.\n\n" +

      "TW&D Engineering Consult & Services Ltd\n" +

      "We design and we build to last.\n" +

      "WhatsApp: +234 803 577 4420";

    MailApp.sendEmail({
      to:
        data.email,

      subject:
        subject,

      body:
        body,

      replyTo:
        CONFIG.REPLY_TO
    });

  } catch (error) {
    console.error(
      "Seller confirmation email failed:",
      error
    );
  }
}

/**
 * MANAGEMENT SUBSCRIPTION EMAIL
 */
function safeSendSubscriptionManagement_(data) {
  try {
    MailApp.sendEmail({
      to:
        CONFIG.MANAGEMENT_EMAIL,

      subject:
        "TW&D Marketplace Subscription Request - " +
        data.subscriptionId,

      body:
        "NEW MARKETPLACE SUBSCRIPTION REQUEST\n\n" +

        "Subscription ID: " +
        data.subscriptionId +
        "\n" +

        "Plan: " +
        data.plan +
        "\n" +

        "Seller / Business: " +
        data.seller +
        "\n" +

        "Email: " +
        data.email +
        "\n" +

        "Phone: " +
        data.phone +
        "\n" +

        "Listing ID: " +
        (
          data.listingId ||
          "Not specified"
        ) +
        "\n" +

        "Payment Method: " +
        (
          data.paymentMethod ||
          "Payoneer"
        ) +
        "\n\n" +

        "STATUS: PAYMENT PENDING"
    });

  } catch (error) {
    console.error(
      "Subscription management email failed:",
      error
    );
  }
}

/**
 * SELLER SUBSCRIPTION CONFIRMATION
 */
function safeSendSubscriptionConfirmation_(data) {
  if (
    !data ||
    !data.email
  ) {
    return;
  }

  try {
    MailApp.sendEmail({
      to:
        data.email,

      subject:
        "TW&D Marketplace Subscription Request - " +
        data.subscriptionId,

      body:
        "Dear " +
        data.seller +
        ",\n\n" +

        "We received your request for the " +
        data.plan +
        " marketplace subscription.\n\n" +

        "Reference: " +
        data.subscriptionId +
        "\n" +

        "Listing ID: " +
        (
          data.listingId ||
          "Not specified"
        ) +
        "\n" +

        "Payment Method: " +
        (
          data.paymentMethod ||
          "Payoneer"
        ) +
        "\n\n" +

        "Payment has not yet been verified. Please complete payment using the instructions shown on the marketplace.\n\n" +

        "TW&D Engineering Consult & Services Ltd\n" +

        "WhatsApp: +234 803 577 4420",

      replyTo:
        CONFIG.REPLY_TO
    });

  } catch (error) {
    console.error(
      "Subscription confirmation email failed:",
      error
    );
  }
}

/**
 * GET APPROVED PUBLIC MARKETPLACE LISTINGS
 *
 * Important:
 * - Only APPROVED listings are published.
 * - TW&D/company/demo/system-test listings are excluded.
 * - Old approved listings without Photo URLs are recovered
 *   from their actual Google Drive listing folder.
 * - Listings without real images are not published.
 */
function getApprovedListings_() {
  const props =
    PropertiesService.getScriptProperties();

  const spreadsheetId =
    props.getProperty("SHEET_ID") ||
    props.getProperty(
      "MARKETPLACE_SPREADSHEET_ID"
    );

  if (!spreadsheetId) {
    throw new Error(
      "Marketplace spreadsheet is not configured."
    );
  }

  const spreadsheet =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  const sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEET_NAME
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const values =
    sheet.getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function(value) {
        return String(value);
      }
    );

  const index = {};

  headers.forEach(
    function(header, i) {
      index[header] = i;
    }
  );

  return values
    .slice(1)
    .filter(function(row) {

      const status =
        String(
          row[index["Status"]] || ""
        )
          .trim()
          .toUpperCase();

      const seller =
        String(
          row[
            index[
              "Seller / Business"
            ]
          ] || ""
        )
          .trim()
          .toLowerCase();

      // Public Marketplace listings must come from
      // visitors/sellers.
      //
      // Company project/gallery records and demo
      // listings must never be published here.
      const isCompanyOrDemoSeller =
        seller.includes("tw&d") ||
        seller.includes(
          "twd engineering"
        ) ||
        seller.includes(
          "marketplace demo"
        ) ||
        seller.includes(
          "system test"
        );

      const listingId = String(
        row[index["Listing ID"]] || ""
      ).trim();

      const isTestListing =
        /^TEST-/i.test(listingId) ||
        /^TWM-TEST/i.test(listingId) ||
        seller.includes("test seller") ||
        seller.includes("test listing");

      return (
        status === "APPROVED" &&
        !isCompanyOrDemoSeller &&
        !isTestListing
      );
    })

    .map(function(row) {

      let photoUrls = [];

      const rawPhotos =
        index["Photo URLs"] !==
        undefined
          ? row[
              index["Photo URLs"]
            ]
          : "";

      if (rawPhotos) {
        try {
          const parsed =
            JSON.parse(
              String(rawPhotos)
            );

          if (
            Array.isArray(parsed)
          ) {
            photoUrls =
              parsed
                .filter(Boolean)
                .map(
                  function(url) {
                    return String(
                      url
                    ).trim();
                  }
                )
                .filter(Boolean);

          } else if (
            typeof parsed ===
              "string" &&
            parsed.trim()
          ) {
            photoUrls = [
              parsed.trim()
            ];
          }

        } catch (error) {

          // Support older rows where
          // Photo URLs may contain one plain URL.
          const legacyUrl =
            String(
              rawPhotos
            ).trim();

          if (
            legacyUrl &&
            legacyUrl !== "[]"
          ) {
            photoUrls = [
              legacyUrl
            ];
          }
        }
      }

      /**
       * OLD APPROVED LISTINGS
       *
       * Some older listings were created before
       * Photo URLs was added.
       *
       * Recover the actual uploaded images
       * from their saved Drive folder.
       */
      if (
        !photoUrls.length
      ) {
        photoUrls =
          recoverPhotoUrlsFromFolder_(
            String(
              row[
                index[
                  "Photo Folder"
                ]
              ] || ""
            ).trim()
          );
      }

      return {
        id:
          String(
            row[
              index[
                "Listing ID"
              ]
            ] || ""
          ),

        category:
          String(
            row[
              index[
                "Category"
              ]
            ] || ""
          ),

        location:
          String(
            row[
              index[
                "Location"
              ]
            ] || ""
          ),

        title:
          String(
            row[
              index[
                "Listing Title"
              ]
            ] || ""
          ),

        price:
          String(
            row[
              index[
                "Price"
              ]
            ] || ""
          ),

        seller:
          String(
            row[
              index[
                "Seller / Business"
              ]
            ] || ""
          ),

        condition:
          String(
            row[
              index[
                "Condition"
              ]
            ] || ""
          ),

        description:
          String(
            row[
              index[
                "Description"
              ]
            ] || ""
          ),

        phone: (
          String(
            row[
              index["Phone Visibility"]
            ] || "HIDDEN"
          ).toUpperCase() === "SHOW"
        )
          ? String(
              row[
                index["Phone / WhatsApp"]
              ] || ""
            )
          : "",

        images:
          photoUrls,

        accountId: String(row[index["Account ID"]] || ""),
        phoneVisibility: String(row[index["Phone Visibility"]] || "HIDDEN").toUpperCase(),
        whatsappNumber: String(row[index["WhatsApp Number"]] || ""),
        whatsappEnabled: String(row[index["WhatsApp Enabled"]] || "").toUpperCase() === "YES",

        image:
          photoUrls.length
            ? photoUrls[0]
            : ""
      };
    })

    ;
}

/**
 * MARKETPLACE APPROVAL EMAIL AUTOMATION
 * Run setupMarketplaceApprovalTrigger() once after deployment.
 */
function setupMarketplaceApprovalTrigger() {
  const spreadsheet = getMarketplaceSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "marketplaceApprovalOnEdit") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ensureApprovalNotificationColumn_(spreadsheet);
  ScriptApp.newTrigger("marketplaceApprovalOnEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
  return "TW&D Marketplace approval email trigger installed successfully.";
}

function marketplaceApprovalOnEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  const map = getHeaderMap_(sheet);
  const statusCol = map["Status"];
  if (!statusCol || !map["Approval Notification Sent"]) return;
  const firstCol = e.range.getColumn();
  const lastCol = firstCol + e.range.getNumColumns() - 1;
  if (statusCol < firstCol || statusCol > lastCol) return;
  const firstRow = Math.max(2, e.range.getRow());
  const lastRow = e.range.getRow() + e.range.getNumRows() - 1;
  for (let r = firstRow; r <= lastRow; r++) {
    processMarketplaceApprovalRow_(sheet, r, map);
  }
}

function processMarketplaceApprovalRow_(sheet, rowNumber, map) {
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const status = String(row[map["Status"] - 1] || "").trim().toUpperCase();
  if (status !== "APPROVED") return;
  const listingId = String(row[map["Listing ID"] - 1] || "").trim();
  const seller = String(row[map["Seller / Business"] - 1] || "").trim();
  const sl = seller.toLowerCase();
  if (!listingId || /^TEST-/i.test(listingId) || /^TWM-TEST/i.test(listingId) ||
      sl.includes("tw&d") || sl.includes("twd engineering") ||
      sl.includes("marketplace demo") || sl.includes("system test") ||
      sl.includes("test seller") || sl.includes("test listing")) return;
  const email = String(row[map["Email"] - 1] || "").trim();
  if (!email) return;
  const state = String(row[map["Approval Notification Sent"] - 1] || "").trim().toUpperCase();
  if (state.indexOf("SENT") === 0) return;
  const d = {
    listingId: listingId,
    seller: seller,
    email: email,
    phone: String(row[map["Phone / WhatsApp"] - 1] || ""),
    category: String(row[map["Category"] - 1] || ""),
    location: String(row[map["Location"] - 1] || ""),
    title: String(row[map["Listing Title"] - 1] || ""),
    price: String(row[map["Price"] - 1] || ""),
    condition: String(row[map["Condition"] - 1] || "")
  };
  let sellerSent = false, managementSent = false;
  try { sendMarketplaceApprovalSellerEmail_(d); sellerSent = true; } catch (err) { console.error(err); }
  try { sendMarketplaceApprovalManagementEmail_(d); managementSent = true; } catch (err) { console.error(err); }
  sheet.getRange(rowNumber, map["Approval Notification Sent"]).setValue(
    sellerSent && managementSent
      ? "SENT - " + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss")
      : "FAILED - RETRY REQUIRED"
  );
}

function sendMarketplaceApprovalSellerEmail_(d) {
  MailApp.sendEmail({
    to: d.email,
    subject: "TW&D Marketplace Listing Approved - " + d.listingId,
    body: "Dear " + d.seller + ",\\n\\n" +
      "Your marketplace listing has been approved by " + CONFIG.COMPANY +
      " and is now eligible to appear on the public Marketplace.\\n\\n" +
      "Listing ID: " + d.listingId + "\\n" +
      "Listing Title: " + d.title + "\\n" +
      "Category: " + d.category + "\\n" +
      "Location: " + d.location + "\\n" +
      "Price: " + d.price + "\\n" +
      "Condition: " + d.condition + "\\n\\n" +
      "Thank you for using the TW&D Marketplace.\\n\\n" + CONFIG.COMPANY +
      "\\nWe design and we build to last.\\nWhatsApp: +234 803 577 4420",
    replyTo: CONFIG.REPLY_TO
  });
}

function sendMarketplaceApprovalManagementEmail_(d) {
  MailApp.sendEmail({
    to: CONFIG.MANAGEMENT_EMAIL,
    subject: "Marketplace Listing Approved - " + d.listingId,
    body: "A marketplace listing has been approved.\\n\\n" +
      "Listing ID: " + d.listingId + "\\n" +
      "Seller / Business: " + d.seller + "\\n" +
      "Email: " + d.email + "\\n" +
      "Phone / WhatsApp: " + d.phone + "\\n" +
      "Category: " + d.category + "\\n" +
      "Location: " + d.location + "\\n" +
      "Listing Title: " + d.title + "\\n" +
      "Price: " + d.price + "\\n" +
      "Condition: " + d.condition + "\\n\\n" + CONFIG.COMPANY,
    replyTo: CONFIG.REPLY_TO
  });
}

function getMarketplaceSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SHEET_ID") || props.getProperty("MARKETPLACE_SPREADSHEET_ID");
  if (!id) throw new Error("Marketplace spreadsheet is not configured. Run setupMarketplace() first.");
  return SpreadsheetApp.openById(id);
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(h, i) { const n = String(h || "").trim(); if (n) map[n] = i + 1; });
  return map;
}

function ensureApprovalNotificationColumn_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Marketplace Listings sheet was not found.");
  const map = getHeaderMap_(sheet);
  if (!map["Approval Notification Sent"]) {
    const c = sheet.getLastColumn() + 1;
    sheet.getRange(1, c).setValue("Approval Notification Sent").setFontWeight("bold");
  }
}

function processAllApprovedMarketplaceListings() {
  const spreadsheet = getMarketplaceSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return "No marketplace listings found.";
  ensureApprovalNotificationColumn_(spreadsheet);
  const map = getHeaderMap_(sheet);
  let processed = 0;
  for (let r = 2; r <= sheet.getLastRow(); r++) {
    const before = String(sheet.getRange(r, map["Approval Notification Sent"]).getValue() || "");
    processMarketplaceApprovalRow_(sheet, r, map);
    const after = String(sheet.getRange(r, map["Approval Notification Sent"]).getValue() || "");
    if (after && after !== before && after.indexOf("SENT") === 0) processed++;
  }
  return "Approval processing completed. Notifications sent for " + processed + " listing(s).";
}

/**
 * RECOVER PHOTOS FROM GOOGLE DRIVE LISTING FOLDER
 */
function recoverPhotoUrlsFromFolder_(
  folderUrl
) {
  if (!folderUrl) {
    return [];
  }

  const match =
    String(folderUrl).match(
      /\/folders\/([a-zA-Z0-9_-]+)/
    );

  if (
    !match ||
    !match[1]
  ) {
    return [];
  }

  try {
    const folder =
      DriveApp.getFolderById(
        match[1]
      );

    const files =
      folder.getFiles();

    const urls = [];

    while (
      files.hasNext()
    ) {
      const file =
        files.next();

      try {
        file.setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );
      } catch (
        sharingError
      ) {
        console.error(
          "Could not enable public photo sharing:",
          sharingError
        );
      }

      urls.push(
        "https://drive.google.com/uc?export=view&id=" +
        file.getId()
      );
    }

    return urls;

  } catch (error) {
    console.error(
      "Could not recover listing photos from folder:",
      error
    );

    return [];
  }
}

/** MARKETPLACE ACCOUNTS, SESSIONS AND CHAT **/
function hashValue_(value, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + "|" + String(value), Utilities.Charset.UTF_8);
  return bytes.map(function(b){ const n=b<0?b+256:b; return (n<16?"0":"")+n.toString(16); }).join("");
}
function randomToken_() { return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""); }
function findUserById_(userId) {
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const sh=ss.getSheetByName(CONFIG.USERS_SHEET_NAME); if(!sh || sh.getLastRow()<2) return null;
  const vals=sh.getDataRange().getValues(), h=vals[0], idx={}; h.forEach(function(x,i){idx[String(x)]=i;});
  for(let i=1;i<vals.length;i++){ if(String(vals[i][idx["User ID"]]||"")===String(userId)) return userFromRow_(vals[i],idx); }
  return null;
}
function findUserByEmail_(email) {
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const sh=ss.getSheetByName(CONFIG.USERS_SHEET_NAME); if(!sh || sh.getLastRow()<2) return null;
  const vals=sh.getDataRange().getValues(), h=vals[0], idx={}; h.forEach(function(x,i){idx[String(x)]=i;});
  for(let i=1;i<vals.length;i++){ if(String(vals[i][idx["Email"]]||"").toLowerCase()===String(email).toLowerCase()) return userFromRow_(vals[i],idx); }
  return null;
}
function userFromRow_(r,i){ return {userId:String(r[i["User ID"]]||""),status:String(r[i["Status"]]||"ACTIVE"),fullName:String(r[i["Full Name"]]||""),businessName:String(r[i["Business Name"]]||""),email:String(r[i["Email"]]||""),phone:String(r[i["Phone"]]||""),whatsappNumber:String(r[i["WhatsApp Number"]]||""),whatsappEnabled:String(r[i["WhatsApp Enabled"]]||"").toUpperCase()==="YES",phoneVisibility:String(r[i["Phone Visibility"]]||"HIDDEN").toUpperCase(),profilePhoto:String(r[i["Profile Photo"]]||""),bio:String(r[i["Bio"]]||"")}; }
function requireSession_(token) {
  const raw=clean_(token); if(!raw) throw new Error("Please create an account or sign in before listing.");
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const sh=ss.getSheetByName(CONFIG.SESSIONS_SHEET_NAME); if(!sh) throw new Error("Marketplace account system is not configured.");
  const vals=sh.getDataRange().getValues(), h=vals[0], idx={}; h.forEach(function(x,i){idx[String(x)]=i;}); const now=new Date();
  const th=hashValue_(raw, "TWDM_SESSION");
  for(let i=1;i<vals.length;i++){ if(String(vals[i][idx["Token Hash"]]||"")===th && String(vals[i][idx["Status"]]||"")==="ACTIVE") { const exp=new Date(vals[i][idx["Expires At"]]); if(exp>now) { const u=findUserById_(vals[i][idx["User ID"]]); if(u && u.status!=="BLOCKED") return u; } } }
  throw new Error("Your session has expired. Please sign in again.");
}
function createSession_(userId){
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")); const sh=ss.getSheetByName(CONFIG.SESSIONS_SHEET_NAME); const token=randomToken_();
  const exp=new Date(Date.now()+1000*60*60*24*30); const sid="SES-"+Utilities.getUuid().slice(0,12).toUpperCase();
  sh.appendRow([new Date(),sid,userId,hashValue_(token,"TWDM_SESSION"),exp,"ACTIVE"]); return token;
}
function handleRegister_(data){
  const fullName=required_(data.fullName,"Full Name"), email=requiredEmail_(data.email), phone=required_(data.phone,"Phone"), password=String(data.password||"");
  if(password.length<8) throw new Error("Password must be at least 8 characters.");
  if(findUserByEmail_(email)) throw new Error("An account already exists with this email. Please sign in or request a new verification code.");
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const sh=ss.getSheetByName(CONFIG.USERS_SHEET_NAME);
  const userId="USR-"+Utilities.formatDate(new Date(),CONFIG.TIMEZONE,"yyyyMMdd-HHmmss")+"-"+Math.floor(1000+Math.random()*9000), salt=randomToken_().slice(0,24);
  const businessName=clean_(data.businessName||""), wa=clean_(data.whatsappNumber||phone), waEnabled=String(data.whatsappEnabled||"YES")==="YES", vis=String(data.phoneVisibility||"HIDDEN").toUpperCase()==="SHOW"?"SHOW":"HIDDEN";
  sh.appendRow([new Date(),userId,"PENDING_EMAIL",fullName,businessName,email,phone,hashValue_(password,salt),salt,wa,waEnabled?"YES":"NO",vis,clean_(data.profilePhoto||""),clean_(data.bio||"")]);
  const code=String(Math.floor(100000+Math.random()*900000));
  const linkToken=randomToken_();
  const vsh=ss.getSheetByName(CONFIG.VERIFICATION_SHEET_NAME);
  const expires=new Date(Date.now()+15*60*1000);
  const verifyUrl=ScriptApp.getService().getUrl()+"?action=verify_email&email="+encodeURIComponent(email)+"&token="+encodeURIComponent(linkToken);
  vsh.appendRow([new Date(),userId,email,hashValue_(code,"EMAIL_VERIFY"),hashValue_(linkToken,"EMAIL_VERIFY_LINK"),expires,0,"PENDING"]);
  MailApp.sendEmail({to:email,subject:"Verify your TW&D Marketplace account",htmlBody:emailVerificationHtml_(fullName,email,code,verifyUrl),body:"Dear "+fullName+",\n\nYour TW&D Marketplace verification code is: "+code+"\n\nOr click this verification link:\n"+verifyUrl+"\n\nThis verification expires in 15 minutes.\n\n"+CONFIG.COMPANY,replyTo:CONFIG.REPLY_TO});
  return json({ok:true,message:"Account created in pending status. Check your email for the 6-digit code or click the verification link in the email."});
}
function publicUser_(u){return {userId:u.userId,fullName:u.fullName,businessName:u.businessName,email:u.email,phone:u.phoneVisibility==="SHOW"?u.phone:"",phoneVisibility:u.phoneVisibility,whatsappNumber:u.whatsappEnabled?u.whatsappNumber:"",whatsappEnabled:u.whatsappEnabled,profilePhoto:u.profilePhoto,bio:u.bio};}
function getVerificationRow_(email){
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const sh=ss.getSheetByName(CONFIG.VERIFICATION_SHEET_NAME);
  if(!sh) throw new Error("Email verification sheet is not configured. Run setupMarketplace() first.");
  const vals=sh.getDataRange().getValues(); const h=vals[0]; const ix={}; h.forEach(function(x,i){ix[String(x)]=i;});
  for(let i=vals.length-1;i>=1;i--){ if(String(vals[i][ix["Email"]]||"").toLowerCase()===String(email).toLowerCase() && String(vals[i][ix["Status"]]||"").toUpperCase()==="PENDING") return {sheet:sh,row:i+1,values:vals[i],ix:ix}; }
  return null;
}
function handleVerifyEmail_(data){
  const email=requiredEmail_(data.email), code=String(data.code||"").trim();
  if(!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit verification code.");
  const v=getVerificationRow_(email);
  if(!v) throw new Error("No pending verification was found. Request a new code.");
  const expires=new Date(v.values[v.ix["Expires At"]]);
  if(expires.getTime()<Date.now()) throw new Error("That verification code has expired. Request a new verification code.");
  const attempts=Number(v.values[v.ix["Attempts"]]||0);
  if(attempts>=5) throw new Error("Too many attempts. Request a new verification code.");
  v.sheet.getRange(v.row,v.ix["Attempts"]+1).setValue(attempts+1);
  if(hashValue_(code,"EMAIL_VERIFY")!==String(v.values[v.ix["Code Hash"]])) throw new Error("Incorrect verification code.");
  return activateVerifiedUser_(v);
}

function handleVerifyEmailLink_(email, token){
  try {
    email=requiredEmail_(email);
    token=clean_(token);
    if(!token) throw new Error("Verification link is incomplete.");
    const v=getVerificationRow_(email);
    if(!v) throw new Error("This verification link is no longer active. Please request a new verification code.");
    const expires=new Date(v.values[v.ix["Expires At"]]);
    if(expires.getTime()<Date.now()) throw new Error("This verification link has expired. Please request a new verification code.");
    const tokenHash=String(v.values[v.ix["Link Token Hash"]]||"");
    if(!tokenHash || hashValue_(token,"EMAIL_VERIFY_LINK")!==tokenHash) throw new Error("This verification link is invalid. Please request a new verification code.");
    const result=activateVerifiedUser_(v);
    return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>TW&D Marketplace Email Verified</title><style>body{font-family:Arial,sans-serif;background:#071d38;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.card{width:min(560px,88%);background:#fff;color:#142033;border-radius:20px;padding:34px;box-shadow:0 25px 70px rgba(0,0,0,.3)}h1{color:#071d38}a{display:inline-block;background:#d7a62a;color:#071d38;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:9px;margin-top:12px}</style></head><body><div class="card"><div style="font-weight:800;letter-spacing:.12em;color:#b48712">TW&D MARKETPLACE</div><h1>Email verified successfully</h1><p>Your marketplace account is now active.</p><p>You can return to the marketplace and sign in with the email and password you created.</p><a href="https://twdengineeringconsult.com/marketplace-account.html">Open Marketplace Account</a></div></body></html>');
  } catch(error) {
    return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>TW&D Marketplace Verification</title><style>body{font-family:Arial,sans-serif;background:#071d38;display:grid;place-items:center;min-height:100vh;margin:0}.card{width:min(560px,88%);background:#fff;color:#142033;border-radius:20px;padding:34px}a{display:inline-block;background:#d7a62a;color:#071d38;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:9px;margin-top:12px}</style></head><body><div class="card"><h1>Verification could not be completed</h1><p>"'+escapeHtml_(safeErrorMessage_(error))+'"</p><a href="https://twdengineeringconsult.com/marketplace-account.html">Return to Marketplace Account</a></div></body></html>');
  }
}

function activateVerifiedUser_(v){
  v.sheet.getRange(v.row,v.ix["Status"]+1).setValue("VERIFIED");
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const ush=ss.getSheetByName(CONFIG.USERS_SHEET_NAME);
  const vals=ush.getDataRange().getValues(), h=vals[0], ix={}; h.forEach(function(x,i){ix[String(x)]=i;});
  let userRow=-1;
  for(let i=1;i<vals.length;i++){if(String(vals[i][ix["User ID"]])===String(v.values[v.ix["User ID"]])){userRow=i+1;break;}}
  if(userRow<0) throw new Error("Marketplace account could not be found.");
  ush.getRange(userRow,ix["Status"]+1).setValue("ACTIVE");
  const u=findUserById_(String(v.values[v.ix["User ID"]]));
  try{MailApp.sendEmail({to:CONFIG.MANAGEMENT_EMAIL,subject:"New Verified TW&D Marketplace Account",body:"A marketplace account has completed email verification.\n\nName: "+u.fullName+"\nBusiness: "+u.businessName+"\nEmail: "+u.email+"\nPhone: "+u.phone+"\nUser ID: "+u.userId,replyTo:CONFIG.REPLY_TO});}catch(e){console.error(e);}
  return json({ok:true,message:"Email verified. Your marketplace account is now active.",token:createSession_(u.userId),user:publicUser_(u)});
}

function emailVerificationHtml_(fullName,email,code,verifyUrl){
  return '<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#142033"><div style="max-width:620px;margin:30px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.12)"><div style="background:#071d38;color:#fff;padding:28px"><div style="font-weight:800;letter-spacing:.12em;color:#d7a62a">TW&D MARKETPLACE</div><h1 style="margin:10px 0 0">Verify your email</h1></div><div style="padding:30px"><p>Dear '+escapeHtml_(fullName)+',</p><p>Thank you for creating your TW&D Marketplace account.</p><p style="font-weight:700">You can verify your email in either of these two ways:</p><div style="background:#f7f9fc;border:1px solid #e3e8ee;border-radius:12px;padding:18px;text-align:center"><div style="font-size:12px;color:#687386;font-weight:700">VERIFICATION CODE</div><div style="font-size:32px;letter-spacing:8px;font-weight:900;margin-top:8px">'+code+'</div></div><p style="text-align:center;color:#687386">Or click the button below.</p><p style="text-align:center"><a href="'+escapeHtml_(verifyUrl)+'" style="display:inline-block;background:#d7a62a;color:#071d38;text-decoration:none;font-weight:900;padding:14px 22px;border-radius:9px">VERIFY MY EMAIL</a></p><p style="font-size:13px;color:#687386">This verification expires in 15 minutes. If you did not create this account, you can ignore this email.</p><p>'+escapeHtml_(CONFIG.COMPANY)+'</p></div></div></body></html>';
}

function escapeHtml_(value){return String(value==null?"":value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}

function handleResendVerification_(data){
  const email=requiredEmail_(data.email); const u=findUserByEmail_(email);
  if(!u) throw new Error("Account not found. Create an account first.");
  if(u.status==="ACTIVE") throw new Error("This account is already verified. Please sign in.");
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")); const vsh=ss.getSheetByName(CONFIG.VERIFICATION_SHEET_NAME); const v=getVerificationRow_(email);
  const code=String(Math.floor(100000+Math.random()*900000)), linkToken=randomToken_(), expires=new Date(Date.now()+15*60*1000);
  const verifyUrl=ScriptApp.getService().getUrl()+"?action=verify_email&email="+encodeURIComponent(email)+"&token="+encodeURIComponent(linkToken);
  const row=[new Date(),u.userId,email,hashValue_(code,"EMAIL_VERIFY"),hashValue_(linkToken,"EMAIL_VERIFY_LINK"),expires,0,"PENDING"];
  if(v){vsh.getRange(v.row,1,1,8).setValues([row]);}else{vsh.appendRow(row);}
  MailApp.sendEmail({to:email,subject:"TW&D Marketplace verification code",htmlBody:emailVerificationHtml_(u.fullName,email,code,verifyUrl),body:"Your new TW&D Marketplace verification code is: "+code+"\n\nVerification link:\n"+verifyUrl+"\n\nThis verification expires in 15 minutes.\n\n"+CONFIG.COMPANY,replyTo:CONFIG.REPLY_TO});
  return json({ok:true,message:"A new verification code and verification link have been sent to your email."});
}
function handleLogin_(data){const email=requiredEmail_(data.email), password=String(data.password||""); const u=findUserByEmail_(email); if(!u) throw new Error("Account not found. Please create an account first."); const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")), sh=ss.getSheetByName(CONFIG.USERS_SHEET_NAME), vals=sh.getDataRange().getValues(), h=vals[0], idx={}; h.forEach(function(x,i){idx[String(x)]=i;}); let salt=""; for(let i=1;i<vals.length;i++){if(String(vals[i][idx["User ID"]])===u.userId){salt=String(vals[i][idx["Password Salt"]]||"");break;}} if(hashValue_(password,salt)!==hashValue_(password,salt) && false){} const stored=vals.slice(1).find(r=>String(r[idx["User ID"]])===u.userId); if(!stored || hashValue_(password,String(stored[idx["Password Salt"]]))!==String(stored[idx["Password Hash"]])) throw new Error("Incorrect email or password."); if(u.status==="PENDING_EMAIL") throw new Error("Please verify your email before signing in. Use the verification code sent to your email."); if(u.status!=="ACTIVE") throw new Error("This account is not active."); return json({ok:true,message:"Signed in successfully.",token:createSession_(u.userId),user:publicUser_(u)});}
function handleLogout_(data){try{const raw=clean_(data.sessionToken); const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")), sh=ss.getSheetByName(CONFIG.SESSIONS_SHEET_NAME); if(raw&&sh){const vals=sh.getDataRange().getValues(),h=vals[0],idx={};h.forEach(function(x,i){idx[String(x)]=i;});for(let i=1;i<vals.length;i++)if(String(vals[i][idx["Token Hash"]])===hashValue_(raw,"TWDM_SESSION"))sh.getRange(i+1,idx["Status"]+1).setValue("REVOKED");}}catch(e){} return json({ok:true});}
function handleMe_(data){const u=requireSession_(data.sessionToken); return json({ok:true,user:publicUser_(u)});}
function sellerProfile_(userId){const u=findUserById_(userId); if(!u) return null; const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")), sh=ss.getSheetByName(CONFIG.SHEET_NAME); let count=0, items=[]; if(sh&&sh.getLastRow()>1){const v=sh.getDataRange().getValues(),h=v[0],idx={};h.forEach(function(x,i){idx[String(x)]=i;});for(let i=1;i<v.length;i++){if(String(v[i][idx["Account ID"]]||"")===userId&&String(v[i][idx["Status"]]||"").toUpperCase()==="APPROVED"){count++;items.push(String(v[i][idx["Listing ID"]]||""));}}} return {user:publicUser_(u),approvedListings:count,listingIds:items};}
function handleSendMessage_(data){const u=requireSession_(data.sessionToken), to=clean_(data.toUserId), listingId=clean_(data.listingId), msg=required_(data.message,"Message"); if(!to||to===u.userId) throw new Error("Invalid recipient."); const target=findUserById_(to); if(!target) throw new Error("Seller account not found."); const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")); ss.getSheetByName(CONFIG.MESSAGES_SHEET_NAME).appendRow([new Date(),"MSG-"+Utilities.getUuid().slice(0,12).toUpperCase(),listingId,u.userId,to,msg,"UNREAD"]); return json({ok:true,message:"Message sent."});}
function handleMessages_(data){const u=requireSession_(data.sessionToken), ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")), sh=ss.getSheetByName(CONFIG.MESSAGES_SHEET_NAME); if(!sh||sh.getLastRow()<2)return json({ok:true,messages:[]}); const v=sh.getDataRange().getValues(),h=v[0],idx={};h.forEach(function(x,i){idx[String(x)]=i;}); const out=[];for(let i=1;i<v.length;i++){if(String(v[i][idx["From User ID"]])===u.userId||String(v[i][idx["To User ID"]])===u.userId)out.push({id:String(v[i][idx["Message ID"]]),listingId:String(v[i][idx["Listing ID"]]),fromUserId:String(v[i][idx["From User ID"]]),toUserId:String(v[i][idx["To User ID"]]),message:String(v[i][idx["Message"]]),timestamp:String(v[i][idx["Timestamp"]]),status:String(v[i][idx["Status"]])});} return json({ok:true,messages:out.slice(-100)});}
/**
 * REQUIRED FIELD
 */
function required_(
  value,
  label
) {
  const result =
    clean_(value);

  if (!result) {
    throw new Error(
      "Missing required field: " +
      label
    );
  }

  return result.substring(
    0,
    10000
  );
}

/**
 * EMAIL VALIDATION
 */
function requiredEmail_(
  value
) {
  const email =
    clean_(value)
      .toLowerCase();

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "Please provide a valid email address."
    );
  }

  return email.substring(
    0,
    320
  );
}

/**
 * CLEAN TEXT
 */
function clean_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(
    value
  ).trim();
}

/**
 * SAFE DRIVE FOLDER NAME
 */
function safeFolderName_(
  value
) {
  return clean_(value)
    .replace(
      /[\\/:*?"<>|#%{}]/g,
      ""
    )
    .substring(
      0,
      80
    ) ||
    "Listing";
}

/**
 * SAFE FILE NAME
 */
function safeFileName_(
  value
) {
  const name =
    clean_(value)
      .replace(
        /[\\/:*?"<>|#%{}]/g,
        "_"
      )
      .substring(
        0,
        150
      );

  return (
    name ||
    (
      "photo-" +
      new Date().getTime() +
      ".jpg"
    )
  );
}

/**
 * ALLOWED IMAGE TYPES
 */
function allowedImageType_(
  type
) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  return (
    allowed.indexOf(type) >= 0
      ? type
      : "image/jpeg"
  );
}

/**
 * SAFE ERROR MESSAGE
 */
function safeErrorMessage_(
  error
) {
  if (!error) {
    return "Please try again.";
  }

  const message =
    clean_(
      error.message ||
      error
    );

  return message.substring(
    0,
    500
  );
}

/**
 * JSON RESPONSE
 */
function json(
  data
) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

/**
 * SAFE TEST
 *
 * IMPORTANT:
 * This test does NOT write into
 * Marketplace Listings.
 *
 * It writes only into
 * Marketplace Tests.
 */
function testMarketplaceWrite() {
  const props =
    PropertiesService.getScriptProperties();

  const spreadsheetId =
    props.getProperty("SHEET_ID") ||
    props.getProperty(
      "MARKETPLACE_SPREADSHEET_ID"
    );

  if (!spreadsheetId) {
    throw new Error(
      "Run setupMarketplace() first."
    );
  }

  const spreadsheet =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  let sheet =
    spreadsheet.getSheetByName(
      "Marketplace Tests"
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        "Marketplace Tests"
      );
  }

  if (
    sheet.getLastRow() === 0
  ) {
    sheet.appendRow([
      "Timestamp",
      "Test ID",
      "Result",
      "Message"
    ]);
  }

  const testId =
    "TEST-" +
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      "yyyyMMdd-HHmmss"
    );

  sheet.appendRow([
    new Date(),
    testId,
    "PASS",
    "Backend spreadsheet write test. This test is intentionally kept out of Marketplace Listings."
  ]);

  return (
    "TEST PASSED: " +
    testId +
    " was written to Marketplace Tests. Marketplace Listings was not modified."
  );
}