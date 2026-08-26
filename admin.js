let data = { site: {}, skills: [], projects: [], experiences: [], certificates: [] };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Server returned an invalid response (${response.status}).`); }

  if (response.status === 401) {
    showLogin();
    throw new Error('Your session expired. Please log in again.');
  }
  if (!response.ok) throw new Error(json.error || `Request failed (${response.status}).`);
  return json;
}

function setStatus(element, message, ok = false) {
  if (!element) return;
  element.textContent = message;
  element.className = `status ${ok ? 'success' : 'error'}`;
}

function showLogin() {
  $('#dashboard')?.classList.add('hidden');
  $('#login')?.classList.remove('hidden');
}

function showDashboard() {
  $('#login')?.classList.add('hidden');
  $('#dashboard')?.classList.remove('hidden');
  load();
}

function asset(value) {
  if (!value) return '';
  if (/^(https?:\/\/|\/api\/media\/|data:|blob:)/i.test(String(value))) return String(value);
  if (String(value).startsWith('/uploads/')) return String(value);
  return `/uploads/${encodeURIComponent(String(value).replace(/^.*[\\/]/, ''))}`;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

async function start() {
  try {
    const session = await api('/api/session');
    if (session.authenticated) showDashboard();
    else showLogin();
  } catch (error) {
    setStatus($('#loginStatus'), error.message);
  }
}

$('#loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#loginBtn');
  button.disabled = true;
  button.textContent = 'Signing in…';
  setStatus($('#loginStatus'), '');

  try {
    const form = new FormData(event.currentTarget);
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form))
    });
    window.location.replace('/admin.html');
  } catch (error) {
    setStatus($('#loginStatus'), error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Login';
  }
});

$('#logout')?.addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); }
  catch (_) { }
  showLogin();
  $('#loginForm')?.reset();
});

async function load() {
  try {
    data = await api('/api/admin/data');
    const form = $('#siteForm');

    if (form) {
      Object.entries(data.site || {}).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if (field && field.type !== 'file') field.value = value ?? '';
      });
    }

    renderFilePreviews();
    bindImageInputPreviews();
    decorateLocks($('#siteForm'));
    renderSkills();
    renderProjects();
    renderExperiences();
    renderCertificates();
    renderEducation();
    setStatus($('#siteStatus'), '');
  } catch (error) {
    if (!error.message.includes('session expired')) setStatus($('#siteStatus'), error.message);
  }
}

function renderFilePreviews() {
  const site = data.site || {};
  const profile = $('#profilePreview');
  const hero = $('#heroPreview');
  const resume = $('#resumePreview');

  if (profile) {
    profile.innerHTML = site.profile_image
      ? `<div class="preview"><img src="${esc(asset(site.profile_image))}" alt="Current profile image"><span class="small">Current profile image</span><button type="button" class="danger deleteSiteImage" data-field="profile_image">Delete</button></div>`
      : '<p class="muted small">No profile image uploaded.</p>';
  }

  if (hero) {
    hero.innerHTML = site.hero_image ? `<div class="preview"><img src="${esc(asset(site.hero_image))}" alt="Current hero image"><span class="small">Current hero image</span><button type="button" class="danger deleteSiteImage" data-field="hero_image">Delete</button></div>` : '<p class="muted small">No hero image uploaded.</p>';
  }
  if (resume) {
    resume.innerHTML = site.resume_file
      ? `<div class="preview"><a href="${esc(asset(site.resume_file))}" target="_blank" rel="noopener noreferrer">View current resume</a></div>`
      : '<p class="muted small">No resume uploaded.</p>';
  }
}

$('#siteForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#siteSaveBtn');
  button.disabled = true;
  button.textContent = 'Saving…';

  try {
    await api('/api/admin/site', {
      method: 'POST',
      body: await formDataWithLockedFields(event.currentTarget)
    });
    setStatus($('#siteStatus'), 'Portfolio information saved successfully.', true);
    await load();
  } catch (error) {
    setStatus($('#siteStatus'), error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Save Portfolio Information';
  }
});

$('#reloadSite')?.addEventListener('click', load);

// Compress image files in the browser before they are uploaded. This keeps the
// original visual dimensions/quality for normal images and only reduces very
// large files. The database stores URLs/filenames; the compressed image is
// saved to the uploads folder by the server.
async function compressImageFile(file, options = {}) {
  if (!file || !file.type.startsWith('image/')) return file;
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
  const maxDimension = options.maxDimension ?? 2560;
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const mime = file.type === 'image/png' ? 'image/png' : 'image/webp';
  const quality = mime === 'image/png' ? undefined : 0.92;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
  if (!blob || blob.size >= file.size) return file;
  const ext = mime === 'image/png' ? '.png' : '.webp';
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}${ext}`, { type: mime, lastModified: Date.now() });
}

