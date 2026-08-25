const COMPONENTS = [
  "Navbar",
  "Hero",
  "About",
  "Skills",
  "Projects",
  "Contact"
];

/* =========================================================
   EMAILJS CONFIGURATION
   ========================================================= */

const EMAILJS_CONFIG = {
  publicKey: "7LHUexjxYOBtWV0th",

  serviceId: "service_dozgr4f",

  // Email notification sent to you
  ownerTemplateId: "template_h8wfyfw",

  // Confirmation email sent to the visitor
  clientTemplateId: "template_6vir1h8",

  ownerEmail: "shivamsharma123jmt@gmail.com"
};


/* =========================================================
   EMAILJS CHECK
   ========================================================= */

function emailServiceConfigured() {
  return Boolean(
    window.emailjs &&
    EMAILJS_CONFIG.publicKey &&
    !EMAILJS_CONFIG.publicKey.startsWith("YOUR_") &&
    EMAILJS_CONFIG.serviceId &&
    !EMAILJS_CONFIG.serviceId.startsWith("YOUR_") &&
    EMAILJS_CONFIG.ownerTemplateId &&
    !EMAILJS_CONFIG.ownerTemplateId.startsWith("YOUR_") &&
    EMAILJS_CONFIG.clientTemplateId &&
    !EMAILJS_CONFIG.clientTemplateId.startsWith("YOUR_")
  );
}


/* =========================================================
   LOAD COMPONENTS
   ========================================================= */

async function loadComponents() {
  await Promise.all(
    COMPONENTS.map(async (name) => {
      const mount = document.querySelector(
        `[data-component="${name}"]`
      );

      if (!mount) {
        console.warn(
          `Component mount not found: ${name}`
        );
        return;
      }

      try {
        const response = await fetch(
          `./src/components/${name}.html`,
          {
            cache: "no-cache"
          }
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        mount.innerHTML =
          await response.text();

      } catch (error) {
        console.error(
          `Failed to load ${name}:`,
          error
        );

        mount.innerHTML = `
          <p class="component-error">
            Unable to load this section.
          </p>
        `;
      }
    })
  );

  initializeInteractions();
}


/* =========================================================
   INITIALIZE ALL INTERACTIONS
   ========================================================= */

function initializeInteractions() {

  /* -------------------------------------------------------
     TYPED TEXT
     ------------------------------------------------------- */

  if (
    window.Typed &&
    document.querySelector("#element")
  ) {
    new Typed("#element", {
      strings: [
        "&amp; Efficient C++ Programmer",
        "Python Developer",
        "Web Enthusiast"
      ],

      typeSpeed: 70,

      backSpeed: 40,

      backDelay: 1200,

      loop: true
    });
  }


  /* -------------------------------------------------------
     NAVBAR SCROLL EFFECT
     ------------------------------------------------------- */

  const nav =
    document.querySelector(".vertical-nav");

  const updateNav = () => {
    if (!nav) return;

    nav.classList.toggle(
      "scrolled",
      window.scrollY > 30
    );
  };

  updateNav();

  window.addEventListener(
    "scroll",
    updateNav,
    {
      passive: true
    }
  );


  /* -------------------------------------------------------
     SCROLL TO TOP BUTTON
     ------------------------------------------------------- */

  const scrollTopButton =
    document.querySelector(".box-down");

  scrollTopButton?.addEventListener(
    "click",
    () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  );


  /* -------------------------------------------------------
     MOBILE MENU
     ------------------------------------------------------- */

  const menuToggle =
    document.querySelector(".menu-toggle");

  const menu =
    document.querySelector("#site-menu");


  menuToggle?.addEventListener(
    "click",
    () => {

      const isOpen =
        menuToggle.getAttribute(
          "aria-expanded"
        ) === "true";


      menuToggle.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );


      menu?.classList.toggle(
        "open",
        !isOpen
      );
    }
  );


  /* -------------------------------------------------------
     CLOSE MOBILE MENU AFTER CLICKING LINK
     ------------------------------------------------------- */

  document
    .querySelectorAll(".vertical-nav a")
    .forEach((link) => {

      link.addEventListener(
        "click",
        () => {

          menuToggle?.setAttribute(
            "aria-expanded",
            "false"
          );

          menu?.classList.remove(
            "open"
          );

        }
      );

    });


  /* -------------------------------------------------------
     CONTACT FORM
     ------------------------------------------------------- */

  setupContactForm();
}


