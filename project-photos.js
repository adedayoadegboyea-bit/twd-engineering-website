import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const section = document.querySelector("[data-project-photos]");
const title = document.getElementById("project-title");
const slug = section.dataset.projectPhotos;
const id = new URLSearchParams(location.search).get("id");

function showPhotos(rows, label) {
  const grid = section.querySelector("[data-photo-grid]");
  const seen = new Set();
  for (const row of rows) {
    if (!/^https:\/\//i.test(row.image_url || "") || seen.has(row.image_url)) continue;
    seen.add(row.image_url);
    const figure = document.createElement("figure");
    const link = document.createElement("a");
    link.href = row.image_url;
    link.target = "_blank";
    link.rel = "noopener";
    const image = document.createElement("img");
    image.src = row.image_url;
    image.alt = row.caption || label;
    image.loading = "lazy";
    link.append(image);
    figure.append(link);
    if (row.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = row.caption;
      figure.append(caption);
    }
    grid.append(figure);
  }
  section.hidden = !seen.size;
}

async function loadProject() {
  if (slug) {
    const photos = await db.from("portfolio_gallery").select("image_url,caption")
      .eq("project_slug", slug).eq("status", "PUBLISHED")
      .order("sort_order").order("created_at", {ascending: false});
    if (photos.error) throw photos.error;
    showPhotos(photos.data, document.title.split("|")[0].trim());
    return;
  }

  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id || "")) {
    title.textContent = "Project not found";
    return;
  }
  const result = await db.from("portfolio_projects").select("title,state,location,category,description,cover_image_url")
    .eq("id", id).eq("status", "PUBLISHED").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    title.textContent = "Project not found";
    return;
  }
  const project = result.data;
  title.textContent = project.title;
  document.title = project.title + " | TW&D Engineering";
  document.getElementById("project-location").textContent = project.location || project.state || "";
  document.getElementById("project-description").textContent = project.description || "";
  document.getElementById("project-overview").hidden = !project.description;
  document.getElementById("project-category").textContent = project.category || "";
  document.getElementById("project-meta").hidden = !project.category;
  const photos = await db.from("portfolio_project_images").select("image_url,caption")
    .eq("project_id", id).order("sort_order").order("created_at");
  if (photos.error) throw photos.error;
  const rows = photos.data.length ? photos.data : [{image_url: project.cover_image_url}];
  showPhotos(rows, project.title);
}

loadProject().catch(() => {
  if (title && title.textContent === "Loading project…") title.textContent = "Project temporarily unavailable";
  else {
    section.hidden = false;
    section.querySelector("[data-photo-grid]").textContent = "Project photographs are temporarily unavailable.";
  }
});
