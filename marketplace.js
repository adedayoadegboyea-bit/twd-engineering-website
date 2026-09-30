const ENDPOINT = "https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";

let listings = [];
const MARKETPLACE_TOKEN_KEY = "twd_marketplace_session_token";
const getSessionToken = () => localStorage.getItem(MARKETPLACE_TOKEN_KEY) || "";

const grid = document.querySelector("#listingGrid");
const empty = document.querySelector("#empty");
const form = document.querySelector("#listingForm");
const statusBox = document.querySelector("#formStatus");

const money = value => {
  const n = Number(value || 0);
  return n > 0
    ? new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(n)
    : "Contact seller";
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}

function publicImageUrl(value) {
  const src = String(value || "").trim();
  if (!src) return "";

  // Google Drive file URL: /file/d/FILE_ID/view
  let match = src.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(match[1]) + "&sz=w1600";
  }

  // Google Drive thumbnail/open URL with ?id=FILE_ID
  match = src.match(/[?&]id=([^&]+)/i);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(match[1]) + "&sz=w1600";
  }

  // Google Drive uc?export=view&id=FILE_ID
  match = src.match(/(?:export=view|uc[^?]*)[?&]id=([^&]+)/i);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(match[1]) + "&sz=w1600";
  }

  return src;
}
function render() {
  const search = (document.querySelector("#search").value || "").toLowerCase().trim();
  const category = document.querySelector("#category").value;
  const location = document.querySelector("#location").value;

  const rows = listings.filter(item => {
    const seller = String(item.seller || "").toLowerCase();
    const normalizedImages = Array.isArray(item.images) && item.images.length ? item.images : (item.image ? [item.image] : []);
    const normalizedVideos = Array.isArray(item.videos) ? item.videos : [];
    const hasUploadedMedia = normalizedImages.length > 0 || normalizedVideos.length > 0;
    const isCompanyOrDemo = seller.includes("tw&d") || seller.includes("twd engineering") || seller.includes("marketplace demo") || seller.includes("system test");
    if (isCompanyOrDemo) return false;
    const haystack = [item.title,item.category,item.location,item.seller].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) && (!category || item.category === category) && (!location || item.location.toLowerCase().includes(location.toLowerCase()));
  });

  grid.innerHTML = rows.map(item => {
    const title = escapeHtml(item.title);
    const normalizedImages = Array.isArray(item.images) && item.images.length ? item.images : (item.image ? [item.image] : []);
    const images = normalizedImages.map(publicImageUrl);
    const videos = Array.isArray(item.videos) ? item.videos.map(publicImageUrl).filter(Boolean) : [];
    const image = escapeHtml(publicImageUrl(images[0] || ""));
    const categoryText = escapeHtml(item.category);
    const locationText = escapeHtml(item.location);
    const conditionText = escapeHtml(item.condition || "");
    const wa = "marketplace-listing.html?id=" + encodeURIComponent(item.id);
    const gallery = images.slice(0, 5).map((src, index) => '<img src="' + escapeHtml(src) + '" alt="' + title + ' photo ' + (index + 1) + '" loading="eager" decoding="async" data-gallery-src="' + escapeHtml(src) + '">').join("");
    const videoBlock = videos.length ? '<div class="listing-videos">' + videos.slice(0, 2).map((src, index) => '<video controls preload="metadata" playsinline src="' + escapeHtml(src) + '" aria-label="' + title + ' advertisement video ' + (index + 1) + '"></video>').join("") + '</div>' : "";

    return `<article class="listing">
      <div class="listing-media">
        ${images.length ? '<img class="listing-main-image" src="' + image + '" alt="' + title + '" loading="eager" decoding="async">' : '<div class="listing-video-placeholder">VIDEO ADVERTISEMENT</div>'}
        ${images.length > 1 ? '<div class="listing-thumbs">' + gallery + '</div>' : ''}
        ${videoBlock}
      </div>
      <div class="listing-body">
        <span class="tag">${categoryText}</span>
        <h3>${title}</h3>
        <div class="price">${money(item.price)}</div>
        <div class="meta">${locationText} • ${conditionText}</div>
        <a href="${wa}">View listing & seller →</a>
      </div>
    </article>`;
  }).join("");

  empty.hidden = rows.length > 0;
  grid.querySelectorAll(".listing").forEach(card => {
    const main = card.querySelector(".listing-main-image");
    card.querySelectorAll(".listing-thumbs img").forEach(thumb => {
      thumb.addEventListener("click", () => {
        const src = thumb.getAttribute("data-gallery-src");
        if (!src || !main) return;
        main.src = src;
        main.classList.remove("listing-image-swap");
        void main.offsetWidth;
        main.classList.add("listing-image-swap");
      });
    });
  });
}

