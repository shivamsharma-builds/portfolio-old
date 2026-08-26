require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(ROOT, { index: 'index.html' }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif|pdf|zip|doc|docx|txt)$/i.test(file.originalname);
    cb(allowed ? null : new Error('Only image files and PDF files are allowed.'), allowed);
  }
});

function auth(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function isRemote(value) { return /^https?:\/\//i.test(String(value || '')); }
function fileUrl(file) { return file ? (isRemote(file) ? file : `/uploads/${path.basename(file)}`) : ''; }
function cleanFileName(value) { return value ? path.basename(value) : null; }

async function tableColumns(table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, DATA_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`, [table]
  );
  return rows;
}

function colMap(columns) {
  return new Map(columns.map(c => [String(c.COLUMN_NAME).toLowerCase(), c]));
}

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!rows[0].count) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function ensureSchemaCompatibility() {
  // Keep old Aiven data. Add only safe, nullable/has-default columns that the current
  // portfolio UI understands. Legacy required columns are handled dynamically below.
  const site = [
    ['name', 'VARCHAR(255) NULL'], ['headline', 'VARCHAR(255) NULL'], ['intro', 'LONGTEXT NULL'],
    ['about_title', 'VARCHAR(255) NULL'], ['about_text', 'LONGTEXT NULL'], ['what_i_do', 'LONGTEXT NULL'],
    ['goals', 'LONGTEXT NULL'], ['email', 'VARCHAR(255) NULL'], ['github', 'VARCHAR(500) NULL'],
    ['location', 'VARCHAR(255) NULL'], ['profile_image', 'VARCHAR(500) NULL'], ['resume_file', 'VARCHAR(500) NULL'],
    ['profile_image_url', 'VARCHAR(1000) NULL'], ['resume_url', 'VARCHAR(1000) NULL'],
    ['hero_typed', 'TEXT NULL'], ['hero_image', 'VARCHAR(1000) NULL'], ['about_image', 'VARCHAR(1000) NULL'], ['footer_description', 'LONGTEXT NULL']
  ];
  const skills = [
    ['category', 'VARCHAR(100) NOT NULL DEFAULT \'Other\''], ['title', 'VARCHAR(255) NULL'], ['description', 'TEXT NULL'], ['icon_file', 'VARCHAR(500) NULL'],
    ['icon_url', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']
  ];
  const projects = [
    ['title', 'VARCHAR(255) NULL'], ['description', 'TEXT NULL'], ['icon_file', 'VARCHAR(500) NULL'],
    ['image_url', 'VARCHAR(1000) NULL'], ['project_file', 'VARCHAR(500) NULL'],
    ['project_url', 'VARCHAR(1000) NULL'], ['github_url', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']
  ];
  for (const [c, d] of site) await ensureColumn('site_content', c, d);
  for (const [c, d] of skills) await ensureColumn('skills', c, d);
  await pool.query(`UPDATE skills SET category = CASE
    WHEN LOWER(title) IN ('c','c++','cpp','java','python','javascript','typescript','php','go','rust','kotlin','swift') THEN 'Languages'
    WHEN LOWER(title) LIKE '%html%' OR LOWER(title) LIKE '%css%' OR LOWER(title) LIKE '%web%' THEN 'Web Development'
    WHEN LOWER(title) LIKE '%react%' OR LOWER(title) LIKE '%node%' OR LOWER(title) LIKE '%express%' OR LOWER(title) LIKE '%next%' OR LOWER(title) LIKE '%django%' OR LOWER(title) LIKE '%spring%' OR LOWER(title) LIKE '%angular%' OR LOWER(title) LIKE '%vue%' THEN 'Frameworks'
    WHEN LOWER(title) LIKE '%tensorflow%' OR LOWER(title) LIKE '%pytorch%' OR LOWER(title) LIKE '%scikit%' OR LOWER(title) LIKE '%keras%' OR LOWER(title) LIKE '%machine learning%' OR LOWER(title) LIKE '%deep learning%' OR LOWER(title) LIKE '%artificial intelligence%' THEN 'AI & ML'
    WHEN LOWER(title) LIKE '%sql%' OR LOWER(title) LIKE '%mysql%' OR LOWER(title) LIKE '%postgres%' OR LOWER(title) LIKE '%mongodb%' OR LOWER(title) LIKE '%database%' THEN 'Databases'
    WHEN LOWER(title) LIKE '%git%' OR LOWER(title) LIKE '%docker%' OR LOWER(title) LIKE '%linux%' OR LOWER(title) LIKE '%aws%' OR LOWER(title) LIKE '%netlify%' OR LOWER(title) LIKE '%postman%' THEN 'Tools'
    WHEN LOWER(title) LIKE '%numpy%' OR LOWER(title) LIKE '%pandas%' OR LOWER(title) LIKE '%matplotlib%' OR LOWER(title) LIKE '%library%' THEN 'Libraries'
    ELSE COALESCE(NULLIF(TRIM(category), ''), 'Other')
  END
  WHERE category='Other' OR category IS NULL OR TRIM(category)='';`);
  for (const [c, d] of projects) await ensureColumn('projects', c, d);
  for (const [c, d] of [['role', 'VARCHAR(255) NULL'], ['title', 'VARCHAR(255) NULL'], ['company', 'VARCHAR(255) NULL'], ['logo_image', 'VARCHAR(500) NULL'], ['description', 'LONGTEXT NULL'], ['start_date', 'VARCHAR(100) NULL'], ['end_date', 'VARCHAR(100) NULL'], ['duration', 'VARCHAR(150) NULL'], ['location', 'VARCHAR(255) NULL'], ['url', 'VARCHAR(1000) NULL'], ['offer_letter_url', 'VARCHAR(1000) NULL'], ['offer_letter_file', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']]) await ensureColumn('experiences', c, d);
  for (const [c, d] of [['title', 'VARCHAR(255) NULL'], ['issuer', 'VARCHAR(255) NULL'], ['description', 'LONGTEXT NULL'], ['issue_date', 'VARCHAR(100) NULL'], ['credential_id', 'VARCHAR(255) NULL'], ['credential_url', 'VARCHAR(1000) NULL'], ['certificate_image', 'VARCHAR(500) NULL'], ['sort_order', 'INT DEFAULT 0']]) await ensureColumn('certificates', c, d);
  await pool.query(`CREATE TABLE IF NOT EXISTS education (id INT AUTO_INCREMENT PRIMARY KEY, institution VARCHAR(255) NULL, logo_image VARCHAR(500) NULL, discipline VARCHAR(255) NULL, domain_name VARCHAR(255) NULL, branch VARCHAR(255) NULL, stream VARCHAR(255) NULL, start_date VARCHAR(100) NULL, end_date VARCHAR(100) NULL, duration VARCHAR(150) NULL, description LONGTEXT NULL, url VARCHAR(1000) NULL, sort_order INT DEFAULT 0)`);
  for (const [c, d] of [['institution', 'VARCHAR(255) NULL'], ['logo_image', 'VARCHAR(500) NULL'], ['discipline', 'VARCHAR(255) NULL'], ['domain_name', 'VARCHAR(255) NULL'], ['branch', 'VARCHAR(255) NULL'], ['stream', 'VARCHAR(255) NULL'], ['start_date', 'VARCHAR(100) NULL'], ['end_date', 'VARCHAR(100) NULL'], ['duration', 'VARCHAR(150) NULL'], ['description', 'LONGTEXT NULL'], ['url', 'VARCHAR(1000) NULL'], ['sort_order', 'INT DEFAULT 0']]) await ensureColumn('education', c, d);
}

function firstExisting(map, names) {
  for (const name of names) if (map.has(name.toLowerCase())) return name;
  return null;
}

function valueFor(map, aliases, values, fallback = null) {
  const col = firstExisting(map, aliases);
  if (!col) return fallback;
  return values[col] !== undefined ? values[col] : fallback;
}

async function dynamicUpdate(table, id, values) {
  const columns = await tableColumns(table);
  const map = colMap(columns);
  const sets = [], params = [];
  for (const [key, value] of Object.entries(values)) {
    const actual = firstExisting(map, [key]);
    if (actual) { sets.push(`\`${actual}\`=?`); params.push(value); }
  }
  if (!sets.length) throw new Error(`No compatible fields found in ${table}.`);
  params.push(id);
  const [result] = await pool.query(`UPDATE \`${table}\` SET ${sets.join(', ')} WHERE id=?`, params);
  return result;
}