async function prepareImageFiles(formData) {
  const names = ['profile_image', 'hero_image', 'icon_file', 'image_file', 'certificate_image'];
  for (const name of names) {
    const file = formData.get(name);
    if (file instanceof File && file.size > 0 && file.type.startsWith('image/')) {
      formData.set(name, await compressImageFile(file));
    }
  }
  return formData;
}

function bindImageInputPreviews() {
  const pairs = [['profile_image', '#profilePreview'], ['hero_image', '#heroPreview']];
  for (const [name, target] of pairs) {
    const input = document.querySelector(`input[name="${name}"]`);
    const box = document.querySelector(target);
    if (!input || !box || input.dataset.previewReady === '1') continue;
    input.dataset.previewReady = '1';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      box.innerHTML = `<div class="preview"><img src="${url}" alt="Selected image preview"><span class="small">Ready to upload: ${esc(file.name)}</span></div>`;
    });
  }
}

document.addEventListener('change', event => {
  const input = event.target.closest('input[type="file"]');
  if (!input || !input.name) return;
  if (!['icon_file', 'image_file', 'certificate_image', 'logo_image'].includes(input.name)) return;
  const box = input.closest('.filebox');
  if (!box) return;
  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  let preview = box.querySelector('.upload-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'preview upload-preview';
    box.appendChild(preview);
  }
  preview.innerHTML = `<img src="${url}" alt="Selected image preview"><span class="small">Ready to upload: ${esc(file.name)}</span>`;
});

async function formDataWithLockedFields(form) {
  const locked = $$('input,textarea,select', form).map(field => ({ field, disabled: field.disabled }));
  locked.forEach(x => { if (x.field.disabled) x.field.disabled = false; });
  const fd = new FormData(form);
  locked.forEach(x => { x.field.disabled = x.disabled; });
  return prepareImageFiles(fd);
}

function decorateLocks(root = document) {
  $$('input:not([type="hidden"]):not([type="file"]), textarea, select', root).forEach(field => {
    if (field.dataset.lockReady === '1' || field.closest('#login')) return;
    field.dataset.lockReady = '1';
    const label = field.closest('div')?.querySelector(`label[for="${field.id}"]`) || field.parentElement?.querySelector(':scope > label');
    if (label && !label.querySelector('.lock-btn')) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'lock-btn'; button.textContent = '🔒';
      button.title = 'Unlock this field to edit';
      button.addEventListener('click', () => setFieldLocked(field, !field.disabled));
      label.classList.add('field-head'); label.appendChild(button);
    }
    setFieldLocked(field, true);
  });
}

function setFieldLocked(field, locked) {
  field.disabled = !!locked;
  field.classList.toggle('locked-field', !!locked);
  const button = field.closest('div')?.querySelector('.lock-btn');
  if (button) { button.textContent = locked ? '🔒' : '🔓'; button.title = locked ? 'Unlock this field to edit' : 'Lock this field'; }
}

function setAllFieldsLocked(locked) {
  $$('#dashboard input:not([type="hidden"]):not([type="file"]), #dashboard textarea, #dashboard select').forEach(field => setFieldLocked(field, locked));
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('.deleteSiteImage');
  if (!button) return;
  if (!confirm('Delete this previously uploaded image?')) return;
  button.disabled = true;
  try { await api(`/api/admin/site-image/${encodeURIComponent(button.dataset.field)}`, { method: 'DELETE' }); await load(); }
  catch (error) { alert(error.message); button.disabled = false; }
});

async function saveSiteOnly() {
  const form = $('#siteForm');
  if (!form) return;
  await api('/api/admin/site', { method: 'POST', body: await formDataWithLockedFields(form) });
}

async function saveSkillOnly(form) {
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const formData = await formDataWithLockedFields(form);
  formData.set('id', form.dataset.id);
  formData.set('existing_icon_file', skills.find(item => String(item.id) === String(form.dataset.id))?.icon_file || '');
  await api('/api/admin/skills', { method: 'POST', body: formData });
}