/* =========================================================
   CONTACT FORM
   ========================================================= */

function setupContactForm() {

  const contactForm =
    document.querySelector("#contact-form");

  const formStatus =
    document.querySelector("#form-status");


  if (!contactForm || !formStatus) {
    console.warn(
      "Contact form was not found."
    );

    return;
  }


  /* -------------------------------------------------------
     INITIALIZE EMAILJS
     ------------------------------------------------------- */

  if (
    window.emailjs &&
    EMAILJS_CONFIG.publicKey
  ) {

    window.emailjs.init({
      publicKey:
        EMAILJS_CONFIG.publicKey
    });

  } else {

    console.error(
      "EmailJS library was not loaded."
    );

  }


  /* -------------------------------------------------------
     FORM SUBMISSION
     ------------------------------------------------------- */

  contactForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      /* -----------------------------------------------
         HTML VALIDATION
         ----------------------------------------------- */

      if (!contactForm.checkValidity()) {

        contactForm.reportValidity();

        return;
      }


      /* -----------------------------------------------
         GET FORM ELEMENTS
         ----------------------------------------------- */

      const submitButton =
        contactForm.querySelector(
          ".submit-btn"
        );


      const name =
        contactForm.elements.name.value.trim();


      const email =
        contactForm.elements.email.value.trim();


      const message =
        contactForm.elements.message.value.trim();


      /* -----------------------------------------------
         EXTRA VALIDATION
         ----------------------------------------------- */

      if (
        !name ||
        !email ||
        !message
      ) {

        formStatus.textContent =
          "Please fill in all fields.";

        return;
      }


      /* -----------------------------------------------
         EMAIL VALIDATION
         ----------------------------------------------- */

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (!emailPattern.test(email)) {

        formStatus.textContent =
          "Please enter a valid email address.";

        return;
      }


      /* -----------------------------------------------
         CHECK EMAILJS
         ----------------------------------------------- */

      if (!emailServiceConfigured()) {

        formStatus.textContent =
          "The email service is not configured yet. Please email me directly.";

        return;
      }


      /* -----------------------------------------------
         DISABLE BUTTON
         ----------------------------------------------- */

      if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
          "Sending...";

      }


      formStatus.textContent =
        "Sending your message...";


      /* =================================================
         OWNER EMAIL PARAMETERS
         ================================================= */

      const ownerParams = {

        visitor_name: name,

        visitor_email: email,

        visitor_message: message,

        to_email:
          EMAILJS_CONFIG.ownerEmail

      };


      /* =================================================
         CLIENT CONFIRMATION PARAMETERS
         ================================================= */

      const clientParams = {

        visitor_name: name,

        visitor_email: email,

        visitor_message: message,

        to_email: email

      };


      /* =================================================
         SEND EMAILS
         ================================================= */

      try {

        /* ---------------------------------------------
           1. SEND NOTIFICATION TO SHIVAM
           --------------------------------------------- */

        await window.emailjs.send(

          EMAILJS_CONFIG.serviceId,

          EMAILJS_CONFIG.ownerTemplateId,

          ownerParams

        );


        /* ---------------------------------------------
           2. SEND CONFIRMATION TO VISITOR
           --------------------------------------------- */

        await window.emailjs.send(

          EMAILJS_CONFIG.serviceId,

          EMAILJS_CONFIG.clientTemplateId,

          clientParams

        );


        /* ---------------------------------------------
           SUCCESS
           --------------------------------------------- */

        formStatus.textContent =
          "Message sent successfully! A confirmation email has been sent to you.";


        formStatus.setAttribute(
          "data-status",
          "success"
        );


        /* Clear form */

        contactForm.reset();


      } catch (error) {

        console.error(
          "EmailJS error:",
          error
        );


        formStatus.textContent =
          "We couldn't send the message right now. Please try again or email me directly.";


        formStatus.setAttribute(
          "data-status",
          "error"
        );


      } finally {

        /* ---------------------------------------------
           ENABLE BUTTON AGAIN
           --------------------------------------------- */

        if (submitButton) {

          submitButton.disabled = false;

          submitButton.textContent =
            "Send Message";

        }

      }

    }
  );
}


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