async function dynamicInsert(table, values, requiredAliases = {}) {
  const columns = await tableColumns(table);
  const map = colMap(columns);
  const insertCols = [], placeholders = [], params = [];

  for (const column of columns) {
    const name = column.COLUMN_NAME;
    const lower = name.toLowerCase();
    if (lower === 'id' && String(column.EXTRA || '').includes('auto_increment')) continue;

    let value;
    let found = false;
    if (Object.prototype.hasOwnProperty.call(values, name)) { value = values[name]; found = true; }
    else {
      const alias = Object.keys(requiredAliases).find(a => requiredAliases[a].some(x => x.toLowerCase() === lower));
      if (alias && Object.prototype.hasOwnProperty.call(values, alias)) { value = values[alias]; found = true; }
    }

    const required = column.IS_NULLABLE === 'NO' && column.COLUMN_DEFAULT === null && !String(column.EXTRA || '').includes('auto_increment');
    if (!found && required) {
      if (/int|decimal|float|double/.test(column.DATA_TYPE)) value = 0;
      else value = '';
      found = true;
    }

    if (found) {
      insertCols.push(`\`${name}\``); placeholders.push('?'); params.push(value);
    }
  }

  if (!insertCols.length) throw new Error(`No insertable fields found in ${table}.`);
  const [result] = await pool.query(`INSERT INTO \`${table}\` (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`, params);
  return result;
}

