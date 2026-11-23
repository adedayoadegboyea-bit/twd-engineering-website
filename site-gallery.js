import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

/* Shared portfolio ribbon: every public page takes turns showing the complete published photo collection. */
(() => {
  if (document.querySelector("[data-site-gallery-ribbon]")) return;
  const mount = document.createElement("section");
  mount.className = "site-gallery-ribbon";
  mount.dataset.siteGalleryRibbon = "";
  mount.setAttribute("aria-label", "TW&D project photographs");
  mount.innerHTML = '<div class="sgr-inner"><div class="sgr-heading"><div><span class="sgr-kicker">REAL PROJECTS · REAL PROGRESS</span><h2>More of our work</h2><p>Explore project photographs from across the TW&D portfolio.</p></div><a href="/projects.html#latest-gallery">View all projects →</a></div><div class="sgr-grid" data-sgr-grid aria-live="polite"><span class="sgr-loading">Loading project photographs…</span></div></div>';
  const footer = document.querySelector("footer");
  const main = document.querySelector("main");
  if (footer) footer.before(mount);
  else if (main) main.after(mount);
  else document.body.append(mount);
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/site-gallery.css?v=20261123-1";
  document.head.append(stylesheet);

  const grid = mount.querySelector("[data-sgr-grid]");
  let photos = [];
  let cursor = 0;
  const visibleCount = matchMedia("(max-width: 620px)").matches ? 2 : 4;

  function render() {
    if (!photos.length) return;
    const shown = [];
    for (let i = 0; i < Math.min(visibleCount, photos.length); i++) {
      shown.push(photos[(cursor + i) % photos.length]);
    }
    grid.replaceChildren();
    shown.forEach((photo, index) => {
      const card = document.createElement("a");
      card.className = "sgr-card";
      card.href = photo.image_url;
      card.target = "_blank";
      card.rel = "noopener";
      card.setAttribute("aria-label", "Open " + (photo.title || photo.caption || "TW&D project photograph"));
      const image = document.createElement("img");
      image.src = photo.image_url;
      image.alt = photo.title || photo.caption || "TW&D engineering and construction project";
      image.loading = index < 2 ? "eager" : "lazy";
      image.decoding = "async";
      const label = document.createElement("span");
      label.textContent = photo.title || photo.category || "TW&D project";
      card.append(image, label);
      grid.append(card);
    });
    cursor = (cursor + visibleCount) % photos.length;
  }

  (async () => {
    try {
      const url = SUPABASE_URL + "/rest/v1/portfolio_gallery?select=title,category,image_url,caption,project_slug&status=eq.PUBLISHED&order=created_at.desc&limit=500";
      const response = await fetch(url, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("Portfolio request failed");
      const rows = await response.json();
      const unique = new Map();
      (Array.isArray(rows) ? rows : []).forEach(row => {
        if (typeof row.image_url === "string" && /^https:\/\//i.test(row.image_url) && !unique.has(row.image_url)) unique.set(row.image_url, row);
      });
      photos = Array.from(unique.values());
      for (let i = photos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      if (!photos.length) {
        mount.hidden = true;
        return;
      }
      render();
      if (photos.length > visibleCount) {
        window.setInterval(() => {
          if (!document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches) render();
        }, 6500);
      }
    } catch {
      mount.hidden = true;
    }
  })();
})();
