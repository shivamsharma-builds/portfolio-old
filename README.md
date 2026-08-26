# Shivam Portfolio — Netlify Production Build

This build is prepared for Netlify with:

- Netlify Functions for `/api/*` so the admin API works in a serverless deployment.
- Netlify Blobs for persistent uploads. Uploaded hero/profile images no longer depend on the read-only deploy filesystem.
- A signed, HttpOnly admin session cookie instead of Express in-memory sessions.
- A distinct hero image and profile image target on `index.html`, so the Admin panel's **Hero Photo** and **Profile Image** update the correct sections.
- Browser image compression and local preview before upload.
- Existing Aiven/MySQL data remains the source of portfolio content.

## Deploy to Netlify

1. Upload/push this project to Netlify.
2. Netlify should detect `netlify.toml`; the publish directory is the project root and Functions are in `netlify/functions`.
3. Add these environment variables in Netlify Project configuration → Environment variables:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `DB_SSL=true`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
4. The first function request creates any missing compatible tables/columns and creates the first admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` if the `admins` table is empty.
5. Open `/admin.html`, sign in, upload a Hero Photo and Profile Image, save, then open the public site and hard-refresh.

## Database

Run `schema.sql` against the existing MySQL database if it has never been initialized. The Netlify function also adds compatible missing columns automatically.

## Important security note

Do **not** commit `.env` or database credentials. The original uploaded archive contained live credentials, so rotate the Aiven database password, admin password, and session secret before putting this project into a public repository or production deployment.