function normalizedSite(row) {
  const map = colMap(Object.keys(row).map(COLUMN_NAME => ({ COLUMN_NAME })));
  const name = valueFor(map, ['name', 'full_name', 'owner_name', 'display_name'], row, '');
  const headline = valueFor(map, ['headline', 'title', 'tagline', 'role'], row, '');
  return {
    ...row,
    name,
    headline,
    profile_image: row.profile_image || row.profile_image_url || '',
    resume_file: row.resume_file || row.resume_url || '',
    hero_typed: row.hero_typed || '',
    hero_image: row.hero_image || '',
    about_image: row.about_image || ''
  };
}

async function initDb() {
  const schema = fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
  await ensureSchemaCompatibility();

  const [adminRows] = await pool.query('SELECT id FROM admins LIMIT 1');
  if (!adminRows.length && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await pool.query('INSERT INTO admins (email,password_hash) VALUES (?,?)', [process.env.ADMIN_EMAIL, hash]);
  }

  const [siteRows] = await pool.query('SELECT id FROM site_content WHERE id=1');
  if (!siteRows.length) {
    await dynamicInsert('site_content', {
      id: 1, name: 'Shivam Sharma', headline: 'Web Developer & C++ Programmer',
      intro: 'I specialize in crafting modern, responsive websites and solving problems with efficient code. My approach blends clean design with seamless functionality.',
      about_title: 'About Me 🚀',
      about_text: 'Welcome to my portfolio! I’m a B.Tech CSE student passionate about creating interactive web experiences. With expertise in HTML, CSS, JavaScript, and C++, I transform ideas into functional, visually appealing projects. I enjoy crafting clean, efficient code for both sleek front-end interfaces and complex C++ solutions.',
      what_i_do: 'Front-End Development: Building responsive websites with HTML, CSS, and JavaScript.\nC++ Programming: Writing optimized algorithms and solving complex problems.\nContinuous Learning: Exploring new technologies and best practices.',
      goals: 'Master Full-Stack Development\nContribute to Open-Source\nBuild Scalable Web Applications',
      email: 'shivamsharma123jmt@gmail.com', github: 'https://github.com/shivamsharma-builds', location: 'India',
      hero_typed: 'Efficient C++ Programmer\nPython Developer\nWeb Enthusiast', footer_description: 'A personal portfolio showcasing my skills, projects, and passion for creating modern and meaningful digital experiences.'
    });
  }

  const [skills] = await pool.query('SELECT id FROM skills LIMIT 1');
  if (!skills.length) {
    const seed = [
      ['HTML Developer', 'Crafting semantic, accessible websites with HTML5 for optimal performance.', 'html.png', 1],
      ['CSS Developer', 'Creating responsive designs with CSS3, Flexbox, and Grid.', 'css.png', 2],
      ['JavaScript Developer', 'Building dynamic web applications with ES6 and DOM manipulation.', 'js.png', 3],
      ['C++ Programmer', 'Developing high-performance applications with OOP principles.', 'c++.png', 4],
      ['Python Developer', 'Building scalable applications with Python and data analysis tools.', 'python.png', 5]
    ];
    for (const row of seed) await dynamicInsert('skills', { title: row[0], description: row[1], icon_file: row[2], icon_url: '', sort_order: row[3] });
  }
  const [projects] = await pool.query('SELECT id FROM projects LIMIT 1');
  if (!projects.length) {
    const seed = [
      ['CLI Library Management System [CRUD]', 'A command-line library management system using CRUD operations and MySQL to manage books, members, and transactions.', 'c++.png', 'https://github.com/shivamsharma-builds/Library_Management/tree/main', 1],
      ['Weather App Using API', 'A JavaScript weather app that fetches live API data and displays temperature, humidity, conditions, and other weather details.', 'js.png', 'https://weather-main-xfqp.onrender.com', 2],
      ['Crop Prediction Using AI', 'An AI-powered agricultural project that predicts suitable crops using soil, weather, temperature, rainfall, and historical data.', 'vite.png', 'https://ai-crop-prediction.onrender.com', 3],
      ['Spotify Clone', 'A music-streaming UI inspired by Spotify, featuring song browsing, playlists, and playback-focused interface components.', 'js.png', 'https://spotifycloneshivam.netlify.app/', 4]
    ];
    for (const row of seed) await dynamicInsert('projects', { title: row[0], description: row[1], icon_file: row[2], icon_url: '', image_url: '', project_file: '', project_url: row[3], sort_order: row[4] });
  }
}

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM admins WHERE email=? LIMIT 1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
    req.session.adminId = rows[0].id;
    req.session.adminEmail = rows[0].email;
    res.json({ ok: true, redirect: '/admin.html' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true, redirect: '/admin.html' })));
