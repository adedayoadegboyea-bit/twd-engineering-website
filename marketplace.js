const ENDPOINT = "https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";

let listings = [];

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
  const match = src.match(/[?&]id=([^&]+)/);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(match[1]) + "&sz=w1200";
  }
  return src;
}

function render() {
  const search = (document.querySelector("#search").value || "").toLowerCase().trim();
  const category = document.querySelector("#category").value;
  const location = document.querySelector("#location").value;

  const rows = listings.filter(item => {
    const seller = String(item.seller || "").toLowerCase();
    const normalizedImages = Array.isArray(item.images) && item.images.length
      ? item.images
      : (item.image ? [item.image] : []);
    const hasUploadedPhoto = normalizedImages.length > 0;
    const isCompanyOrDemo =
      seller.includes("tw&d") ||
      seller.includes("twd engineering") ||
      seller.includes("marketplace demo") ||
      seller.includes("system test");

    if (isCompanyOrDemo || !hasUploadedPhoto) return false;
    const haystack = [item.title,item.category,item.location,item.seller].join(" ").toLowerCase();
    return (!search || haystack.includes(search))
      && (!category || item.category === category)
      && (!location || item.location.toLowerCase().includes(location.toLowerCase()));
  });

  grid.innerHTML = rows.map(item => {
    const title = escapeHtml(item.title);
    const normalizedImages = Array.isArray(item.images) && item.images.length
      ? item.images
      : (item.image ? [item.image] : []);
    const images = normalizedImages.map(publicImageUrl);
    const image = escapeHtml(publicImageUrl(images[0] || ""));
    const categoryText = escapeHtml(item.category);
    const locationText = escapeHtml(item.location);
    const conditionText = escapeHtml(item.condition || "");
    const wa = "https://wa.me/2348035774420?text=" +
      encodeURIComponent("Hello TW&D Marketplace, I am interested in: " + item.title);

    const gallery = images.slice(0, 5).map((src, index) =>
      '<img src="' + escapeHtml(src) + '" alt="' + title + ' photo ' + (index + 1) + '" loading="lazy" data-gallery-src="' + escapeHtml(src) + '">'
    ).join("");

    return `<article class="listing">
      <div class="listing-media">
        <img class="listing-main-image" src="${image}" alt="${title}" loading="lazy">
        ${images.length > 1 ? '<div class="listing-thumbs">' + gallery + '</div>' : ''}
      </div>
      <div class="listing-body">
        <span class="tag">${categoryText}</span>
        <h3>${title}</h3>
        <div class="price">${money(item.price)}</div>
        <div class="meta">${locationText} • ${conditionText}</div>
        <a href="${wa}" target="_blank" rel="noopener">Ask about this listing →</a>
      </div>
    </article>`;
  }).join("");

  empty.hidden = rows.length > 0;
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

form.addEventListener("submit", async event => {
  event.preventDefault();

  const files = [...form.photos.files];
  const MAX = 5 * 1024 * 1024;
  const MAX_TOTAL = 15 * 1024 * 1024;

  if (!files.length) {
    statusBox.textContent = "Please select at least one photo.";
    return;
  }

  if (files.some(file => file.size > MAX)) {
    statusBox.textContent = "Each photo must be 5 MB or smaller.";
    return;
  }

  if (files.reduce((sum,file) => sum + file.size, 0) > MAX_TOTAL) {
    statusBox.textContent = "Please keep all photos together below 15 MB.";
    return;
  }

  statusBox.textContent = "Uploading your listing securely…";

  try {
    const payload = {};
    new FormData(form).forEach((value,key) => {
      if (key !== "photos") payload[key] = value;
    });

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
    form.reset();
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
      '<option value="payoneer">Payoneer</option>' +
      '<option value="bank_transfer">Nigerian bank transfer</option>' +
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
}

function showPaymentResult(data) {
  const box = document.querySelector("#subscriptionPaymentBox");
  if (!box) return;

  const method = String(data.paymentMethod || "").toLowerCase().trim();
  const paymentUrl = String(data.paymentUrl || data.payoneerUrl || "").trim();
  const reference = escapeHtml(data.subscriptionId || "");

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
    const primaryName = escapeHtml(primary.bankName || "Moniepoint");
    const primaryAccountName = escapeHtml(primary.accountName || "TW&D ENGINEERING CONSULT & SERVICES LTD");
    const primaryAccountNumber = escapeHtml(primary.accountNumber || "");
    const secondaryName = escapeHtml(secondary.bankName || "Premium Trust Bank");
    const secondaryAccountName = escapeHtml(secondary.accountName || "TW&D ENGINEERING CONSULT & SERVICES LTD");
    const secondaryAccountNumber = escapeHtml(secondary.accountNumber || "");

    box.hidden = false;
    box.innerHTML =
      '<div class="payment-success">' +
      '<strong>Complete your bank transfer</strong>' +
      '<p>Your subscription request has been recorded. You may transfer the subscription amount to either TW&D account below, then keep your transaction receipt/reference.</p>' +
      '<div class="bank-payment-details">' +
      '<div><span>Bank</span><strong>' + primaryName + '</strong></div>' +
      '<div><span>Account Name</span><strong>' + primaryAccountName + '</strong></div>' +
      '<div><span>Account Number</span><strong>' + primaryAccountNumber + '</strong></div>' +
      '</div>' +
      '<div class="bank-payment-details">' +
      '<div><span>Bank</span><strong>' + secondaryName + '</strong></div>' +
      '<div><span>Account Name</span><strong>' + secondaryAccountName + '</strong></div>' +
      '<div><span>Account Number</span><strong>' + (secondaryAccountNumber || "Not configured yet") + '</strong></div>' +
      '</div>' +
      '<p class="status">After payment, send your transfer receipt and subscription reference to TW&D management for verification and activation.</p>' +
      (reference ? '<p class="status">Subscription reference: <strong>' + reference + '</strong></p>' : '') +
      '</div>';
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
  paymentMethod.value = "payoneer";
  paymentBox.hidden = true;
  paymentBox.innerHTML = "";
  subscriptionStatus.textContent = "";

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