async function saveProjectOnly(form) {
  const formData = await formDataWithLockedFields(form);
  formData.set('id', form.dataset.id);
  const current = (data.projects || []).find(item => String(item.id) === String(form.dataset.id));
  formData.set('existing_icon_file', current?.icon_file || '');
  formData.set('existing_image_url', current?.image_url || '');
  await api('/api/admin/projects', { method: 'POST', body: formData });
}

async function saveAllData() {
  const button = $('#saveAllBtn');
  const status = $('#saveAllStatus');
  button.disabled = true; button.textContent = 'Saving All…';
  setStatus(status, '');
  try {
    await saveSiteOnly();
    for (const form of $$('.skillForm')) await saveSkillOnly(form);
    for (const form of $$('.projectForm')) await saveProjectOnly(form);
    for (const form of $$('.experienceForm')) await saveExperienceOnly(form);
    for (const form of $$('.certificateForm')) await saveCertificateOnly(form);
    for (const form of $$('.educationForm')) await saveEducationOnly(form);
    setStatus(status, 'All portfolio data saved successfully.', true);
    await load();
  } catch (error) {
    setStatus(status, `Save stopped: ${error.message}`);
  } finally { button.disabled = false; button.textContent = '💾 Save All Data'; }
}

function renderSkills() {
  const container = $('#skills');
  if (!container) return;

  const skills = Array.isArray(data.skills) ? data.skills : [];
  if (!skills.length) {
    container.innerHTML = '<p class="muted">No skills yet.</p>';
    return;
  }

  container.innerHTML = skills.map(skill => `
    <div class="item">
      <form class="skillForm" data-id="${esc(skill.id)}" enctype="multipart/form-data">
        <div class="grid">
          <div><label>Title</label><input name="title" value="${esc(skill.title)}" required></div>
          <div><label>Order</label><input name="sort_order" type="number" value="${esc(skill.sort_order ?? 0)}"></div>
          <div class="full"><label>Description</label><textarea name="description">${esc(skill.description || '')}</textarea></div>
          <div>
            <label>Skill Icon</label>
            <div class="filebox">
              <input name="icon_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
              <input name="icon_url" value="${esc(skill.icon_url || '')}" placeholder="Or paste icon URL" style="margin-top:8px">
              ${skill.icon_file ? `<div class="preview"><img src="${esc(asset(skill.icon_file))}" alt="Current icon"><span class="small">Current icon</span></div>` : ''}
            </div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button type="submit">Save Skill</button>
          <button type="button" class="danger delSkill" data-id="${esc(skill.id)}">Delete</button>
        </div>
        <p class="status skillStatus"></p>
      </form>
    </div>
  `).join('');

  decorateLocks(container);

  $$('.skillForm', container).forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = $('.skillStatus', form);
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      button.textContent = 'Saving…';

      try {
        const formData = await formDataWithLockedFields(form);
        formData.set('id', form.dataset.id);
        formData.set('existing_icon_file',
          skills.find(item => String(item.id) === String(form.dataset.id))?.icon_file || '');
        await api('/api/admin/skills', { method: 'POST', body: formData });
        setStatus(status, 'Skill saved successfully.', true);
        await load();
      } catch (error) {
        setStatus(status, error.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Save Skill';
      }
    });
  });

  $$('.delSkill', container).forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this skill?')) return;
      button.disabled = true;
      try {
        await api(`/api/admin/skills/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' });
        await load();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    });
  });
}

function renderProjects() {
  const container = $('#projects');
  if (!container) return;

  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (!projects.length) {
    container.innerHTML = '<p class="muted">No projects yet.</p>';
    return;
  }

  container.innerHTML = projects.map(project => `
    <div class="item">
      <form class="projectForm" data-id="${esc(project.id)}" enctype="multipart/form-data">
        <div class="grid">
          <div><label>Title</label><input name="title" value="${esc(project.title)}" required></div>
          <div><label>Order</label><input name="sort_order" type="number" value="${esc(project.sort_order ?? 0)}"></div>
          <div class="full"><label>Description</label><textarea name="description">${esc(project.description || '')}</textarea></div>
          <div>
            <label>Project Icon</label>
            <div class="filebox">
              <input name="icon_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
              <input name="icon_url" value="${esc(project.icon_url || '')}" placeholder="Icon URL (optional)" style="margin-top:8px">
              ${project.icon_file ? `<div class="preview"><img src="${esc(asset(project.icon_file))}" alt="Current project icon"><span class="small">Current icon</span></div>` : ''}
            </div>
          </div>
          <div>
            <label>Project Link</label>
            <input name="project_url" value="${esc(project.project_url || '')}" placeholder="https://example.com/project">
          </div>
          <div>
            <label>Project Image</label>
            <div class="filebox">
              <input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
              <input name="image_url" value="${esc(project.image_url || '')}" placeholder="Or paste image URL" style="margin-top:8px">
              ${project.image_url ? `<div class="preview"><img src="${esc(asset(project.image_url))}" alt="Current project image"><span class="small">Current project image</span></div>` : ''}
            </div>
          </div>
          <div>
            <label>GitHub URL <span class="muted small">(optional)</span></label>
            <input name="github_url" value="${esc(project.github_url || project.project_url || '')}" placeholder="https://github.com/username/repository">
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button type="submit">Save Project</button>
          <button type="button" class="danger delProject" data-id="${esc(project.id)}">Delete</button>
        </div>
        <p class="status projectStatus"></p>
      </form>
    </div>
  `).join('');

  decorateLocks(container);

  $$('.projectForm', container).forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = $('.projectStatus', form);
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      button.textContent = 'Saving…';

      try {
        const formData = await formDataWithLockedFields(form);
        formData.set('id', form.dataset.id);
        const current = projects.find(item => String(item.id) === String(form.dataset.id));
        formData.set('existing_icon_file', current?.icon_file || '');
        formData.set('existing_image_url', current?.image_url || '');
        await api('/api/admin/projects', { method: 'POST', body: formData });
        setStatus(status, 'Project saved successfully.', true);
        await load();
      } catch (error) {
        setStatus(status, error.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Save Project';
      }
    });
  });

  $$('.delProject', container).forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this project?')) return;
      button.disabled = true;
      try {
        await api(`/api/admin/projects/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' });
        await load();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    });
  });
}

