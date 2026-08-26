import { getStore } from '@netlify/blobs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 5,
  enableKeepAlive: true
});

const uploads = getStore('portfolio-uploads');
const SESSION_COOKIE = 'portfolio_admin';
const SESSION_TTL = 1000 * 60 * 60 * 8;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});
const text = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const cookieHeader = (value, maxAge = 0) => `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'change-this-secret').update(value).digest('base64url');
}
function createSession(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function sessionEmail(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const [payload, signature] = match[1].split('.');
  if (!payload || !signature) return null; const expected = sign(payload); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data.email : null;
  } catch { return null; }
}
function requireAuth(request) {
  const email = sessionEmail(request);
  if (!email) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return email;
}
function cleanName(value) { return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-180); }
function isRemote(value) { return /^https?:\/\//i.test(String(value || '')); }
function mediaUrl(key) { return `/api/media/${encodeURIComponent(key)}`; }
function localUrl(value) { return value ? (isRemote(value) ? value : String(value).startsWith('/api/media/') ? value : `/uploads/${encodeURIComponent(String(value).replace(/^.*[\\/]/, ''))}`) : ''; }
function storedUrl(value) { return value ? (isRemote(value) ? value : String(value).startsWith('/api/media/') ? value : `/uploads/${String(value).replace(/^.*[\\/]/, '')}`) : ''; }

async function ensureSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS admins (id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(255) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.query(`CREATE TABLE IF NOT EXISTS site_content (id INT PRIMARY KEY,name VARCHAR(255) NOT NULL,headline VARCHAR(255) NOT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  const siteCols = [
    ['intro', 'LONGTEXT NULL'], ['about_title', 'VARCHAR(255) NULL'], ['about_text', 'LONGTEXT NULL'], ['what_i_do', 'LONGTEXT NULL'], ['goals', 'LONGTEXT NULL'], ['email', 'VARCHAR(255) NULL'], ['github', 'VARCHAR(500) NULL'], ['location', 'VARCHAR(255) NULL'], ['profile_image', 'VARCHAR(1000) NULL'], ['resume_file', 'VARCHAR(1000) NULL'], ['profile_image_url', 'VARCHAR(1000) NULL'], ['resume_url', 'VARCHAR(1000) NULL'], ['hero_typed', 'TEXT NULL'], ['hero_image', 'VARCHAR(1000) NULL'], ['about_image', 'VARCHAR(1000) NULL'], ['footer_description', 'LONGTEXT NULL'],
  ];
  for (const [c, d] of siteCols) await addColumn('site_content', c, d);
  const tables = {
    skills: [['category', "VARCHAR(100) NOT NULL DEFAULT 'Other'"], ['title', 'VARCHAR(255) NULL'], ['description', 'TEXT NULL'], ['icon_file', 'VARCHAR(1000) NULL'], ['icon_url', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']],
    projects: [['title', 'VARCHAR(255) NULL'], ['description', 'LONGTEXT NULL'], ['icon_file', 'VARCHAR(1000) NULL'], ['icon_url', 'VARCHAR(1000) NULL'], ['image_url', 'VARCHAR(1000) NULL'], ['project_file', 'VARCHAR(1000) NULL'], ['project_url', 'VARCHAR(1000) NULL'], ['github_url', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']],
    experiences: [['role', 'VARCHAR(255) NULL'], ['title', 'VARCHAR(255) NULL'], ['company', 'VARCHAR(255) NULL'], ['logo_image', 'VARCHAR(1000) NULL'], ['description', 'LONGTEXT NULL'], ['start_date', 'VARCHAR(100) NULL'], ['end_date', 'VARCHAR(100) NULL'], ['duration', 'VARCHAR(150) NULL'], ['location', 'VARCHAR(255) NULL'], ['url', 'VARCHAR(1000) NULL'], ['offer_letter_url', 'VARCHAR(1000) NULL'], ['offer_letter_file', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']],
    certificates: [['title', 'VARCHAR(255) NULL'], ['issuer', 'VARCHAR(255) NULL'], ['description', 'LONGTEXT NULL'], ['issue_date', 'VARCHAR(100) NULL'], ['credential_id', 'VARCHAR(255) NULL'], ['credential_url', 'VARCHAR(1000) NULL'], ['certificate_image', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']],
    education: [['institution', 'VARCHAR(255) NULL'], ['logo_image', 'VARCHAR(1000) NULL'], ['discipline', 'VARCHAR(255) NULL'], ['domain_name', 'VARCHAR(255) NULL'], ['branch', 'VARCHAR(255) NULL'], ['stream', 'VARCHAR(255) NULL'], ['start_date', 'VARCHAR(100) NULL'], ['end_date', 'VARCHAR(100) NULL'], ['duration', 'VARCHAR(150) NULL'], ['description', 'LONGTEXT NULL'], ['url', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']]
  };
  for (const [table, cols] of Object.entries(tables)) {
    const idDef = 'id INT AUTO_INCREMENT PRIMARY KEY';
    await db.query(`CREATE TABLE IF NOT EXISTS ${table} (${idDef})`);
    for (const [c, d] of cols) await addColumn(table, c, d);
  }
  await db.query(`UPDATE skills SET category = CASE
    WHEN LOWER(title) IN ('c','c++','cpp','java','python','javascript','typescript','php','go','rust','kotlin','swift','html','css') THEN 'Languages'
    WHEN LOWER(title) LIKE '%sql%' OR LOWER(title) LIKE '%mysql%' OR LOWER(title) LIKE '%postgres%' OR LOWER(title) LIKE '%mongodb%' OR LOWER(title) LIKE '%database%' THEN 'Databases'
    WHEN LOWER(title) LIKE '%react%' OR LOWER(title) LIKE '%node%' OR LOWER(title) LIKE '%express%' OR LOWER(title) LIKE '%next%' OR LOWER(title) LIKE '%django%' OR LOWER(title) LIKE '%spring%' THEN 'Frameworks'
    WHEN LOWER(title) LIKE '%git%' OR LOWER(title) LIKE '%docker%' OR LOWER(title) LIKE '%linux%' OR LOWER(title) LIKE '%aws%' OR LOWER(title) LIKE '%netlify%' THEN 'Tools & Platforms'
    ELSE COALESCE(NULLIF(TRIM(category), ''), 'Other')
  END
  WHERE category='Other' OR category IS NULL OR TRIM(category)='';`);

  // Existing databases may have older NOT NULL URL columns without defaults.
  // New blank Skill/Project records must be allowed to insert empty values.
  for (const [table, columns] of Object.entries({
    skills: ['icon_url'],
    projects: ['icon_url', 'image_url', 'project_url', 'github_url', 'project_file']
  })) {
    for (const column of columns) {
      await db.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(1000) NULL DEFAULT NULL`);
    }
  }
  const [[admin]] = await db.query('SELECT id FROM admins LIMIT 1');
  if (!admin && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await db.query('INSERT INTO admins (email,password_hash) VALUES (?,?)', [process.env.ADMIN_EMAIL, hash]);
  }
  const [[site]] = await db.query('SELECT id FROM site_content WHERE id=1 LIMIT 1');
  if (!site) await db.query('INSERT INTO site_content (id,name,headline) VALUES (1,?,?)', ['Shivam Sharma', 'Web Developer & C++ Programmer']);
}
let schemaPromise;
function readySchema() { return schemaPromise ||= ensureSchema(); }
async function addColumn(table, column, definition) {
  const [rows] = await db.query(`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`, [table, column]);
  if (!rows[0].n) await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function uploadFile(file, folder = 'media') {
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`File is too large. Maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
  if (!allowed.has(file.type)) throw new Error('Unsupported upload type. Use JPG, PNG, WEBP, GIF, or PDF.');
  const ext = cleanName(file.name).split('.').pop()?.toLowerCase() || 'bin';
  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await uploads.set(key, new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' }), {
    metadata: { contentType: file.type || 'application/octet-stream', fileName: cleanName(file.name) }
  });
  return mediaUrl(key);
}
async function deleteMedia(value) {
  const match = String(value || '').match(/^\/api\/media\/(.+)$/);
  if (match) await uploads.delete(decodeURIComponent(match[1])).catch(() => { });
}

function fieldMap(form) { const out = {}; for (const [k, v] of form.entries()) if (!(v instanceof File)) out[k] = v; return out; }
async function getSite() { const [[row]] = await db.query('SELECT * FROM site_content WHERE id=1 LIMIT 1'); return row || {}; }
async function publicData() {
  const site = await getSite();
  const [[skills], [projects], [experiences], [certificates], [education]] = await Promise.all([
    db.query('SELECT * FROM skills ORDER BY sort_order,id'), db.query('SELECT * FROM projects ORDER BY sort_order,id'), db.query('SELECT * FROM experiences ORDER BY sort_order,id'), db.query('SELECT * FROM certificates ORDER BY sort_order,id'), db.query('SELECT * FROM education ORDER BY sort_order,id')
  ]);
  return {
    site: { ...site, profile_image: site.profile_image_url || storedUrl(site.profile_image), resume_file: site.resume_url || storedUrl(site.resume_file), hero_image: storedUrl(site.hero_image), about_image: storedUrl(site.about_image) },
    skills: skills.map(x => ({ ...x, icon_file: x.icon_url || storedUrl(x.icon_file) })),
    projects: projects.map(x => ({ ...x, icon_file: x.image_url || x.icon_url || storedUrl(x.icon_file), project_file: x.project_url || storedUrl(x.project_file), github_url: x.github_url || x.project_url || '' })),
    experiences: experiences.map(x => ({ ...x, logo_image: storedUrl(x.logo_image), offer_letter_file: storedUrl(x.offer_letter_file), offer_letter_url: x.offer_letter_url || '' })),
    certificates: certificates.map(x => ({ ...x, certificate_image: storedUrl(x.certificate_image) })),
    education: education.map(x => ({ ...x, logo_image: storedUrl(x.logo_image) }))
  };
}
async function adminData() {
  const site = await getSite();
  const [[skills], [projects], [experiences], [certificates], [education]] = await Promise.all([
    db.query('SELECT * FROM skills ORDER BY sort_order,id'), db.query('SELECT * FROM projects ORDER BY sort_order,id'), db.query('SELECT * FROM experiences ORDER BY sort_order,id'), db.query('SELECT * FROM certificates ORDER BY sort_order,id'), db.query('SELECT * FROM education ORDER BY sort_order,id')
  ]);
  return { site, skills, projects, experiences, certificates, education };
}

async function saveRow(table, id, values) {
  const allowed = new Set((await db.query(`SHOW COLUMNS FROM \`${table}\``))[0].map(x => x.Field));
  const entries = Object.entries(values).filter(([k]) => allowed.has(k));
  if (!entries.length) throw new Error(`No compatible fields found in ${table}.`);
  if (id) {
    await db.query(`UPDATE \`${table}\` SET ${entries.map(([k]) => `\`${k}\`=?`).join(',')} WHERE id=?`, [...entries.map(([, v]) => v), id]);
  } else {
    const [r] = await db.query(`INSERT INTO \`${table}\` (${entries.map(([k]) => `\`${k}\``).join(',')}) VALUES (${entries.map(() => '?').join(',')})`, entries.map(([, v]) => v));
    return r.insertId;
  }
  return id;
}

async function handleSite(request) {
  requireAuth(request); const form = await request.formData(); const f = fieldMap(form); const current = await getSite();
  if (!String(f.name || current.name || '').trim() || !String(f.headline || current.headline || '').trim()) throw Object.assign(new Error('Name and headline are required.'), { status: 400 });
  const values = { name: String(f.name || current.name).trim(), headline: String(f.headline || current.headline).trim(), intro: f.intro || '', about_title: f.about_title || '', about_text: f.about_text || '', what_i_do: f.what_i_do || '', goals: f.goals || '', email: f.email || '', github: f.github || '', location: f.location || '', hero_typed: f.hero_typed || '', footer_description: f.footer_description || '' };
  for (const [field, urlField, folder] of [['profile_image', 'profile_image_url', 'profile'], ['hero_image', 'hero_image_url', 'hero']]) {
    const file = form.get(field); const uploaded = await uploadFile(file, folder); const remote = f[urlField] || '';
    if (uploaded) { await deleteMedia(current[field]); values[field] = uploaded; values[urlField] = ''; }
    else if (remote) { await deleteMedia(current[field]); values[field] = isRemote(remote) ? remote : null; values[urlField] = isRemote(remote) ? remote : ''; }
    else values[field] = current[field] || null;
  }
  const resume = form.get('resume_file'); const resumeUpload = await uploadFile(resume, 'resume'); const remoteResume = f.resume_url || '';
  if (resumeUpload) { await deleteMedia(current.resume_file); values.resume_file = resumeUpload; values.resume_url = ''; }
  else if (remoteResume) { await deleteMedia(current.resume_file); values.resume_file = isRemote(remoteResume) ? remoteResume : null; values.resume_url = isRemote(remoteResume) ? remoteResume : ''; }
  else values.resume_file = current.resume_file || null;
  await saveRow('site_content', 1, values); return json({ ok: true });
}

async function handleExperience(request) {
  requireAuth(request);
  const form = await request.formData();
  const f = fieldMap(form);
  const id = f.id ? Number(f.id) : null;
  if (!String(f.title || f.role || '').trim()) throw Object.assign(new Error('Experience title is required.'), { status: 400 });
  let current = {};
  if (id) {
    const [[row]] = await db.query('SELECT * FROM experiences WHERE id=? LIMIT 1', [id]);
    if (!row) throw Object.assign(new Error('Experience entry not found.'), { status: 404 });
    current = row;
  }
  const logo = await uploadFile(form.get('logo_image'), 'experiences');
  if (logo) { await deleteMedia(f.existing_logo_image || current.logo_image || ''); f.logo_image = logo; }
  else f.logo_image = f.existing_logo_image || current.logo_image || '';
  const offer = form.get('offer_letter_file');
  if (offer instanceof File && offer.size) {
    if (offer.type !== 'application/pdf' && !/\.pdf$/i.test(offer.name)) throw Object.assign(new Error('Offer letter must be a PDF file.'), { status: 400 });
    const uploaded = await uploadFile(offer, 'experiences/offer-letters');
    await deleteMedia(f.existing_offer_letter_file || current.offer_letter_file || '');
    f.offer_letter_file = uploaded;
  } else {
    f.offer_letter_file = f.existing_offer_letter_file || current.offer_letter_file || '';
  }
  f.role = String(f.title || f.role || '').trim();
  f.offer_letter_url = '';
  delete f.id; delete f.existing_logo_image; delete f.existing_offer_letter_file; delete f.logo_image_url;
  await saveRow('experiences', id, f);
  return json({ ok: true, id: Number(id || 0) });
}

async function handleEntity(request, table, fileField, folder, requiredField, extra = {}) {
  requireAuth(request); const form = await request.formData(); const f = fieldMap(form); const id = f.id ? Number(f.id) : null;
  if (!String(f[requiredField] || '').trim()) throw Object.assign(new Error(`${requiredField === 'institution' ? 'Institution' : requiredField[0].toUpperCase() + requiredField.slice(1)} is required.`), { status: 400 });
  let current = {}; if (id) { const [[row]] = await db.query(`SELECT * FROM \`${table}\` WHERE id=? LIMIT 1`, [id]); if (!row) throw Object.assign(new Error(`${table} entry not found.`), { status: 404 }); current = row; }
  const file = form.get(fileField); const uploaded = await uploadFile(file, folder); const old = f[`existing_${fileField}`] || current[fileField] || '';
  if (uploaded) { await deleteMedia(old); f[fileField] = uploaded; } else f[fileField] = old;
  Object.assign(f, extra);
  if (table === 'skills' && f.icon_url === undefined) f.icon_url = '';
  if (table === 'experiences') f.role = String(f.title || f.role || '').trim();
  delete f.id; delete f[`existing_${fileField}`];
  await saveRow(table, id, f); return json({ ok: true });
}

async function handleProject(request) {
  requireAuth(request);
  const form = await request.formData();
  const f = fieldMap(form);
  const id = f.id ? Number(f.id) : null;
  if (!String(f.title || '').trim()) throw Object.assign(new Error('Project title is required.'), { status: 400 });

  let current = {};
  if (id) {
    const [[row]] = await db.query('SELECT * FROM projects WHERE id=? LIMIT 1', [id]);
    if (!row) throw Object.assign(new Error('Project entry not found.'), { status: 404 });
    current = row;
  }

  // Project icon and project image are independent uploads.
  const icon = await uploadFile(form.get('icon_file'), 'projects/icons');
  const image = await uploadFile(form.get('image_file'), 'projects/images');

  if (icon) {
    await deleteMedia(f.existing_icon_file || current.icon_file || '');
    f.icon_file = icon;
    f.icon_url = '';
  } else {
    f.icon_file = current.icon_file || '';
  }

  if (image) {
    await deleteMedia(f.existing_image_url || current.image_url || '');
    f.image_url = image;
  } else if (f.image_url && isRemote(f.image_url)) {
    await deleteMedia(current.image_url || '');
  } else {
    f.image_url = current.image_url || '';
  }

  delete f.id;
  delete f.existing_icon_file;
  delete f.existing_image_url;
  delete f.image_file;

  // Keep optional project fields valid even when an older/cached admin.js sends no value.
  for (const key of ['description', 'icon_url', 'image_url', 'project_url', 'github_url', 'project_file', 'sort_order']) {
    if (f[key] === undefined || f[key] === null) f[key] = key === 'sort_order' ? 0 : '';
  }

  const savedId = await saveRow('projects', id, f);
  return json({ ok: true, id: Number(savedId || id || 0) });
}

async function main(request) {
  await readySchema();
  const url = new URL(request.url); let path = url.pathname.replace(/\/+$/, '');
  path = path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/';
  const method = request.method.toUpperCase();
  if (path === '/media' || path.startsWith('/media/')) {
    if (method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const key = decodeURIComponent(path.replace(/^\/media\//, '')); if (!key) return text('Not found', 404);
    const metadata = await uploads.getMetadata(key); if (!metadata) return text('Not found', 404);
    const body = await uploads.get(key, { type: 'arrayBuffer' }); if (body == null) return text('Not found', 404);
    return new Response(body, { headers: { 'content-type': metadata.metadata?.contentType || 'application/octet-stream', 'cache-control': 'public,max-age=31536000,immutable', 'x-content-type-options': 'nosniff' } });
  }
  if (path === '/session' && method === 'GET') return json({ authenticated: !!sessionEmail(request), email: sessionEmail(request) });
  if (path === '/login' && method === 'POST') {
    const { email, password } = await request.json();
    const [rows] = await db.query('SELECT * FROM admins WHERE email=? LIMIT 1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return json({ error: 'Invalid email or password' }, 401);
    return json({ ok: true, redirect: '/admin.html' }, 200, { 'set-cookie': cookieHeader(createSession(rows[0].email), SESSION_TTL / 1000) });
  }
  if (path === '/logout' && method === 'POST') return json({ ok: true, redirect: '/admin.html' }, 200, { 'set-cookie': cookieHeader('', 0) });
  if (path === '/public' && method === 'GET') return json(await publicData(), 200, { 'cache-control': 'public,max-age=30,stale-while-revalidate=300' });
  if (path === '/admin/data' && method === 'GET') { requireAuth(request); return json(await adminData()); }
  if (path === '/admin/site' && method === 'POST') return handleSite(request);
  if (path === '/admin/site-image' && method === 'DELETE') return json({ error: 'Use /api/admin/site-image/:field' }, 400);
  const siteDelete = path.match(/^\/admin\/site-image\/([^/]+)$/); if (siteDelete && method === 'DELETE') { requireAuth(request); const field = siteDelete[1]; if (!['profile_image', 'hero_image', 'about_image'].includes(field)) return json({ error: 'Invalid image field.' }, 400); const site = await getSite(); await deleteMedia(site[field]); await saveRow('site_content', 1, { [field]: null, [`${field}_url`]: '' }); return json({ ok: true }); }
  const entity = path.match(/^\/admin\/(skills|projects|experiences|certificates|education)(?:\/(\d+))?$/);
  if (entity) {
    const table = entity[1], id = entity[2] ? Number(entity[2]) : null;
    if (method === 'DELETE') { requireAuth(request); const [[row]] = await db.query(`SELECT * FROM \`${table}\` WHERE id=? LIMIT 1`, [id]); if (!row) return json({ error: 'Entry not found.' }, 404); for (const field of ['icon_file', 'logo_image', 'certificate_image', 'project_file', 'image_url', 'offer_letter_file']) if (row[field]) await deleteMedia(row[field]); await db.query(`DELETE FROM \`${table}\` WHERE id=?`, [id]); return json({ ok: true }); }
    if (method === 'POST') {
      if (table === 'skills') return handleEntity(request, table, 'icon_file', 'skills', 'title');
      if (table === 'projects') return handleProject(request);
      if (table === 'experiences') return handleExperience(request);
      if (table === 'certificates') return handleEntity(request, table, 'certificate_image', 'certificates', 'title');
      if (table === 'education') return handleEntity(request, table, 'logo_image', 'education', 'institution');
    }
  }
  return json({ error: 'Not found' }, 404);
}

export default async (request) => {
  try { return await main(request); }
  catch (error) { console.error('API error', error); return json({ error: error.message || 'Server error' }, error.status || 500); }
};

export const config = { path: ['/api/*', '/api', '/.netlify/functions/api/*'] };