window.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await loadComponents();
      await loadPortfolioContent();

    } catch (error) {

      console.error(
        "Portfolio initialization failed:",
        error
      );

    } finally {

      /*
       * Remove loading screen even if
       * one component fails.
       */

      document
        .querySelector(".loading-screen")
        ?.remove();


      /*
       * Show actual website.
       */

      document
        .querySelector(".site-content")
        ?.removeAttribute("hidden");

    }

  }
);
/* =========================================================
   DATABASE-BACKED PORTFOLIO CONTENT
   ========================================================= */

async function loadPortfolioContent() {
  try {
    const response = await fetch('/api/content', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const site = data.site;
    if (!site) return;

    const setText = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = value || '';
    };

    setText('#home-name', site.full_name);
    setText('#home-intro', site.intro);
    setText('#home-headline', site.headline);

    const profile = document.querySelector('.profile-img img');
    if (profile && site.profile_image_url) profile.src = site.profile_image_url;

    const resume = document.querySelector('a[href*="resume.pdf"]');
    if (resume && site.resume_url) resume.href = site.resume_url;

    const email = document.querySelector('#contact a[href^="mailto:"]');
    if (email) { email.href = `mailto:${site.email}`; email.textContent = site.email; }

    const github = document.querySelector('#contact a[href*="github.com"]');
    if (github) { github.href = site.github; github.textContent = site.github.replace(/^https?:\/\//, ''); }

    const location = document.querySelector('#contact .contact-item:nth-of-type(3) p');
    if (location) location.textContent = site.location;

    renderDatabaseSections(data);
  } catch (error) {
    console.warn('Database content unavailable; using local HTML content.', error);
  }
}

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
}

function renderDatabaseSections(data) {
  const about = document.querySelector('[data-component="About"]');
  if (about && data.site) {
    const paragraphs = safeText(data.site.about_text).split(/\n\s*\n/).filter(Boolean).map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
    const what = safeText(data.site.what_i_do).replace(/\n\s*\n/g,'<br><br>').replace(/\n/g,'<br>');
    const goals = safeText(data.site.goals).replace(/\n\s*\n/g,'<br><br>').replace(/\n/g,'<br>');
    about.innerHTML = `<section class="about-box" id="about" aria-labelledby="about-title"><h1 id="about-title">${safeText(data.site.about_title)}</h1><div class="about-text">${paragraphs}<h2>What I Do</h2><p>${what}</p><h2>My Goals</h2><p>${goals}</p></div></section>`;
  }

  const skills = document.querySelector('[data-component="Skills"]');
  if (skills && Array.isArray(data.skills)) {
    skills.innerHTML = `<section class="secondsection" id="skills" aria-labelledby="skills-title"><h1 id="skills-title">Skills &amp; Expertise</h1><div class="box">${data.skills.map(s => `<article class="vertical"><img src="${safeText(s.icon_url)}" class="image-top" alt="${safeText(s.title)}"><h2 class="vertical-text-title">${safeText(s.title)}</h2><p class="vertical-text-desc">${safeText(s.description)}</p></article>`).join('')}</div></section>`;
  }

  const projects = document.querySelector('[data-component="Projects"]');
  if (projects && Array.isArray(data.projects)) {
    projects.innerHTML = `<section class="project-section" id="projects" aria-labelledby="projects-title"><h1 id="projects-title">My Projects</h1><div class="project-grid">${data.projects.map(p => `<article class="project-box"><img src="${safeText(p.image_url)}" alt="${safeText(p.title)}"><div class="project-text"><h2>${safeText(p.title)}</h2><p>${safeText(p.description)}</p><a href="${safeText(p.project_url)}" target="_blank" rel="noopener noreferrer">View Project <img src="./public/icons/github.png" alt=""></a></div></article>`).join('')}</div></section>`;
  }

}