async function saveExperienceOnly(form) {
  const fd = await formDataWithLockedFields(form);
  fd.set('id', form.dataset.id || '');
  await api('/api/admin/experiences', { method: 'POST', body: fd });
}

async function saveCertificateOnly(form) {
  const fd = await formDataWithLockedFields(form);
  fd.set('id', form.dataset.id || '');
  fd.set('existing_certificate_image', data.certificates.find(x => String(x.id) === String(form.dataset.id))?.certificate_image || '');
  await api('/api/admin/certificates', { method: 'POST', body: fd });
}

async function saveEducationOnly(form) {
  const fd = await formDataWithLockedFields(form);
  fd.set('id', form.dataset.id || '');
  fd.set('existing_logo_image', data.education.find(x => String(x.id) === String(form.dataset.id))?.logo_image || '');
  await api('/api/admin/education', { method: 'POST', body: fd });
}

function renderExperiences() {
  const c = $('#experiences');
  if (!c) return;
  const items = data.experiences || [];
  c.innerHTML = items.length ? items.map(x => `
    <div class="item">
      <form class="experienceForm" data-id="${esc(x.id)}" enctype="multipart/form-data">
        <div class="grid">
          <div><label>Experience Title</label><input name="title" value="${esc(x.title || x.role || '')}" required></div>
          <div><label>Company</label><input name="company" value="${esc(x.company || '')}"></div>
          <div><label>Duration</label><input name="duration" value="${esc(x.duration || '')}" placeholder="Jun 2025 — Present"></div>
          <div><label>Start Date <span class="muted small">(optional)</span></label><input name="start_date" value="${esc(x.start_date || '')}"></div>
          <div><label>End Date <span class="muted small">(optional)</span></label><input name="end_date" value="${esc(x.end_date || '')}"></div>
          <div>
            <label>Company Logo <span class="muted small">(optional)</span></label>
            <div class="filebox">
              <input name="logo_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
              ${x.logo_image ? `<div class="preview"><img src="${esc(asset(x.logo_image))}" alt="Company logo"><span class="small">Current logo</span></div>` : ''}
            </div>
          </div>
          <div class="full"><label>Description</label><textarea name="description">${esc(x.description || '')}</textarea></div>
          <div><label>Location <span class="muted small">(optional)</span></label><input name="location" value="${esc(x.location || '')}"></div>
          <div><label>Website <span class="muted small">(optional)</span></label><input name="url" value="${esc(x.url || '')}" placeholder="https://..."></div>
          <div><label>Order</label><input name="sort_order" type="number" value="${esc(x.sort_order ?? 0)}"></div>
        </div>
        <div class="actions">
          <button type="submit">Save Experience</button>
          <button type="button" class="danger delExperience" data-id="${esc(x.id)}">Delete</button>
        </div>
        <p class="status experienceStatus"></p>
      </form>
    </div>
  `).join('') : '<p class="muted">No experience entries yet.</p>';

  decorateLocks(c);
  $$('.experienceForm', c).forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await saveExperienceOnly(f);
      setStatus($('.experienceStatus', f), 'Experience saved.', true);
      await load();
    } catch (err) {
      setStatus($('.experienceStatus', f), err.message);
    }
  }));
  $$('.delExperience', c).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this experience?')) return;
    try {
      await api(`/api/admin/experiences/${b.dataset.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }));
}

function renderCertificates() {
  const c = $('#certificates');
  if (!c) return;
  const items = data.certificates || [];
  c.innerHTML = items.length ? items.map(x => `
    <div class="item">
      <form class="certificateForm" data-id="${esc(x.id)}" enctype="multipart/form-data">
        <div class="grid">
          <div><label>Certificate Title</label><input name="title" value="${esc(x.title)}" required></div>
          <div><label>Issuer</label><input name="issuer" value="${esc(x.issuer || '')}"></div>
          <div class="full"><label>Description</label><textarea name="description">${esc(x.description || '')}</textarea></div>
          <div><label>Credential ID <span class="muted small">(optional)</span></label><input name="credential_id" value="${esc(x.credential_id || '')}"></div>
          <div><label>Credential URL <span class="muted small">(optional)</span></label><input name="credential_url" value="${esc(x.credential_url || '')}" placeholder="https://..."></div>
          <div>
            <label>Certificate Image <span class="muted small">(optional)</span></label>
            <input name="certificate_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
            ${x.certificate_image ? `<div class="preview"><img src="${esc(asset(x.certificate_image))}" alt="Certificate"><span class="small">Current certificate</span></div>` : ''}
          </div>
          <div><label>Issue Date <span class="muted small">(optional)</span></label><input name="issue_date" value="${esc(x.issue_date || '')}"></div>
          <div><label>Order</label><input name="sort_order" type="number" value="${esc(x.sort_order ?? 0)}"></div>
        </div>
        <div class="actions">
          <button type="submit">Save Certificate</button>
          <button type="button" class="danger delCertificate" data-id="${esc(x.id)}">Delete</button>
        </div>
        <p class="status certificateStatus"></p>
      </form>
    </div>
  `).join('') : '<p class="muted">No certificates yet.</p>';

  decorateLocks(c);
  $$('.certificateForm', c).forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await saveCertificateOnly(f);
      setStatus($('.certificateStatus', f), 'Certificate saved.', true);
      await load();
    } catch (err) {
      setStatus($('.certificateStatus', f), err.message);
    }
  }));
  $$('.delCertificate', c).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this certificate?')) return;
    try {
      await api(`/api/admin/certificates/${b.dataset.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }));
}

