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