["#search","#category","#location"].forEach(selector => {
  document.querySelector(selector).addEventListener("input", render);
  document.querySelector(selector).addEventListener("change", render);
});

async function loadApprovedListings() {
  try {
    const response = await fetch(ENDPOINT + "?action=listings&_=" + Date.now(), {cache:"no-store"});
    if (!response.ok) return;

    const data = await response.json();
    if (data && Array.isArray(data.listings)) {
      listings = data.listings;
      render();
    }
  } catch (error) {
    console.log("Approved marketplace listings are not available yet.", error);
  }
}


// ---------------- LISTING OPTION / EMBEDDED SUBSCRIPTION ----------------
const listingOptionInputs = document.querySelectorAll('input[name="listingOption"]');
const embeddedChoices = document.querySelector("#embeddedSubscriptionChoices");
const selectedPlanBox = document.querySelector("#listingSelectedPlan");
const listingSubmitButton = document.querySelector("#listingSubmitButton");

function setListingOption(option) {
  const paid = option === "subscription";
  embeddedChoices.hidden = !paid;
  document.querySelectorAll(".listing-choice").forEach(card => {
    card.classList.toggle("selected", card.dataset.choice === option);
  });

  if (!paid) {
    selectedPlanBox.textContent = "Free listing selected — no subscription payment required.";
    listingSubmitButton.textContent = "Submit Free Listing for Review";
    return;
  }

  const selected = document.querySelector(".embedded-plan.selected");
  const plan = selected?.dataset.embeddedPlan || "Business — ₦15,000/month";
  selectedPlanBox.innerHTML = "Selected subscription: <strong>" + escapeHtml(plan) + "</strong> — continue to secure payment below.";
  listingSubmitButton.textContent = "Submit Listing & Continue to Subscription";
}

listingOptionInputs.forEach(input => {
  input.addEventListener("change", () => setListingOption(input.value));
});