app.get('/api/session', (req, res) => res.json({ authenticated: !!req.session.adminId, email: req.session.adminEmail || null }));

app.get('/api/public', async (_req, res) => {
  try {
    const [[rawSite]] = await pool.query('SELECT * FROM site_content WHERE id=1');
    const [skills] = await pool.query('SELECT * FROM skills ORDER BY sort_order,id');
    const [projects] = await pool.query('SELECT * FROM projects ORDER BY sort_order,id');
    const [experiences] = await pool.query('SELECT * FROM experiences ORDER BY sort_order,id');
    const [certificates] = await pool.query('SELECT * FROM certificates ORDER BY sort_order,id');
    const [education] = await pool.query('SELECT * FROM education ORDER BY sort_order,id');
    const site = normalizedSite(rawSite || {});
    res.json({
      site: { ...site, profile_image: site.profile_image ? (/^https?:\/\//i.test(site.profile_image) ? site.profile_image : fileUrl(site.profile_image)) : '', resume_file: site.resume_file ? (/^https?:\/\//i.test(site.resume_file) ? site.resume_file : fileUrl(site.resume_file)) : '', hero_image: site.hero_image ? (/^https?:\/\//i.test(site.hero_image) ? site.hero_image : fileUrl(site.hero_image)) : '', about_image: site.about_image ? (/^https?:\/\//i.test(site.about_image) ? site.about_image : fileUrl(site.about_image)) : '' },
      skills: skills.map(s => ({ ...s, icon_file: s.icon_url || (s.icon_file ? fileUrl(s.icon_file) : '') })),
      projects: projects.map(p => ({ ...p, icon_file: p.image_url || p.icon_url || (p.icon_file ? fileUrl(p.icon_file) : ''), project_file: p.project_url || (p.project_file && /^https?:\/\//i.test(p.project_file) ? p.project_file : fileUrl(p.project_file)), github_url: p.github_url || p.project_url || '' })),
      experiences: experiences.map(e => ({ ...e, logo_image: e.logo_image ? (isRemote(e.logo_image) ? e.logo_image : fileUrl(e.logo_image)) : '', offer_letter_file: e.offer_letter_file ? (isRemote(e.offer_letter_file) ? e.offer_letter_file : fileUrl(e.offer_letter_file)) : '', offer_letter_url: e.offer_letter_url || '' })),
      certificates: certificates.map(c => ({ ...c, certificate_image: c.certificate_image && !/^https?:\/\//i.test(c.certificate_image) ? fileUrl(c.certificate_image) : (c.certificate_image || '') })),
      education: education.map(e => ({ ...e, logo_image: e.logo_image && !/^https?:\/\//i.test(e.logo_image) ? fileUrl(e.logo_image) : (e.logo_image || '') }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/data', auth, async (_req, res) => {
  try {
    const [[rawSite]] = await pool.query('SELECT * FROM site_content WHERE id=1');
    const [skills] = await pool.query('SELECT * FROM skills ORDER BY sort_order,id');
    const [projects] = await pool.query('SELECT * FROM projects ORDER BY sort_order,id');
    const [experiences] = await pool.query('SELECT * FROM experiences ORDER BY sort_order,id');
    const [certificates] = await pool.query('SELECT * FROM certificates ORDER BY sort_order,id');
    const [education] = await pool.query('SELECT * FROM education ORDER BY sort_order,id');
    res.json({ site: normalizedSite(rawSite || {}), skills, projects, experiences, certificates, education });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/site', auth, upload.fields([{ name: 'profile_image', maxCount: 1 }, { name: 'resume_file', maxCount: 1 }, { name: 'hero_image', maxCount: 1 }]), async (req, res) => {
  try {
    const fields = req.body || {};
    const [rows] = await pool.query('SELECT * FROM site_content WHERE id=1 LIMIT 1');
    if (!rows.length) return res.status(409).json({ error: 'Portfolio record is missing. Restart the server to initialize the database.' });
    const current = normalizedSite(rows[0]);
    const profile = req.files?.profile_image?.[0]?.filename || current.profile_image || fields.profile_image_url || null;
    const resume = req.files?.resume_file?.[0]?.filename || current.resume_file || fields.resume_url || null;
    const hero = req.files?.hero_image?.[0]?.filename || current.hero_image || fields.hero_image_url || null;
    const about = current.about_image || null;
    if (!String(fields.name || current.name || '').trim() || !String(fields.headline || current.headline || '').trim()) return res.status(400).json({ error: 'Name and headline are required.' });

    const values = {
      name: String(fields.name || '').trim(), headline: String(fields.headline || '').trim(), intro: fields.intro || '', about_title: fields.about_title || '', about_text: fields.about_text || '',
      what_i_do: fields.what_i_do || '', goals: fields.goals || '', email: fields.email || '', github: fields.github || '', location: fields.location || '',
      profile_image: profile && !/^https?:\/\//i.test(profile) ? cleanFileName(profile) : null,
      resume_file: resume && !/^https?:\/\//i.test(resume) ? cleanFileName(resume) : null,
      profile_image_url: fields.profile_image_url || (/^https?:\/\//i.test(profile || '') ? profile : ''),
      resume_url: fields.resume_url || (/^https?:\/\//i.test(resume || '') ? resume : ''),
      hero_typed: fields.hero_typed || '', hero_image: hero && !/^https?:\/\//i.test(hero) ? cleanFileName(hero) : '', about_image: about && !/^https?:\/\//i.test(about) ? cleanFileName(about) : '', footer_description: fields.footer_description || ''
    };
    await dynamicUpdate('site_content', 1, values);
    res.json({ ok: true });
  } catch (e) { console.error('Admin site save failed:', e); res.status(500).json({ error: e.message || 'Could not save portfolio information.' }); }
});

app.post('/api/admin/skills', auth, upload.single('icon_file'), async (req, res) => {
  try {
    const { id, category, title, description, sort_order, icon_url } = req.body || {};
    if (!String(title || '').trim()) return res.status(400).json({ error: 'Skill title is required.' });
    const order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
    let current = {};
    if (id) { const [rows] = await pool.query('SELECT * FROM skills WHERE id=? LIMIT 1', [id]); if (!rows.length) return res.status(404).json({ error: 'Skill not found. Reload the page and try again.' }); current = rows[0]; }
    const uploaded = req.file?.filename || null;
    const iconFile = uploaded || cleanFileName(req.body?.existing_icon_file) || current.icon_file || null;
    const url = icon_url || current.icon_url || '';
    const values = { category: String(category || 'Other').trim() || 'Other', title: String(title).trim(), description: description || '', sort_order: order, icon_file: iconFile, icon_url: url };
    if (id) await dynamicUpdate('skills', id, values); else await dynamicInsert('skills', values);
    res.json({ ok: true });
  } catch (e) { console.error('Admin skill save failed:', e); res.status(500).json({ error: e.message || 'Could not save skill.' }); }
});
app.delete('/api/admin/skills/:id', auth, async (req, res) => { try { const [r] = await pool.query('DELETE FROM skills WHERE id=?', [req.params.id]); if (!r.affectedRows) return res.status(404).json({ error: 'Skill not found.' }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.post('/api/admin/projects', auth, upload.single('icon_file'), async (req, res) => {
  try {
    const { id, title, description, sort_order, icon_url, image_url, project_url, github_url } = req.body || {};
    if (!String(title || '').trim()) return res.status(400).json({ error: 'Project title is required.' });
    const order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
    let current = {};
    if (id) { const [rows] = await pool.query('SELECT * FROM projects WHERE id=? LIMIT 1', [id]); if (!rows.length) return res.status(404).json({ error: 'Project not found. Reload the page and try again.' }); current = rows[0]; }
    const iconUpload = req.file?.filename || null;
    const iconFile = iconUpload || current.icon_file || null;
    const values = { title: String(title).trim(), description: description || '', sort_order: order, icon_file: iconFile, icon_url: icon_url || current.icon_url || '', image_url: image_url || current.image_url || '', project_url: project_url || current.project_url || '', github_url: github_url || current.github_url || '' };
    if (id) await dynamicUpdate('projects', id, values); else await dynamicInsert('projects', values);
    res.json({ ok: true });
  } catch (e) { console.error('Admin project save failed:', e); res.status(500).json({ error: e.message || 'Could not save project.' }); }
});
app.delete('/api/admin/projects/:id', auth, async (req, res) => { try { const [r] = await pool.query('DELETE FROM projects WHERE id=?', [req.params.id]); if (!r.affectedRows) return res.status(404).json({ error: 'Project not found.' }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.post('/api/admin/experiences', auth, upload.fields([
  { name: 'logo_image', maxCount: 1 },
  { name: 'offer_letter_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id, role, title, company, description, start_date, end_date, duration, location, url, sort_order } = req.body || {};
    if (!String(title || role || '').trim()) return res.status(400).json({ error: 'Experience title is required.' });
    let current = {};
    if (id) {
      const [rows] = await pool.query('SELECT * FROM experiences WHERE id=? LIMIT 1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Experience not found.' });
      current = rows[0];
    }
    const logo = req.files?.logo_image?.[0]?.filename || cleanFileName(req.body?.existing_logo_image) || current.logo_image || '';
    const offerUpload = req.files?.offer_letter_file?.[0] || null;
    if (offerUpload && !/\.pdf$/i.test(offerUpload.originalname)) {
      fs.rmSync(path.join(UPLOAD_DIR, offerUpload.filename), { force: true });
      return res.status(400).json({ error: 'Offer letter must be a PDF file.' });
    }
    const offerFile = offerUpload?.filename || cleanFileName(req.body?.existing_offer_letter_file) || current.offer_letter_file || '';
    const values = {
      role: String(title || role).trim(), title: String(title || role).trim(), company: company || '', logo_image: logo,
      description: description || '', start_date: start_date || '', end_date: end_date || '', duration: duration || '',
      location: location || '', url: url || '', offer_letter_file: offerFile, offer_letter_url: '',
      sort_order: Number(sort_order) || 0
    };
    if (id) await dynamicUpdate('experiences', id, values); else await dynamicInsert('experiences', values);
    res.json({ ok: true });
  } catch (e) { console.error('Admin experience save failed:', e); res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/experiences/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT logo_image,offer_letter_file FROM experiences WHERE id=? LIMIT 1', [req.params.id]);
    const [r] = await pool.query('DELETE FROM experiences WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Experience not found.' });
    for (const file of [rows[0]?.logo_image, rows[0]?.offer_letter_file]) {
      if (file) fs.rm(path.join(UPLOAD_DIR, path.basename(file)), { force: true }, () => { });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/certificates', auth, upload.single('certificate_image'), async (req, res) => {
  try { const { id, title, issuer, description, issue_date, credential_id, credential_url, sort_order } = req.body || {}; if (!String(title || '').trim()) return res.status(400).json({ error: 'Certificate title is required.' }); let current = {}; if (id) { const [rows] = await pool.query('SELECT * FROM certificates WHERE id=? LIMIT 1', [id]); if (!rows.length) return res.status(404).json({ error: 'Certificate not found.' }); current = rows[0]; } const image = req.file?.filename || cleanFileName(req.body?.existing_certificate_image) || current.certificate_image || ''; const values = { title: String(title).trim(), issuer: issuer || '', description: description || '', issue_date: issue_date || '', credential_id: credential_id || '', credential_url: credential_url || '', certificate_image: image, sort_order: Number(sort_order) || 0 }; if (id) await dynamicUpdate('certificates', id, values); else await dynamicInsert('certificates', values); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/certificates/:id', auth, async (req, res) => { try { const [rows] = await pool.query('SELECT certificate_image FROM certificates WHERE id=? LIMIT 1', [req.params.id]); const [r] = await pool.query('DELETE FROM certificates WHERE id=?', [req.params.id]); if (!r.affectedRows) return res.status(404).json({ error: 'Certificate not found.' }); if (rows[0]?.certificate_image) fs.rm(path.join(UPLOAD_DIR, path.basename(rows[0].certificate_image)), { force: true }, () => { }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.post('/api/admin/education', auth, upload.single('logo_image'), async (req, res) => {
  try { const { id, institution, discipline, domain_name, branch, stream, start_date, end_date, duration, description, url, sort_order } = req.body || {}; if (!String(institution || '').trim()) return res.status(400).json({ error: 'Institution is required.' }); let current = {}; if (id) { const [rows] = await pool.query('SELECT * FROM education WHERE id=? LIMIT 1', [id]); if (!rows.length) return res.status(404).json({ error: 'Education entry not found.' }); current = rows[0]; } const logo = req.file?.filename || cleanFileName(req.body?.existing_logo_image) || current.logo_image || ''; const values = { institution: String(institution).trim(), logo_image: logo, discipline: discipline || '', domain_name: domain_name || '', branch: branch || '', stream: stream || '', start_date: start_date || '', end_date: end_date || '', duration: duration || '', description: description || '', url: url || '', sort_order: Number(sort_order) || 0 }; if (id) await dynamicUpdate('education', id, values); else await dynamicInsert('education', values); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/education/:id', auth, async (req, res) => { try { const [rows] = await pool.query('SELECT logo_image FROM education WHERE id=? LIMIT 1', [req.params.id]); const [r] = await pool.query('DELETE FROM education WHERE id=?', [req.params.id]); if (!r.affectedRows) return res.status(404).json({ error: 'Education entry not found.' }); if (rows[0]?.logo_image) fs.rm(path.join(UPLOAD_DIR, path.basename(rows[0].logo_image)), { force: true }, () => { }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/admin/site-image/:field', auth, async (req, res) => { try { const allowed = ['profile_image', 'hero_image', 'about_image']; if (!allowed.includes(req.params.field)) return res.status(400).json({ error: 'Invalid image field.' }); const [rows] = await pool.query('SELECT * FROM site_content WHERE id=1 LIMIT 1'); if (!rows.length) return res.status(404).json({ error: 'Portfolio record not found.' }); const old = rows[0][req.params.field]; await dynamicUpdate('site_content', 1, { [req.params.field]: null }); if (old && !/^https?:\/\//i.test(old)) fs.rm(path.join(UPLOAD_DIR, path.basename(old)), { force: true }, () => { }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    if (res.headersSent) return next(err);
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  next(err);
});

app.use('/admin', (req, res) => res.sendFile(path.join(ROOT, 'admin.html')));

initDb().then(() => app.listen(PORT, () => console.log(`Portfolio server running on http://localhost:${PORT}`))).catch(err => { console.error('Database connection failed:', err.message); process.exit(1); });
