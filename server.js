require('dotenv').config();
const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  createDatabaseTable: true
});

app.use(session({
  name: 'portfolio_admin_session',
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));

const publicRoot = __dirname;
app.use('/admin', express.static(path.join(publicRoot, 'admin')));
app.use(express.static(publicRoot));

function requireAuth(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function cleanString(value, max = 10000) {
  return String(value ?? '').trim().slice(0, max);
}

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema checked/initialized.');
}

async function ensureAdmin() {
  const email = cleanString(process.env.ADMIN_EMAIL, 255).toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; create an admin row manually or set these variables.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO admins (email,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',
    [email, passwordHash]
  );
}

app.get('/api/content', async (req, res) => {
  try {
    const [siteRows] = await pool.query('SELECT * FROM site_content WHERE id=1 LIMIT 1');
    const [skills] = await pool.query('SELECT * FROM skills ORDER BY sort_order, id');
    const [projects] = await pool.query('SELECT * FROM projects ORDER BY sort_order, id');
    res.json({ site: siteRows[0] || null, skills, projects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load portfolio content' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = cleanString(req.body.email, 255).toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query('SELECT id, email, password_hash FROM admins WHERE email=? LIMIT 1', [email]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.adminId = admin.id;
    req.session.adminEmail = admin.email;
    res.json({ ok: true, email: admin.email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  res.json({ authenticated: Boolean(req.session.adminId), email: req.session.adminEmail || null });
});

app.put('/api/site', requireAuth, async (req, res) => {
  try {
    const fields = ['full_name','headline','subheadline','intro','about_title','about_text','what_i_do','goals','email','github','location','resume_url','profile_image_url'];
    const values = fields.map(f => cleanString(req.body[f], 10000));
    await pool.query(`UPDATE site_content SET ${fields.map(f => `${f}=?`).join(', ')} WHERE id=1`, values);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update site content' });
  }
});

app.post('/api/skills', requireAuth, async (req, res) => {
  try {
    const { title, description, icon_url, sort_order } = req.body;
    const [result] = await pool.query('INSERT INTO skills (title,description,icon_url,sort_order) VALUES (?,?,?,?)', [cleanString(title,120), cleanString(description), cleanString(icon_url,500), Number(sort_order)||0]);
    res.status(201).json({ id: result.insertId });
  } catch (error) { res.status(500).json({ error: 'Unable to create skill' }); }
});

app.put('/api/skills/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE skills SET title=?,description=?,icon_url=?,sort_order=? WHERE id=?', [cleanString(req.body.title,120), cleanString(req.body.description), cleanString(req.body.icon_url,500), Number(req.body.sort_order)||0, Number(req.params.id)]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Unable to update skill' }); }
});

app.delete('/api/skills/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM skills WHERE id=?', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: 'Unable to delete skill' }); }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const { title, description, image_url, project_url, github_url, sort_order } = req.body;
    const [result] = await pool.query('INSERT INTO projects (title,description,image_url,project_url,github_url,sort_order) VALUES (?,?,?,?,?,?)', [cleanString(title,180), cleanString(description), cleanString(image_url,500), cleanString(project_url,500), cleanString(github_url,500), Number(sort_order)||0]);
    res.status(201).json({ id: result.insertId });
  } catch (error) { res.status(500).json({ error: 'Unable to create project' }); }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE projects SET title=?,description=?,image_url=?,project_url=?,github_url=?,sort_order=? WHERE id=?', [cleanString(req.body.title,180), cleanString(req.body.description), cleanString(req.body.image_url,500), cleanString(req.body.project_url,500), cleanString(req.body.github_url,500), Number(req.body.sort_order)||0, Number(req.params.id)]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Unable to update project' }); }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM projects WHERE id=?', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: 'Unable to delete project' }); }
});

app.get('/admin', (req, res) => res.sendFile(path.join(publicRoot, 'admin', 'index.html')));

async function start() {
  try {
    await pool.query('SELECT 1');
    await initializeDatabase();
    await ensureAdmin();
    app.listen(PORT, () => console.log(`Portfolio server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
}

start();