document.querySelectorAll(".embedded-plan").forEach(card => {
  const button = card.querySelector("button");
  button.addEventListener("click", () => {
    document.querySelectorAll(".embedded-plan").forEach(item => item.classList.remove("selected"));
    card.classList.add("selected");
    const plan = card.dataset.embeddedPlan || "";
    selectedPlanBox.innerHTML = "Selected subscription: <strong>" + escapeHtml(plan) + "</strong> — continue to secure payment below.";
  });
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    statusBox.textContent = "Please create a marketplace account or sign in before submitting a listing.";
    window.location.href = "marketplace-account.html?next=listing";
    return;
  }

  const files = [...form.photos.files];
  const MAX = 5 * 1024 * 1024;
  const MAX_TOTAL = 15 * 1024 * 1024;

  if (!files.length) {
    statusBox.textContent = "Please select at least one photo or advertisement video.";
    return;
  }

  const allowedImageTypes = ["image/jpeg","image/png","image/webp"];
  const allowedVideoTypes = ["video/mp4","video/webm","video/quicktime"];
  const invalid = files.find(file => !allowedImageTypes.includes(file.type) && !allowedVideoTypes.includes(file.type));
  if (invalid) {
    statusBox.textContent = "Only JPG, PNG, WEBP, MP4, WEBM or MOV videos are allowed.";
    return;
  }

  if (files.some(file => file.size > MAX)) {
    statusBox.textContent = "Each photo or video must be 5 MB or smaller.";
    return;
  }

  if (files.reduce((sum,file) => sum + file.size, 0) > MAX_TOTAL) {
    statusBox.textContent = "Please keep all photos and videos together below 15 MB.";
    return;
  }

  statusBox.textContent = "Uploading your listing securely…";

  try {
    const payload = {};
    new FormData(form).forEach((value,key) => {
      if (key !== "photos") payload[key] = value;
    });

    payload.sessionToken = sessionToken;
    payload.photos = [];
    for (const file of files) {
      payload.photos.push({
        name:file.name,
        type:file.type,
        size:file.size,
        data:await toBase64(file)
      });
    }

    const response = await fetch(ENDPOINT, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || "The marketplace rejected the submission.");
    }

    statusBox.textContent = data.message + (data.listingId ? " Reference: " + data.listingId : "");
    const option = form.querySelector('input[name="listingOption"]:checked')?.value || "free";
    const selectedPlan = document.querySelector(".embedded-plan.selected")?.dataset.embeddedPlan || "Business — ₦15,000/month";
    form.reset();
    document.querySelector('input[name="listingOption"][value="free"]').checked = true;
    setListingOption("free");
    if (option === "subscription") {
      openSubscription(selectedPlan, data.listingId || "");
    }
  } catch (error) {
    console.error(error);
    statusBox.textContent = error.message || "Submission failed. Please try again.";
  }
});

function toBase64(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------- SUBSCRIPTIONS ----------------

const subscriptionModal = document.querySelector("#subscriptionModal");
const subscriptionForm = document.querySelector("#subscriptionForm");
const closeSubscriptionButton = document.querySelector("#closeSubscription");
const subscriptionStatus = document.querySelector("#subscriptionStatus");

function ensureSubscriptionFields() {
  if (!subscriptionForm) return;

  if (!document.querySelector("#subscriptionListingId")) {
    const listingLabel = document.createElement("label");
    listingLabel.innerHTML =
      'Listing ID (optional)<input id="subscriptionListingId" name="listingId" placeholder="Example: TWM-20260927-113732-8940">';
    subscriptionForm.insertBefore(listingLabel, subscriptionForm.querySelector("button"));
  }

  if (!document.querySelector("#subscriptionPaymentMethod")) {
    const methodLabel = document.createElement("label");
    methodLabel.innerHTML =
      '<span>Payment method</span><select id="subscriptionPaymentMethod" name="paymentMethod">' +
      '<option value="flutterwave">Flutterwave — Card / Bank / USSD</option>' +
      '<option value="payoneer">Payoneer</option>' +
      '<option value="bank_transfer">Bank Transfer — Moniepoint / Premium Trust Bank</option>' +
      '</select>';
    subscriptionForm.insertBefore(methodLabel, subscriptionForm.querySelector("button"));
  }

  if (!document.querySelector("#subscriptionPaymentBox")) {
    const box = document.createElement("div");
    box.id = "subscriptionPaymentBox";
    box.className = "subscription-payment-box";
    box.hidden = true;
    subscriptionForm.insertBefore(box, subscriptionForm.querySelector("button"));
  }

  const paymentMethod = document.querySelector("#subscriptionPaymentMethod");
  if (paymentMethod && !paymentMethod.dataset.previewBound) {
    paymentMethod.addEventListener("change", updatePaymentMethodPreview);
    paymentMethod.dataset.previewBound = "1";
  }

  updatePaymentMethodPreview();
}

function copyPaymentValue(button) {
  const value = String(button?.dataset.copyValue || "").trim();
  if (!value) return;

  const done = () => {
    const original = button.textContent;
    button.textContent = "Copied ✓";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = original || "Copy";
      button.classList.remove("copied");
    }, 1400);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopyPaymentValue(value, done));
  } else {
    fallbackCopyPaymentValue(value, done);
  }
}

