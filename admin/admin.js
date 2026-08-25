const $ = (s) => document.querySelector(s);
const state = { data: null };

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function field(label, name, value, type = 'text', full = false) {
  return `<label class="${full ? 'full' : ''}">${label}<${type === 'textarea' ? 'textarea' : 'input'} name="${name}" ${type !== 'textarea' ? `type="${type}"` : ''}>${type === 'textarea' ? escapeHtml(value) : ''}${type !== 'textarea' ? `value="${escapeAttr(value)}"` : ''}</${type === 'textarea' ? 'textarea' : 'input'}></label>`;
}
function escapeHtml(v = '') { return String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(v = '') { return escapeHtml(v).replace(/"/g, '&quot;'); }
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }

async function boot() {
  const me = await api('/api/auth/me');
  if (!me.authenticated) return showLogin();
  showDashboard(me.email);
  await loadData();
}
function showLogin() { $('#login-view').hidden = false; $('#dashboard-view').hidden = true; }
function showDashboard(email) { $('#login-view').hidden = true; $('#dashboard-view').hidden = false; $('#admin-email').textContent = email; }

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#login-error').textContent = '';
  try { const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }) }); showDashboard(r.email); await loadData(); }
  catch (err) { $('#login-error').textContent = err.message; }
});
$('#logout').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.reload(); });

async function loadData() { state.data = await api('/api/content'); renderSite(); renderSkills(); renderProjects(); }
function renderSite() {
  const s = state.data.site; $('#site-form').innerHTML = [
    field('Full name', 'full_name', s.full_name), field('Headline', 'headline', s.headline), field('Hero subheadline', 'subheadline', s.subheadline), field('Email', 'email', s.email, 'email'), field('GitHub URL', 'github', s.github), field('Location', 'location', s.location), field('Resume URL', 'resume_url', s.resume_url), field('Profile image URL', 'profile_image_url', s.profile_image_url), field('Intro', 'intro', s.intro, 'textarea', true), field('About title', 'about_title', s.about_title), field('About text', 'about_text', s.about_text, 'textarea', true), field('What I Do', 'what_i_do', s.what_i_do, 'textarea', true), field('Goals', 'goals', s.goals, 'textarea', true)
  ].join('');
}
$('#save-site').addEventListener('click', async () => { try { await api('/api/site', { method: 'PUT', body: JSON.stringify(formObject($('#site-form'))) }); toast('Portfolio content saved.'); await loadData(); } catch (e) { toast(e.message, true); } });
function renderSkills() {
  const el = $('#skills-list'); if (!state.data.skills.length) { el.innerHTML = '<div class="empty">No skills yet.</div>'; return; } el.innerHTML = state.data.skills.map(s => `<form class="editor skill-editor" data-id="${s.id}"><div class="editor-grid">${field('Title', 'title', s.title)}${field('Icon URL', 'icon_url', s.icon_url)}${field('Description', 'description', s.description, 'textarea', true)}${field('Order', 'sort_order', s.sort_order, 'number')}</div><div class="editor-actions"><button type="button" data-delete-skill="${s.id}">Delete</button><button class="save">Save skill</button></div></form>`).join('');
  el.querySelectorAll('.skill-editor').forEach(f => f.addEventListener('submit', async e => { e.preventDefault(); try { await api(`/api/skills/${f.dataset.id}`, { method: 'PUT', body: JSON.stringify(formObject(f)) }); toast('Skill updated.'); await loadData(); } catch (x) { toast(x.message, true); } }));
  el.querySelectorAll('[data-delete-skill]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Delete this skill?')) return; await api(`/api/skills/${b.dataset.deleteSkill}`, { method: 'DELETE' }); await loadData(); }));
}
$('#add-skill').addEventListener('click', async () => { await api('/api/skills', { method: 'POST', body: JSON.stringify({ title: 'New Skill', description: 'Describe this skill.', icon_url: './public/icons/html.png', sort_order: 99 }) }); await loadData(); });
function renderProjects() {
  const el = $('#projects-list'); if (!state.data.projects.length) { el.innerHTML = '<div class="empty">No projects yet.</div>'; return; } el.innerHTML = state.data.projects.map(p => `<form class="editor project-editor" data-id="${p.id}"><div class="editor-grid">${field('Title', 'title', p.title)}${field('Image URL', 'image_url', p.image_url)}${field('Project URL', 'project_url', p.project_url)}${field('GitHub URL', 'github_url', p.github_url)}${field('Description', 'description', p.description, 'textarea', true)}${field('Order', 'sort_order', p.sort_order, 'number')}</div><div class="editor-actions"><button type="button" data-delete-project="${p.id}">Delete</button><button class="save">Save project</button></div></form>`).join('');
  el.querySelectorAll('.project-editor').forEach(f => f.addEventListener('submit', async e => { e.preventDefault(); try { await api(`/api/projects/${f.dataset.id}`, { method: 'PUT', body: JSON.stringify(formObject(f)) }); toast('Project updated.'); await loadData(); } catch (x) { toast(x.message, true); } }));
  el.querySelectorAll('[data-delete-project]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Delete this project?')) return; await api(`/api/projects/${b.dataset.deleteProject}`, { method: 'DELETE' }); await loadData(); }));
}
$('#add-project').addEventListener('click', async () => { await api('/api/projects', { method: 'POST', body: JSON.stringify({ title: 'New Project', description: 'Describe the project.', image_url: './public/icons/js.png', project_url: 'https://example.com', github_url: '', sort_order: 99 }) }); await loadData(); });
function toast(msg, error = false) { const el = $('#save-status'); el.innerHTML = `<div class="toast">${escapeHtml(msg)}</div>`; setTimeout(() => el.innerHTML = '', 2500); }
boot().catch(e => { console.error(e); showLogin(); $('#login-error').textContent = 'Backend is not configured or the database is unreachable.'; });
