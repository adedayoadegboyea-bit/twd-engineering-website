import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
import { prepareStaffPhoto } from './staff-photo.js?v=f2905aa9e086';

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const photos = db.storage.from('staff-photos');
const $ = id => document.getElementById(id);
const form = $('staffForm');
const controls = form.elements;
const recordFields = 'id,full_name,job_title,department,duties,photo_path,sort_order,is_published,updated_at';
let members = [];
let selected = null;
let newId = null;
let photoRemoved = false;
let previewObject = null;
let photoPreparation = null;
let preparedPhoto = null;
let previewVersion = 0;
let accessVersion = 0;
let activeUserId = null;
let authorized = false;
let busy = false;

function status(id, message, tone = '') {
  const line = $(id);
  line.textContent = message;
  line.dataset.tone = tone;
}

function button(label, handler, className) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'team-button' + (className ? ' ' + className : '');
  control.textContent = label;
  control.disabled = busy;
  control.addEventListener('click', handler);
  return control;
}

function displayMembers() {
  const list = $('staffAdminList');
  list.replaceChildren();
  const term = $('staffSearch').value.trim().toLowerCase();
  const visibility = $('staffFilter').value;
  const filtered = members.filter(row => {
    const matches = [row.full_name, row.job_title, row.department].some(value => value?.toLowerCase().includes(term));
    return matches && (visibility === 'all' || row.is_published === (visibility === 'published'));
  });
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.textContent = members.length ? 'No profiles match your filters.' : 'No team profiles yet. Add a member to get started.';
    list.append(empty);
    return;
  }
  for (const row of filtered) {
    const item = document.createElement('article');
    item.className = 'team-member';
    const title = document.createElement('h3');
    title.textContent = row.full_name;
    const summary = document.createElement('p');
    summary.textContent = [row.job_title, row.department].filter(Boolean).join(' · ');
    const badge = document.createElement('p');
    badge.className = 'team-badge' + (row.is_published ? ' published' : '');
    badge.textContent = row.is_published ? 'Published' : 'Draft';
    const actions = document.createElement('div');
    actions.className = 'team-actions';
    actions.append(
      button('Edit', () => openEditor(row)),
      button(row.is_published ? 'Unpublish' : 'Publish', () => changeVisibility(row)),
      button('Delete', () => deleteMember(row), 'team-danger')
    );
    for (const control of actions.children) control.setAttribute('aria-label', control.textContent + ' ' + row.full_name);
    item.append(title, summary, badge, actions);
    list.append(item);
  }
}

async function loadMembers(version = accessVersion) {
  const result = await db.from('staff_directory').select(recordFields)
    .order('sort_order').order('full_name').order('id');
  if (version !== accessVersion || !authorized) return false;
  if (result.error) {
    $('staffAdminList').textContent = 'The team list could not be loaded. Please refresh the page.';
    status('listMessage', result.error.message, 'error');
    return false;
  }
  members = result.data || [];
  displayMembers();
  return true;
}

function setBusy(value) {
  busy = value;
  for (const input of [...controls, $('newMember'), $('staffSearch'), $('staffFilter')]) {
    input.disabled = value;
  }
  for (const input of $('staffAdminList').querySelectorAll('button')) input.disabled = value;
  $('saveMember').disabled = value || photoPreparation !== null;
}

function clearPhotoPreview() {
  previewVersion++;
  photoPreparation?.abort();
  photoPreparation = null;
  preparedPhoto = null;
  $('saveMember').disabled = busy;
  if (previewObject) URL.revokeObjectURL(previewObject);
  previewObject = null;
  $('staffPhotoImage').removeAttribute('src');
  $('staffPhotoPreview').hidden = true;
  $('removePortrait').hidden = true;
}

function showPreview(url) {
  $('staffPhotoImage').src = url;
  $('staffPhotoPreview').hidden = false;
  $('removePortrait').hidden = false;
}

async function previewSavedPhoto(path, version) {
  const result = await photos.createSignedUrl(path, 300);
  if (version !== previewVersion) return;
  $('removePortrait').hidden = false;
  if (result.data?.signedUrl) showPreview(result.data.signedUrl);
}

function openEditor(row = null, focus = true) {
  form.reset();
  selected = row;
  newId = null;
  photoRemoved = false;
  clearPhotoPreview();
  $('staffEditorTitle').textContent = row ? 'Edit ' + row.full_name : 'Add a team member';
  status('adminMessage', '');
  if (row) {
    for (const key of ['full_name', 'job_title', 'department', 'duties', 'sort_order']) {
      controls[key].value = row[key] ?? '';
    }
    controls.is_published.value = row.is_published ? 'published' : 'draft';
    if (row.photo_path) previewSavedPhoto(row.photo_path, previewVersion);
  }
  if (focus) $('staffEditorTitle').focus();
}

