/* ═══════════════════════════════════════════════════════════════
   HIRENT — Main JavaScript
   ═══════════════════════════════════════════════════════════════ */

/* ── Hero Slider ─────────────────────────────────────────────── */
(function () {
  const track   = document.getElementById('sliderTrack');
  const dots    = document.querySelectorAll('.dot');
  const prevBtn = document.getElementById('sliderPrev');
  const nextBtn = document.getElementById('sliderNext');
  const TOTAL   = 5;
  const AUTO_MS = 4500;

  let current  = 0;
  let timer    = null;
  let startX   = 0;
  let isDragging = false;

  function goTo(index) {
    current = ((index % TOTAL) + TOTAL) % TOTAL;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(next, AUTO_MS);
  }

  function resetAuto() {
    clearInterval(timer);
    startAuto();
  }

  nextBtn.addEventListener('click', () => { next(); resetAuto(); });
  prevBtn.addEventListener('click', () => { prev(); resetAuto(); });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      goTo(parseInt(dot.dataset.dot, 10));
      resetAuto();
    });
  });

  /* Touch / swipe support */
  const viewport = track.parentElement;
  viewport.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  viewport.addEventListener('touchend', e => {
    if (!isDragging) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? next() : prev();
      resetAuto();
    }
    isDragging = false;
  }, { passive: true });

  /* Pause on hover */
  viewport.addEventListener('mouseenter', () => clearInterval(timer));
  viewport.addEventListener('mouseleave', startAuto);

  startAuto();
})();

/* ── CTA Button — Begin Your Journey / Go To Dashboard ───────── */
(function () {
  const ctaBtn = document.getElementById('ctaBtn');
  if (!ctaBtn) return;

  /* When Firebase auth is ready, call this to swap the button */
  function setCtaLoggedIn() {
    ctaBtn.innerHTML = `
      Go To Dashboard
      <svg class="cta-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    ctaBtn.dataset.loggedIn = 'true';
  }

  /* Navigate to onboarding (default) or dashboard (when logged in) */
  ctaBtn.addEventListener('click', () => {
    if (ctaBtn.dataset.loggedIn === 'true') {
      window.location.href = 'dashboard.html';
    } else {
      window.location.href = 'onboarding.html';
    }
  });

  /* Expose for future auth integration */
  window.__HirentSetCtaLoggedIn = setCtaLoggedIn;
})();

/* ── Final CTA buttons on landing page ───────────────────────── */
(function () {
  const finalCta = document.querySelector('.final-cta-card .cta-btn');
  if (!finalCta) return;
  finalCta.addEventListener('click', () => {
    window.location.href = 'onboarding.html';
  });
})();

/* ── Intersection Observer — Fade Up ─────────────────────────── */
(function () {
  const elements = document.querySelectorAll('.fade-up');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
})();

/* ── FAQ Accordion ───────────────────────────────────────────── */
(function () {
  const questions = document.querySelectorAll('.faq-question');

  questions.forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen  = btn.getAttribute('aria-expanded') === 'true';
      const answer  = btn.nextElementSibling;

      /* Close all */
      questions.forEach(q => {
        q.setAttribute('aria-expanded', 'false');
        const a = q.nextElementSibling;
        if (a) a.classList.remove('open');
      });

      /* Toggle clicked */
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        answer.classList.add('open');
      }
    });
  });
})();