function fallbackCopyPaymentValue(value, done) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  try { document.execCommand("copy"); done(); }
  catch (error) { console.error(error); }
  input.remove();
}

function wireCopyPaymentButtons(box) {
  box.querySelectorAll(".copy-payment-btn").forEach(button => {
    button.addEventListener("click", () => copyPaymentValue(button));
  });
}

function bankDetailRow(label, value) {
  return '<div class="bank-payment-row"><div><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>' +
    '<button type="button" class="copy-payment-btn" data-copy-value="' + escapeHtml(value) + '">Copy</button></div>';
}

function getFlutterwavePlanDetails(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.indexOf("starter") === 0) return { amount: 5000, label: "Starter", url: "https://flutterwave.com/pay/tpdl5uufd62l" };
  if (p.indexOf("business") === 0) return { amount: 15000, label: "Business", url: "https://flutterwave.com/pay/26nqlxpttr1t" };
  if (p.indexOf("pro") === 0) return { amount: 30000, label: "Pro", url: "https://flutterwave.com/pay/frhgwtnzuaez" };
  return { amount: 0, label: "Subscription", url: "" };
}

function updatePaymentMethodPreview() {
  const method = String(document.querySelector("#subscriptionPaymentMethod")?.value || "flutterwave").toLowerCase();
  const box = document.querySelector("#subscriptionPaymentBox");
  if (!box) return;

  if (method === "flutterwave") {
    const plan = document.querySelector("#subscriptionPlan")?.value || "";
    const details = getFlutterwavePlanDetails(plan);
    box.hidden = false;
    box.innerHTML =
      '<div class="payment-checkout-card">' +
      '<div class="checkout-provider"><span class="provider-mark">FW</span><div><strong>Flutterwave Secure Checkout</strong><small>Powered checkout • Nigeria</small></div><span class="checkout-secure">SECURE</span></div>' +
      '<div class="checkout-amount"><span>Amount due</span><strong>₦' + details.amount.toLocaleString("en-NG") + '</strong><small>' + escapeHtml(details.label) + ' Seller Subscription</small></div>' +
      '<div class="checkout-methods"><span>✓ Card</span><span>✓ Bank Transfer</span><span>✓ USSD</span></div>' +
      '<p class="status">Your plan and amount are already selected. After your subscription request is recorded, you will continue to Flutterwave to complete payment securely.</p>' +
      '<div class="checkout-trust"><span>🔒 Secure checkout</span><span>•</span><span>Payment reference generated by TW&D</span></div>' +
      '</div>';
    return;
  }

  if (method === "bank_transfer") {
    box.hidden = false;
    box.innerHTML =
      '<div class="payment-success">' +
      '<strong>TW&D BANK TRANSFER DETAILS</strong>' +
      '<p class="status">You can make payment directly to either official TW&D company account below. Use the Copy button beside any bank, account name or account number.</p>' +
      '<div class="bank-payment-details">' +
      bankDetailRow("Bank", "Moniepoint") +
      bankDetailRow("Account Name", "TW&D ENGINEERING CONSULT & SERVICES LTD") +
      bankDetailRow("Account Number", "6365401118") +
      '</div>' +
      '<div class="bank-payment-details">' +
      bankDetailRow("Bank", "Premium Trust Bank") +
      bankDetailRow("Account Name", "TW&D ENGINEERING CONSULT & SERVICES LTD") +
      bankDetailRow("Account Number", "0040278142") +
      '</div>' +
      '<p class="status"><strong>Important:</strong> After transfer, keep your receipt. Submit this subscription request, then send the payment receipt and subscription reference to TW&D management for verification and activation.</p>' +
      '</div>';
    wireCopyPaymentButtons(box);
    return;
  }

  box.hidden = false;
  box.innerHTML =
    '<div class="payment-success">' +
    '<strong>PAYONEER PAYMENT</strong>' +
    '<p class="status">Payoneer account: <strong>adedayo.adegboyea@gmail.com</strong> <button type="button" class="copy-payment-btn inline-copy" data-copy-value="adedayo.adegboyea@gmail.com">Copy</button></p>' +
    '<p class="status">Submit your subscription request to receive the secure Payoneer payment link.</p>' +
    '</div>';
  wireCopyPaymentButtons(box);
}
function showPaymentResult(data) {
  const box = document.querySelector("#subscriptionPaymentBox");
  if (!box) return;

  const method = String(data.paymentMethod || "").toLowerCase().trim();
  const paymentUrl = String(data.paymentUrl || data.payoneerUrl || "").trim();
  const reference = escapeHtml(data.subscriptionId || "");

  // FLUTTERWAVE
  if (method === "flutterwave") {
    const plan = document.querySelector("#subscriptionPlan")?.value || "";
    const details = getFlutterwavePlanDetails(plan);
    box.hidden = false;
    box.innerHTML =
      '<div class="payment-checkout-card payment-ready">' +
      '<div class="checkout-provider"><span class="provider-mark">FW</span><div><strong>Payment ready</strong><small>Flutterwave secure checkout</small></div><span class="checkout-secure">READY</span></div>' +
      '<div class="checkout-amount"><span>Amount due</span><strong>₦' + details.amount.toLocaleString("en-NG") + '</strong><small>' + escapeHtml(details.label) + ' Seller Subscription</small></div>' +
      '<a class="checkout-pay-button" href="' + escapeHtml(details.url) + '" target="_blank" rel="noopener noreferrer">Continue to secure payment →</a>' +
      (reference ? '<p class="status">Subscription reference: <strong>' + reference + '</strong></p>' : '') +
      '<p class="checkout-note">Complete payment on Flutterwave, then return to this page. Keep your subscription reference for confirmation.</p>' +
      '</div>';
    return;
  }

  // PAYONEER
  if (method === "payoneer") {
    if (paymentUrl) {
      box.hidden = false;
      box.innerHTML =
        '<div class="payment-success">' +
        '<strong>Complete your Payoneer payment</strong>' +
        '<p>Your subscription request has been recorded. Click the button below to continue to the secure Payoneer payment page.</p>' +
        '<a class="primary" href="' + escapeHtml(paymentUrl) + '" target="_blank" rel="noopener noreferrer">Pay with Payoneer →</a>' +
        '<p class="status">Payoneer account: <strong>adedayo.adegboyea@gmail.com</strong></p>' +
        (reference ? '<p class="status">Subscription reference: <strong>' + reference + '</strong></p>' : '') +
        '</div>';
    } else {
      box.hidden = false;
      box.innerHTML =
        '<div class="payment-success">' +
        '<strong>Payoneer payment</strong>' +
        '<p>Your subscription request has been recorded. Payoneer is configured for <strong>adedayo.adegboyea@gmail.com</strong>, but the secure payment link still needs to be added by management.</p>' +
        (reference ? '<p class="status">Subscription reference: <strong>' + reference + '</strong></p>' : '') +
        '</div>';
    }
    return;
  }

  // NIGERIAN BANK TRANSFER
  if (method === "bank_transfer") {
    const bank = data.bankTransfer || {};
    const primary = bank.primary || {};
    const secondary = bank.secondary || {};
    const primaryName = primary.bankName || "Moniepoint";
    const primaryAccountName = primary.accountName || "TW&D ENGINEERING CONSULT & SERVICES LTD";
    const primaryAccountNumber = primary.accountNumber || "6365401118";
    const secondaryName = secondary.bankName || "Premium Trust Bank";
    const secondaryAccountName = secondary.accountName || "TW&D ENGINEERING CONSULT & SERVICES LTD";
    const secondaryAccountNumber = secondary.accountNumber || "0040278142";

    box.hidden = false;
    box.innerHTML =
      '<div class="payment-success">' +
      '<strong>Complete your bank transfer</strong>' +
      '<p>Your subscription request has been recorded. You may transfer the subscription amount to either TW&D account below. Copy the details directly from this screen.</p>' +
      '<div class="bank-payment-details">' +
      bankDetailRow("Bank", primaryName) +
      bankDetailRow("Account Name", primaryAccountName) +
      bankDetailRow("Account Number", primaryAccountNumber) +
      '</div>' +
      '<div class="bank-payment-details">' +
      bankDetailRow("Bank", secondaryName) +
      bankDetailRow("Account Name", secondaryAccountName) +
      bankDetailRow("Account Number", secondaryAccountNumber) +
      '</div>' +
      '<p class="status">After payment, send your transfer receipt and subscription reference to TW&D management for verification and activation.</p>' +
      (reference ? '<p class="status">Subscription reference: <strong>' + reference + '</strong></p>' : '') +
      '</div>';
    wireCopyPaymentButtons(box);
    return;
  }

  box.hidden = false;
  box.innerHTML =
    '<strong>Payment instructions</strong>' +
    '<p>Your subscription request has been recorded. Please follow the payment instructions provided.</p>' +
    (reference ? '<p class="status">Subscription reference: ' + reference + '</p>' : '');
}

