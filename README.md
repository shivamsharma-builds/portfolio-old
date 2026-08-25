# Shivam Sharma Portfolio — Admin + Aiven MySQL

This version keeps the existing portfolio design but adds a Node.js/Express backend, Aiven MySQL database, secure admin login, and a dashboard for editing portfolio content.

## Features
- Public portfolio loads profile, about, skills, projects, and contact details from MySQL.
- `/admin` provides an admin login and dashboard.
- Admin can edit profile/contact/about content.
- Admin can add, edit, reorder, and delete skills.
- Admin can add, edit, reorder, and delete projects.
- Passwords are stored as bcrypt hashes.
- Admin session is stored in an HTTP-only cookie.

## Aiven MySQL setup
1. Create an Aiven MySQL service.
2. Select the database you want to use (Aiven commonly provides `defaultdb`) and run `schema.sql` in Aiven's SQL console (or your MySQL client).
3. Copy `.env.example` to `.env` and enter your Aiven host, port, username, password, and database name.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. On startup, the server creates or updates that admin account using a bcrypt hash.

The admin password is never sent to the browser. Keep `.env` private and use a strong `SESSION_SECRET`.

## Local run

```bash
npm install
cp .env.example .env
npm start
```

Open:
- Portfolio: `http://localhost:3000/`
- Admin dashboard: `http://localhost:3000/admin`

## Deployment
Set the same environment variables in your hosting provider. Use `NODE_ENV=production`, a strong `SESSION_SECRET`, and Aiven's SSL connection settings. The database password and session secret must remain server-side.