function resetAccess() {
  authorized = false;
  activeUserId = null;
  members = [];
  $('editorPanel').hidden = true;
  $('loginPanel').hidden = false;
  $('staffAdminList').replaceChildren();
  status('listMessage', '');
  openEditor(null, false);
  setBusy(false);
}

async function checkAccess() {
  const version = ++accessVersion;
  resetAccess();
  $('logout').hidden = true;
  try {
    const { data, error } = await db.auth.getUser();
    if (version !== accessVersion) return;
    if (!data?.user) {
      status('loginStatus', error && error.name !== 'AuthSessionMissingError' ? error.message : '', error ? 'error' : '');
      return;
    }
    activeUserId = data.user.id;
    $('logout').hidden = false;
    const result = await db.rpc('is_staff_directory_admin');
    if (version !== accessVersion) return;
    if (result.error) {
      const missing = ['PGRST202', 'PGRST205', '42883'].includes(result.error.code);
      status('loginStatus', missing
        ? 'The Company Team database setup is still pending. An administrator needs to run the team setup in Supabase.'
        : 'Could not verify team access. Please try again.', 'error');
      return;
    }
    if (result.data !== true) {
      status('loginStatus', 'This account does not have permission to manage Company Team.', 'error');
      return;
    }
    authorized = true;
    $('editorPanel').hidden = false;
    $('loginPanel').hidden = true;
    await loadMembers(version);
  } catch {
    if (version === accessVersion) status('loginStatus', 'Could not connect to the team manager. Please try again.', 'error');
  }
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const login = event.currentTarget;
  const loginButton = $('loginButton');
  loginButton.disabled = true;
  status('loginStatus', 'Signing in…');
  try {
    const { error } = await db.auth.signInWithPassword({
      email: login.elements.email.value.trim(), password: login.elements.password.value
    });
    if (error) { status('loginStatus', error.message, 'error'); return; }
    login.elements.password.value = '';
    await checkAccess();
  } catch {
    status('loginStatus', 'Could not sign in. Please try again.', 'error');
  } finally {
    loginButton.disabled = false;
  }
});

$('logout').addEventListener('click', async () => {
  accessVersion++;
  resetAccess();
  $('logout').hidden = true;
  const { error } = await db.auth.signOut();
  if (error) status('loginStatus', 'Sign-out could not be confirmed. Reload the page to check your session.', 'error');
});

db.auth.onAuthStateChange((event, session) => {
  if (event !== 'SIGNED_OUT' && !(activeUserId && session?.user?.id && session.user.id !== activeUserId)) return;
  accessVersion++;
  resetAccess();
  $('logout').hidden = true;
  status('loginStatus', '');
  if (event !== 'SIGNED_OUT') setTimeout(checkAccess, 0);
});

$('newMember').addEventListener('click', () => openEditor());
$('clearMember').addEventListener('click', () => openEditor());
$('staffSearch').addEventListener('input', displayMembers);
$('staffFilter').addEventListener('change', displayMembers);

controls.photo.addEventListener('change', async () => {
  const file = controls.photo.files[0];
  clearPhotoPreview();
  const version = previewVersion;
  if (!file) {
    if (selected?.photo_path && !photoRemoved) previewSavedPhoto(selected.photo_path, version);
    return;
  }
  const preparation = photoPreparation = new AbortController();
  $('saveMember').disabled = true;
  status('adminMessage', 'Preparing your photo…');
  try {
    const portrait = await prepareStaffPhoto(file, preparation.signal);
    if (version !== previewVersion) return;
    preparedPhoto = portrait;
    photoRemoved = false;
    previewObject = URL.createObjectURL(portrait);
    showPreview(previewObject);
    status('adminMessage', 'Photo ready. Save the profile to upload it.', 'success');
  } catch (error) {
    if (version !== previewVersion) return;
    controls.photo.value = '';
    if (selected?.photo_path && !photoRemoved) previewSavedPhoto(selected.photo_path, version);
    status('adminMessage', error.message || 'Could not prepare this photo.', 'error');
  } finally {
    if (version === previewVersion) {
      photoPreparation = null;
      $('saveMember').disabled = busy;
    }
  }
});

$('removePortrait').addEventListener('click', () => {
  controls.photo.value = '';
  photoRemoved = true;
  clearPhotoPreview();
  status('adminMessage', 'The portrait will be removed when you save.');
});

$('staffPhotoImage').addEventListener('error', () => {
  $('staffPhotoPreview').hidden = true;
  $('removePortrait').hidden = !(selected?.photo_path || controls.photo.files[0]);
});

