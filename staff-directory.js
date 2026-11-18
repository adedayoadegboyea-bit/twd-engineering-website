import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const grid = document.getElementById('staffDirectory');
const status = document.getElementById('staffDirectoryStatus');

function profileCard(member) {
  const card = document.createElement('article');
  card.className = 'staff-card';
  const photo = document.createElement('div');
  photo.className = 'staff-portrait';
  const initials = document.createElement('span');
  initials.textContent = member.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  initials.setAttribute('aria-hidden', 'true');
  photo.append(initials);

  const body = document.createElement('div');
  body.className = 'staff-card-body';
  for (const [tag, value, className] of [
    ['h3', member.full_name], ['span', member.job_title, 'staff-role'],
    ['span', member.department, 'staff-department'], ['p', member.duties]
  ]) {
    if (!value) continue;
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value;
    body.append(el);
  }
  card.append(photo, body);
  return { card, photo, initials };
}

async function loadDirectory() {
  try {
    const { data, error } = await db.from('staff_directory')
      .select('full_name,job_title,department,duties,photo_path')
      .eq('is_published', true).order('sort_order').order('full_name');
    if (error) throw error;
    if (!data.length) {
      status.textContent = 'Team profiles will appear here as they are published.';
      return;
    }

    const cards = data.map(member => ({ member, ...profileCard(member) }));
    grid.replaceChildren(...cards.map(({ card }) => card));
    status.hidden = true;
    const paths = [...new Set(data.map(member => member.photo_path).filter(Boolean))];
    if (!paths.length) return;
    const result = await db.storage.from('staff-photos').createSignedUrls(paths, 300);
    if (result.error || !result.data) return;
    const urls = new Map(result.data.filter(item => !item.error && item.signedUrl).map(item => [item.path, item.signedUrl]));
    for (const { member, photo, initials } of cards) {
      const url = urls.get(member.photo_path);
      if (!url) continue;
      const img = document.createElement('img');
      img.alt = 'Portrait of ' + member.full_name;
      img.decoding = 'async';
      img.addEventListener('load', () => { initials.hidden = true; }, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.src = url;
      photo.append(img);
    }
  } catch (error) {
    status.textContent = ['PGRST205', '42P01'].includes(error?.code)
      ? 'Team profiles will appear here as they are published.'
      : 'Team profiles could not be loaded right now. Please refresh to try again.';
  }
}

if (grid && status) await loadDirectory();