function openSubscription(plan, listingId = "") {
  if (!subscriptionModal || !subscriptionForm) return;

  ensureSubscriptionFields();

  const planInput = document.querySelector("#subscriptionPlan");
  const sellerInput = document.querySelector("#subscriptionSeller");
  const emailInput = document.querySelector("#subscriptionEmail");
  const phoneInput = document.querySelector("#subscriptionPhone");
  const listingInput = document.querySelector("#subscriptionListingId");
  const paymentMethod = document.querySelector("#subscriptionPaymentMethod");
  const paymentBox = document.querySelector("#subscriptionPaymentBox");

  planInput.value = plan || "";
  sellerInput.value = "";
  emailInput.value = "";
  phoneInput.value = "";
  listingInput.value = listingId || "";
  paymentMethod.value = "flutterwave";
  paymentBox.hidden = true;
  paymentBox.innerHTML = "";
  subscriptionStatus.textContent = "";
  updatePaymentMethodPreview();

  subscriptionModal.hidden = false;
  sellerInput.focus();
}

document.querySelectorAll("[data-plan]").forEach(button => {
  button.addEventListener("click", () => {
    openSubscription(
      button.dataset.plan || "",
      button.dataset.listingId || ""
    );
  });
});

function closeSubscription() {
  if (subscriptionModal) subscriptionModal.hidden = true;
}

