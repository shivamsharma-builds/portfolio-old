# Shivam Sharma Portfolio

A component-based static portfolio website.

## What was fixed
- Corrected asset locations for icons, profile image, favicon, and resume.
- Corrected the Projects anchor from `#Project` to `#projects`.
- Removed the broken/empty navbar dependency and split the page into reusable HTML components.
- Added a component loader in `script.js`.
- Added responsive mobile navigation.
- Improved the contact form interaction and validation.
- Added safer external-link attributes.

## Components
Located in `src/components/`:
- `Navbar.html`
- `Hero.html`
- `About.html`
- `Skills.html`
- `Projects.html`
- `Contact.html`

## Run locally
Because components are loaded with `fetch()`, open the project through a local web server instead of double-clicking `index.html`.

For example:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173/`.