function currentRecord(row, request) {
  return request.eq('id', row.id).eq('updated_at', row.updated_at);
}

async function removePhotoIfUnused(path) {
  if (!path) return;
  try {
    const { data, error } = await db.from('staff_directory').select('id').eq('photo_path', path).limit(1);
    if (!error && data?.length === 0) await photos.remove([path]);
  } catch {
    // Cleanup is optional after a confirmed profile save.
  }
}

async function withChange(progress, operation, messageId = 'adminMessage') {
  if (!authorized || busy) return;
  const version = accessVersion;
  setBusy(true);
  status(messageId, progress);
  try {
    await operation(version);
  } catch (error) {
    if (version === accessVersion) status(messageId, error.message || 'Could not update the profile.', 'error');
  } finally {
    if (version === accessVersion) setBusy(false);
  }
}

async function changeVisibility(row) {
  await withChange(row.is_published ? 'Unpublishing profile…' : 'Publishing profile…', async version => {
    const result = await currentRecord(row, db.from('staff_directory').update({
      is_published: !row.is_published
    })).select('id,is_published,updated_at').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      await loadMembers(version);
      throw new Error('This profile changed. Select it again from the updated list.');
    }
    if (version !== accessVersion) return;
    if (selected?.id === row.id) {
      selected = { ...selected, ...result.data };
      controls.is_published.value = result.data.is_published ? 'published' : 'draft';
    }
    status('listMessage', result.data.is_published ? 'Profile published on About Us.' : 'Profile moved to drafts.', 'success');
    await loadMembers(version);
  }, 'listMessage');
}

async function deleteMember(row) {
  if (busy || !authorized || !window.confirm('Permanently delete the profile for ' + row.full_name + '? To hide it instead, choose Unpublish.')) return;
  await withChange('Deleting profile…', async version => {
    const result = await currentRecord(row, db.from('staff_directory').delete()).select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      await loadMembers(version);
      throw new Error('This profile changed. Select it again from the updated list.');
    }
    if (version !== accessVersion) return;
    if (selected?.id === row.id) openEditor(null, false);
    status('listMessage', 'Team profile deleted.', 'success');
    await removePhotoIfUnused(row.photo_path);
    await loadMembers(version);
  }, 'listMessage');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!authorized || busy) return;
  const row = selected;
  const file = preparedPhoto;
  const payload = {
    full_name: controls.full_name.value.trim(),
    job_title: controls.job_title.value.trim(),
    department: controls.department.value.trim() || null,
    duties: controls.duties.value.trim(),
    sort_order: Number(controls.sort_order.value),
    is_published: controls.is_published.value === 'published'
  };
  if (payload.full_name.length < 2 || payload.job_title.length < 2 || payload.duties.length < 5) {
    status('adminMessage', 'Enter a name, position, and at least five characters describing the duties.', 'error');
    return;
  }
  if (!Number.isInteger(payload.sort_order) || payload.sort_order < 0 || payload.sort_order > 9999) {
    status('adminMessage', 'Enter a whole number from 0 to 9999 for display order.', 'error');
    return;
  }
  if (photoPreparation || (controls.photo.files.length && !file)) {
    status('adminMessage', 'Wait for the photo preview before saving.', 'error');
    return;
  }
  await withChange('Saving team profile…', async version => {
    let uploadedPath = null;
    if (file) {
      uploadedPath = 'team/' + crypto.randomUUID() + '.jpg';
      const upload = await photos.upload(uploadedPath, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error('Photo upload failed. ' + upload.error.message);
    }
    if (version !== accessVersion) return;
    payload.photo_path = uploadedPath ?? (photoRemoved ? null : row?.photo_path ?? null);
    if (!row) newId ||= crypto.randomUUID();
    const write = row ? currentRecord(row, db.from('staff_directory').update(payload))
      : db.from('staff_directory').insert({ id: newId, ...payload });
    const result = await write.select('id').maybeSingle();

    if (result.error || !result.data) {
      if (uploadedPath) await removePhotoIfUnused(uploadedPath);
      if (!result.error) {
        await loadMembers(version);
        throw new Error('This profile was edited elsewhere. Open its latest version from the list.');
      }
      throw result.error;
    }
    if (version !== accessVersion) return;
    openEditor(null, false);
    status('adminMessage', payload.is_published ? 'Profile published on About Us.' : 'Profile saved as a draft.', 'success');
    if (row?.photo_path !== payload.photo_path) await removePhotoIfUnused(row?.photo_path);
    await loadMembers(version);
  });
});

$('loginButton').disabled = false;
await checkAccess();