if (closeSubscriptionButton) {
  closeSubscriptionButton.addEventListener("click", closeSubscription);
}

if (subscriptionModal) {
  subscriptionModal.addEventListener("click", event => {
    if (event.target.id === "subscriptionModal") closeSubscription();
  });
}

if (subscriptionForm) {
  subscriptionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload = {
      action: "subscribe",
      plan: String(formData.get("plan") || "").trim(),
      sellerName: String(formData.get("sellerName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      listingId: String(formData.get("listingId") || "").trim(),
      paymentMethod: String(formData.get("paymentMethod") || "payoneer").trim()
    };

    if (!payload.sellerName || !payload.email || !payload.phone || !payload.plan) {
      subscriptionStatus.textContent = "Please complete all required fields.";
      return;
    }

    subscriptionStatus.textContent = "Recording your subscription request securely…";

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Subscription request failed.");
      }

      subscriptionStatus.textContent =
        (data.message || "Subscription request received.") +
        (data.subscriptionId ? " Reference: " + data.subscriptionId : "");

      showPaymentResult(data);

      if (data.subscriptionId) {
        const oldReference = subscriptionForm.querySelector('input[name="subscriptionReference"]');
        if (oldReference) oldReference.remove();

        const hiddenReference = document.createElement("input");
        hiddenReference.type = "hidden";
        hiddenReference.name = "subscriptionReference";
        hiddenReference.value = data.subscriptionId;
        subscriptionForm.appendChild(hiddenReference);
      }
    } catch (error) {
      console.error(error);
      subscriptionStatus.textContent =
        error.message || "Unable to send the subscription request.";
    }
  });
}

render();
loadApprovedListings();
