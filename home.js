import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const menu = document.getElementById("homeMenuButton");
const nav = document.getElementById("homeNav");
const compact = window.matchMedia("(max-width: 970px)");

function showMenu(open) {
  menu.setAttribute("aria-expanded", String(open));
  nav.toggleAttribute("data-open", open);
}

function syncMenu() {
  menu.hidden = !compact.matches;
  showMenu(false);
}

document.body.setAttribute("data-menu-ready", "");
menu.addEventListener("click", () => showMenu(menu.getAttribute("aria-expanded") !== "true"));
nav.addEventListener("click", event => {
  if (event.target.closest("a")) showMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || menu.getAttribute("aria-expanded") !== "true") return;
  showMenu(false);
  menu.focus();
});
compact.addEventListener("change", syncMenu);
syncMenu();

const counts = [...document.querySelectorAll("[data-activity]")];
const status = document.getElementById("activityStatus");
const numberFormat = new Intl.NumberFormat("en-NG");
const clock = new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" });
const refreshInterval = 60000;
let refreshedAt = null;
let loadingTotals = false;

async function refreshTotals() {
  if (loadingTotals) return;
  loadingTotals = true;
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/homepage_activity_totals", {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Could not fetch live totals.");

    const data = await response.json();
    const numbers = counts.map(counter => data[counter.dataset.activity]);
    const checked = new Date(data.checked_at);
    if (numbers.some(n => !Number.isSafeInteger(n) || n < 0) || Number.isNaN(checked.getTime())) {
      throw new Error("The response did not contain valid totals.");
    }

    counts.forEach((counter, index) => {
      counter.textContent = numberFormat.format(numbers[index]);
    });
    refreshedAt = checked;
    status.dataset.state = "live";
    status.textContent = "Live records · Refreshed " + clock.format(checked) + " WAT";
  } catch {
    status.dataset.state = "unavailable";
    status.textContent = refreshedAt
      ? "Showing the last available totals from " + clock.format(refreshedAt) + " WAT."
      : "Showing the latest confirmed company totals.";
  } finally {
    loadingTotals = false;
  }
}

refreshTotals();
window.setInterval(() => {
  if (!document.hidden) refreshTotals();
}, refreshInterval);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && (!refreshedAt || Date.now() - refreshedAt.getTime() >= refreshInterval)) {
    refreshTotals();
  }
});


/* Homepage gallery: rotate through every published gallery image without leaving the page. */
(() => {
  const grid = document.getElementById("homeGalleryGrid");
  if (!grid) return;
  const counter = document.getElementById("homeGalleryCounter");
  const previous = document.getElementById("homeGalleryPrev");
  const next = document.getElementById("homeGalleryNext");
  const pause = document.getElementById("homeGalleryPause");
  const pageSize = window.matchMedia("(max-width: 420px)").matches ? 2 : 6;
  let images = [];
  let page = 0;
  let timer = null;
  let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stop = () => { if (timer) window.clearInterval(timer); timer = null; };
  const updatePause = () => {
    pause.setAttribute("aria-pressed", String(paused));
    pause.textContent = paused ? "Play motion" : "Pause motion";
  };
  const render = () => {
    if (!images.length) return;
    const totalPages = Math.ceil(images.length / pageSize);
    page = (page + totalPages) % totalPages;
    const start = page * pageSize;
    const visible = images.slice(start, start + pageSize);
    grid.replaceChildren();
    visible.forEach((item, index) => {
      const figure = document.createElement("figure");
      figure.className = "home-gallery-card";
      const img = document.createElement("img");
      img.src = item.image_url;
      img.alt = item.title || item.caption || "TW&D engineering project gallery photograph";
      img.loading = "lazy";
      img.decoding = "async";
      const caption = document.createElement("figcaption");
      caption.textContent = item.title || item.category || "TW&D project gallery";
      figure.append(img, caption);
      grid.append(figure);
    });
    counter.textContent = "Showing " + (start + 1) + "–" + (start + visible.length) + " of " + images.length + " gallery images";
  };
  const start = () => {
    stop();
    if (!paused && images.length > pageSize) timer = window.setInterval(() => { page += 1; render(); }, 6500);
  };
  const move = delta => { page += delta; render(); start(); };
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  pause.addEventListener("click", () => { paused = !paused; updatePause(); start(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });
  grid.addEventListener("mouseenter", stop);
  grid.addEventListener("mouseleave", start);
  grid.addEventListener("focusin", stop);
  grid.addEventListener("focusout", start);
  updatePause();

  (async () => {
    try {
      const url = SUPABASE_URL + "/rest/v1/portfolio_gallery?select=title,category,image_url,caption,project_slug&status=eq.PUBLISHED&order=created_at.desc&limit=500";
      const response = await fetch(url, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("Gallery request failed");
      const rows = await response.json();
      const unique = new Map();
      (Array.isArray(rows) ? rows : []).forEach(row => {
        if (typeof row.image_url === "string" && /^https:\/\//i.test(row.image_url) && !unique.has(row.image_url)) unique.set(row.image_url, row);
      });
      images = Array.from(unique.values());
      // Shuffle the complete published portfolio so every project gets a fair turn.
      for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
      }
      if (!images.length) {
        grid.innerHTML = '<p class="home-gallery-status">Our public gallery is being refreshed. Visit the full project gallery to explore available photographs.</p>';
        counter.textContent = "Gallery updates";
        return;
      }
      render();
      start();
    } catch {
      grid.innerHTML = '<p class="home-gallery-status">The gallery is temporarily unavailable. Please visit the full project gallery to view published photographs.</p>';
      counter.textContent = "Gallery temporarily unavailable";
    }
  })();
})();

