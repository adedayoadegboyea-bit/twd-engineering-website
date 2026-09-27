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
  if (!src) return "assets/building.jpg";
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
    const haystack = [item.title,item.category,item.location,item.seller].join(" ").toLowerCase();
    return (!search || haystack.includes(search))
      && (!category || item.category === category)
      && (!location || item.location.toLowerCase().includes(location.toLowerCase()));
  });

  grid.innerHTML = rows.map(item => {
    const title = escapeHtml(item.title);
    const images = Array.isArray(item.images) && item.images.length
      ? item.images
      : (item.image ? [item.image] : ["assets/building.jpg"]);
    const image = escapeHtml(publicImageUrl(images[0] || "assets/building.jpg"));
    const categoryText = escapeHtml(item.category);
    const locationText = escapeHtml(item.location);
    const conditionText = escapeHtml(item.condition || "");
    const wa = "https://wa.me/2348035774420?text=" +
      encodeURIComponent("Hello TW&D Marketplace, I am interested in: " + item.title);

    const gallery = images.slice(0, 5).map((src, index) =>
      '<img src="' + escapeHtml(src) + '" alt="' + title + ' photo ' + (index + 1) + '" loading="lazy">'
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

document.querySelectorAll("[data-plan]").forEach(button => {
  button.addEventListener("click", () => openSubscription(button.dataset.plan));
});

function openSubscription(plan) {
  const modal = document.querySelector("#subscriptionModal");
  const planInput = document.querySelector("#subscriptionPlan");
  const sellerInput = document.querySelector("#subscriptionSeller");
  const emailInput = document.querySelector("#subscriptionEmail");
  const phoneInput = document.querySelector("#subscriptionPhone");
  const message = document.querySelector("#subscriptionStatus");

  planInput.value = plan;
  sellerInput.value = "";
  emailInput.value = "";
  phoneInput.value = "";
  message.textContent = "";
  modal.hidden = false;
  sellerInput.focus();
}

function closeSubscription() {
  document.querySelector("#subscriptionModal").hidden = true;
}

document.querySelector("#closeSubscription").addEventListener("click", closeSubscription);
document.querySelector("#subscriptionModal").addEventListener("click", event => {
  if (event.target.id === "subscriptionModal") closeSubscription();
});

document.querySelector("#subscriptionForm").addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const status = document.querySelector("#subscriptionStatus");
  const payload = {
    action:"subscribe",
    plan:formData.get("plan"),
    sellerName:formData.get("sellerName"),
    email:formData.get("email"),
    phone:formData.get("phone")
  };

  status.textContent = "Sending your subscription request…";

  try {
    const response = await fetch(ENDPOINT, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || "Subscription request failed.");
    }

    status.textContent = data.message + (data.subscriptionId ? " Reference: " + data.subscriptionId : "");
    event.currentTarget.reset();
  } catch (error) {
    console.error(error);
    status.textContent = error.message || "Unable to send the subscription request.";
  }
});

render();
loadApprovedListings();