function renderEducation() {
  const c = $('#education');
  if (!c) return;
  const items = data.education || [];
  c.innerHTML = items.length ? items.map(x => `
    <div class="item">
      <form class="educationForm" data-id="${esc(x.id)}" enctype="multipart/form-data">
        <div class="grid">
          <div><label>School / College / University</label><input name="institution" value="${esc(x.institution || '')}" required></div>
          <div>
            <label>Logo Photo <span class="muted small">(optional)</span></label>
            <div class="filebox">
              <input name="logo_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
              ${x.logo_image ? `<div class="preview"><img src="${esc(asset(x.logo_image))}" alt="Institution logo"><span class="small">Current logo</span></div>` : ''}
            </div>
          </div>
          <div><label>Discipline</label><input name="discipline" value="${esc(x.discipline || '')}" placeholder="Computer Science"></div>
          <div><label>Domain</label><input name="domain_name" value="${esc(x.domain_name || '')}" placeholder="Technology"></div>
          <div><label>Branch</label><input name="branch" value="${esc(x.branch || '')}" placeholder="CSE"></div>
          <div><label>Stream</label><input name="stream" value="${esc(x.stream || '')}" placeholder="Science"></div>
          <div><label>Duration</label><input name="duration" value="${esc(x.duration || '')}" placeholder="2022 — 2026"></div>
          <div><label>Start Date <span class="muted small">(optional)</span></label><input name="start_date" value="${esc(x.start_date || '')}"></div>
          <div><label>End Date <span class="muted small">(optional)</span></label><input name="end_date" value="${esc(x.end_date || '')}"></div>
          <div><label>Website <span class="muted small">(optional)</span></label><input name="url" value="${esc(x.url || '')}" placeholder="https://..."></div>
          <div class="full"><label>Description <span class="muted small">(optional)</span></label><textarea name="description">${esc(x.description || '')}</textarea></div>
          <div><label>Order</label><input name="sort_order" type="number" value="${esc(x.sort_order ?? 0)}"></div>
        </div>
        <div class="actions">
          <button type="submit">Save Education</button>
          <button type="button" class="danger delEducation" data-id="${esc(x.id)}">Delete</button>
        </div>
        <p class="status educationStatus"></p>
      </form>
    </div>
  `).join('') : '<p class="muted">No education entries yet.</p>';

  decorateLocks(c);
  $$('.educationForm', c).forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await saveEducationOnly(f);
      setStatus($('.educationStatus', f), 'Education saved.', true);
      await load();
    } catch (err) {
      setStatus($('.educationStatus', f), err.message);
    }
  }));
  $$('.delEducation', c).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this education entry?')) return;
    try {
      await api(`/api/admin/education/${b.dataset.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }));
}

async function addEducation() {
  const b = $('#newEducation');
  b.disabled = true;
  try {
    const fd = new FormData();
    fd.set('institution', 'New Institution');
    fd.set('sort_order', String((data.education?.length || 0) + 1));
    await api('/api/admin/education', { method: 'POST', body: fd });
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    b.disabled = false;
  }
}

async function addExperience() {
  const b = $('#newExperience');
  b.disabled = true;
  try {
    const fd = new FormData();
    fd.set('title', 'New Experience');
    fd.set('sort_order', String((data.experiences?.length || 0) + 1));
    await api('/api/admin/experiences', { method: 'POST', body: fd });
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    b.disabled = false;
  }
}

async function addCertificate() {
  const b = $('#newCertificate');
  b.disabled = true;
  try {
    const fd = new FormData();
    fd.set('title', 'New Certificate');
    fd.set('sort_order', String((data.certificates?.length || 0) + 1));
    await api('/api/admin/certificates', { method: 'POST', body: fd });
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    b.disabled = false;
  }
}

async function addSkill() {
  const button = $('#newSkill');
  button.disabled = true;
  try {
    const formData = new FormData();
    formData.set('title', 'New Skill');
    formData.set('description', '');
    formData.set('icon_url', '');
    formData.set('icon_file', '');
    formData.set('sort_order', String((data.skills?.length || 0) + 1));
    await api('/api/admin/skills', { method: 'POST', body: formData });
    await load();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function addProject() {
  const button = $('#newProject');
  if (!button) return;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Adding…';
  try {
    const formData = new FormData();
    formData.set('title', 'New Project');
    formData.set('description', '');
    formData.set('icon_url', '');
    formData.set('icon_file', '');
    formData.set('image_url', '');
    formData.set('image_file', '');
    formData.set('project_url', '');
    formData.set('github_url', '');
    formData.set('project_file', '');
    formData.set('sort_order', String((data.projects?.length || 0) + 1));
    const result = await api('/api/admin/projects', { method: 'POST', body: formData });
    await load();
    // Put the newly created project in view on mobile and desktop.
    const projectsCard = $('#projectsCard');
    projectsCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (result?.id) {
      const created = document.querySelector(`.projectForm[data-id="${CSS.escape(String(result.id))}"]`);
      created?.querySelector('input[name="title"]')?.focus();
    }
  } catch (error) {
    alert(`Could not add project: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

$('#saveAllBtn')?.addEventListener('click', saveAllData);
$('#unlockAllBtn')?.addEventListener('click', () => setAllFieldsLocked(false));
$('#lockAllBtn')?.addEventListener('click', () => setAllFieldsLocked(true));

$('#newSkill')?.addEventListener('click', addSkill);
$('#newProject')?.addEventListener('click', addProject);
start();

$('#newExperience')?.addEventListener('click', addExperience);
$('#newCertificate')?.addEventListener('click', addCertificate);
$('#newEducation')?.addEventListener('click', addEducation);
