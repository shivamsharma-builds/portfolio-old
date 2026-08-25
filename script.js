const COMPONENTS = [
  "Navbar",
  "Hero",
  "About",
  "Skills",
  "Projects",
  "Experience",
  "Certificates",
  "Education",
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
      strings: (window.__PORTFOLIO_TYPED || [
        "&amp; Efficient C++ Programmer",
        "Python Developer",
        "Web Enthusiast"
      ]),

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
      await loadPortfolioData();

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
async function loadPortfolioData() {
  try {
    const response = await fetch('/api/public', { cache: 'no-store' });
    if (!response.ok) throw new Error('Portfolio API unavailable');
    const data = await response.json();
    const s = data.site;
    const set = (id, value) => { const el=document.getElementById(id); if(el) el.textContent=value||''; };
    set('hero-name', s.name); set('hero-headline', s.headline); set('intro-title', `Hi, I'm ${s.name}`); window.__PORTFOLIO_TYPED = String(s.hero_typed || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const intro = document.querySelector('.intro p'); if(intro) intro.textContent=s.intro||'';
    const resume=document.querySelector('.intro a[href*="resume"]'); if(resume && s.resume_file) resume.href=s.resume_file;
    const heroVisual=document.querySelector('#hero-visual-image'); if(heroVisual && s.hero_image) heroVisual.src=s.hero_image;
    const profile=document.querySelector('#profile-image'); if(profile && s.profile_image) profile.src=s.profile_image;
    set('about-title', s.about_title); set('about-text', s.about_text); set('what-i-do', s.what_i_do); set('goals', s.goals);
    set('contact-email', s.email); const email=document.getElementById('contact-email'); if(email) email.href=`mailto:${s.email}`;
    set('contact-github', s.github); const gh=document.getElementById('contact-github'); if(gh) gh.href=s.github;
    set('contact-location', s.location); set('footer-name', s.name); const footer=document.querySelector('.footer-description'); if(footer) footer.textContent=s.footer_description||footer.textContent;
    const skills=document.getElementById('skills-list'); if(skills) skills.innerHTML=data.skills.map(x=>`<article class="vertical"><img src="${x.icon_file||'public/icons/html.png'}" class="image-top" alt="${escapeHtml(x.title)}"><h2 class="vertical-text-title">${escapeHtml(x.title)}</h2><p class="vertical-text-desc">${escapeHtml(x.description)}</p></article>`).join('');
    const projects=document.getElementById('projects-list'); if(projects) projects.innerHTML=data.projects.map(x=>`<article class="project-box"><img src="${x.icon_file||'public/icons/js.png'}" alt="${escapeHtml(x.title)}"><div class="project-text"><h2>${escapeHtml(x.title)}</h2><p>${escapeHtml(x.description)}</p>${(x.github_url||x.project_url)?`<a href="${x.github_url||x.project_url}" target="_blank" rel="noopener noreferrer">GitHub <img src="public/icons/github.png" alt=""></a>`:''}</div></article>`).join('');
    const experience=document.getElementById('experience-list'); if(experience) experience.innerHTML=(data.experiences||[]).map(x=>`<article class="project-box">${x.logo_image?`<img src="${escapeHtml(x.logo_image)}" alt="${escapeHtml(x.company||'Company')} logo">`:''}<div class="project-text"><h2>${escapeHtml(x.title||x.role||'')}</h2><p><strong>${escapeHtml(x.company||'')}</strong>${x.location?' · '+escapeHtml(x.location):''}</p><p>${escapeHtml(x.duration||'')} ${!x.duration&&x.start_date?escapeHtml(x.start_date)+' '+(x.end_date?'— '+escapeHtml(x.end_date):''):''}</p><p>${escapeHtml(x.description||'')}</p>${x.url?`<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">View Experience</a>`:''}</div></article>`).join('');
    const certificates=document.getElementById('certificates-list'); if(certificates) certificates.innerHTML=(data.certificates||[]).map(x=>`<article class="project-box">${x.certificate_image?`<img src="${escapeHtml(x.certificate_image)}" alt="${escapeHtml(x.title)}">`:''}<div class="project-text"><h2>${escapeHtml(x.title||'')}</h2><p><strong>${escapeHtml(x.issuer||'')}</strong>${x.issue_date?' · '+escapeHtml(x.issue_date):''}</p><p>${escapeHtml(x.description||'')}</p>${x.credential_id?`<p><strong>Credential ID:</strong> ${escapeHtml(x.credential_id)}</p>`:''}${x.credential_url?`<a href="${escapeHtml(x.credential_url)}" target="_blank" rel="noopener noreferrer">Verify Certificate</a>`:''}</div></article>`).join('');
    const education=document.getElementById('education-list'); if(education) education.innerHTML=(data.education||[]).map(x=>`<article class="project-box">${x.logo_image?`<img src="${escapeHtml(x.logo_image)}" alt="${escapeHtml(x.institution||'Institution')} logo">`:''}<div class="project-text"><h2>${escapeHtml(x.institution||'')}</h2><p>${escapeHtml(x.discipline||'')}${x.domain_name?' · '+escapeHtml(x.domain_name):''}</p><p>${x.branch?`Branch: ${escapeHtml(x.branch)}`:''}${x.stream?`${x.branch?' · ':''}Stream: ${escapeHtml(x.stream)}`:''}</p><p>${escapeHtml(x.duration||'')}${!x.duration&&x.start_date?' · '+escapeHtml(x.start_date)+' '+(x.end_date?'— '+escapeHtml(x.end_date):''):''}</p>${x.description?`<p>${escapeHtml(x.description)}</p>`:''}${x.url?`<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">Institution Website</a>`:''}</div></article>`).join('');
  } catch (error) { console.error(error); }
}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
