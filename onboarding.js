/* ═══════════════════════════════════════════════════════════════
   HIRENT Onboarding — JavaScript
   localStorage-backed, 6-step flow.
   Firebase auth can be wired in via the HOOKS section at the bottom.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ────────────────────────────────────────────────── */
const TOTAL_STEPS = 6;
const LS_KEYS = {
  currentStep:  'hirent_currentStep',
  role:         'hirent_role',
  lookingFor:   'hirent_lookingFor',
  skills:       'hirent_skills',
  experience:   'hirent_experience',
  country:      'hirent_country',
  city:         'hirent_city',
};

const POPULAR_SKILLS = [
  'UI/UX Design', 'Web Design', 'React', 'Next.js',
  'Node.js', 'Python', 'Graphic Design', 'Mobile Design',
  'Figma', 'Flutter', 'Branding', 'Content Writing',
  'JavaScript', 'TypeScript', 'Vue.js', 'Angular',
  'Laravel', 'Django', 'WordPress', 'SEO',
  'Video Editing', 'Motion Design', 'Copywriting', 'Data Analysis',
];
const MAX_SKILLS = 10;

/* ── State ────────────────────────────────────────────────────── */
const state = {
  currentStep: 1,
  role:        '',
  lookingFor:  [],
  skills:      [],
  experience:  '',
  country:     '',
  city:        '',
};

/* ── LocalStorage Helpers ─────────────────────────────────────── */
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); }
  catch { /* private mode — silent */ }
}

function lsGetJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/* ── Restore state from localStorage on load ─────────────────── */
function restoreState() {
  const savedStep = parseInt(lsGet(LS_KEYS.currentStep) || '1', 10);
  state.currentStep = isNaN(savedStep) || savedStep < 1 ? 1 : Math.min(savedStep, TOTAL_STEPS);
  state.role        = lsGet(LS_KEYS.role)       || '';
  state.lookingFor  = lsGetJSON(LS_KEYS.lookingFor,  []);
  state.skills      = lsGetJSON(LS_KEYS.skills,       []);
  state.experience  = lsGet(LS_KEYS.experience) || '';
  state.country     = lsGet(LS_KEYS.country)    || '';
  state.city        = lsGet(LS_KEYS.city)        || '';
}

/* ── Progress Bar & Step Label ────────────────────────────────── */
function updateProgress(step) {
  const fill  = document.getElementById('progressFill');
  const label = document.getElementById('stepLabel');
  const pct   = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
  fill.style.width  = pct + '%';
  label.textContent = `Step ${step} of ${TOTAL_STEPS}`;
}

/* ── Step Transition ──────────────────────────────────────────── */
function showStep(nextStep, direction = 'forward') {
  const prev = document.getElementById(`step${state.currentStep}`);
  const next = document.getElementById(`step${nextStep}`);
  if (!next) return;

  /* Exit current */
  prev.classList.remove('ob-step--active');
  prev.classList.add(direction === 'forward' ? 'ob-step--exit-left' : 'ob-step--enter-right');

  /* Prepare next */
  next.style.visibility = 'visible';
  next.classList.remove('ob-step--hidden', 'ob-step--exit-left', 'ob-step--enter-right');
  /* Force reflow before adding active */
  void next.offsetHeight;
  next.classList.add('ob-step--active');

  /* Clean up previous panel after transition */
  setTimeout(() => {
    prev.classList.remove('ob-step--exit-left', 'ob-step--enter-right');
    prev.classList.add('ob-step--hidden');
    prev.style.visibility = '';
  }, 450);

  state.currentStep = nextStep;
  lsSet(LS_KEYS.currentStep, nextStep);
  updateProgress(nextStep);
}

/* ── Go Forward ───────────────────────────────────────────────── */
function goNext() {
  if (state.currentStep < TOTAL_STEPS) {
    showStep(state.currentStep + 1, 'forward');
  }
}

/* ── Go Back ──────────────────────────────────────────────────── */
function goBack() {
  if (state.currentStep > 1) {
    showStep(state.currentStep - 1, 'back');
  }
}

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — Role
   ═══════════════════════════════════════════════════════════════ */
function initStep1() {
  const grid       = document.getElementById('roleGrid');
  const continueBtn = document.getElementById('continueStep1');
  const cards      = grid.querySelectorAll('.role-card');

  /* Restore previous selection */
  if (state.role) {
    cards.forEach(c => {
      if (c.dataset.value === state.role) c.classList.add('selected');
    });
    continueBtn.disabled = false;
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.role = card.dataset.value;
      lsSet(LS_KEYS.role, state.role);
      continueBtn.disabled = false;
    });
  });

  continueBtn.addEventListener('click', () => {
    if (!state.role) return;
    goNext();
  });
}

/* ═══════════════════════════════════════════════════════════════
   STEP 2 — Looking For
   ═══════════════════════════════════════════════════════════════ */
function initStep2() {
  const grid        = document.getElementById('lookingGrid');
  const continueBtn = document.getElementById('continueStep2');
  const backBtn     = document.getElementById('backStep2');
  const cards       = grid.querySelectorAll('.looking-card');

  function syncContinue() {
    continueBtn.disabled = state.lookingFor.length === 0;
  }

  /* Restore */
  cards.forEach(card => {
    if (state.lookingFor.includes(card.dataset.value)) {
      card.classList.add('selected');
    }
  });
  syncContinue();

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const val = card.dataset.value;
      if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        state.lookingFor = state.lookingFor.filter(v => v !== val);
      } else {
        card.classList.add('selected');
        state.lookingFor.push(val);
      }
      lsSet(LS_KEYS.lookingFor, state.lookingFor);
      syncContinue();
    });
  });

  continueBtn.addEventListener('click', () => {
    if (state.lookingFor.length === 0) return;
    goNext();
  });

  backBtn.addEventListener('click', goBack);
}

/* ═══════════════════════════════════════════════════════════════
   STEP 3 — Skills
   ═══════════════════════════════════════════════════════════════ */
function initStep3() {
  const searchInput   = document.getElementById('skillsSearch');
  const selectedRow   = document.getElementById('selectedSkillsRow');
  const popularChips  = document.getElementById('popularChips');
  const searchResults = document.getElementById('skillsSearchResults');
  const limitNote     = document.getElementById('skillsLimitNote');
  const continueBtn   = document.getElementById('continueStep3');
  const backBtn       = document.getElementById('backStep3');

  /* Render popular chips */
  function renderPopular() {
    popularChips.innerHTML = '';
    POPULAR_SKILLS.forEach(skill => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-chip' + (state.skills.includes(skill) ? ' chip--active' : '');
      btn.innerHTML = `<span class="chip-icon">${state.skills.includes(skill) ? '' : '+'}</span> ${skill}`;
      btn.addEventListener('click', () => toggleSkill(skill));
      popularChips.appendChild(btn);
    });
  }

  /* Render selected chips */
  function renderSelected() {
    selectedRow.innerHTML = '';
    state.skills.forEach(skill => {
      const chip = document.createElement('span');
      chip.className = 'skill-chip--selected';
      chip.innerHTML = `${skill}<button class="chip-remove" aria-label="Remove ${skill}" data-skill="${skill}">×</button>`;
      selectedRow.appendChild(chip);
    });
    /* Remove buttons */
    selectedRow.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => toggleSkill(btn.dataset.skill));
    });
  }

  function updateLimitNote() {
    const count = state.skills.length;
    if (count === 0) {
      limitNote.textContent = '';
      limitNote.className = 'skills-limit-note';
    } else if (count >= MAX_SKILLS) {
      limitNote.textContent = `Maximum of ${MAX_SKILLS} skills reached.`;
      limitNote.className = 'skills-limit-note over';
    } else {
      limitNote.textContent = `${count} / ${MAX_SKILLS} selected`;
      limitNote.className = 'skills-limit-note';
    }
    continueBtn.disabled = state.skills.length === 0;
  }

  function toggleSkill(skill) {
    if (state.skills.includes(skill)) {
      state.skills = state.skills.filter(s => s !== skill);
    } else {
      if (state.skills.length >= MAX_SKILLS) return;
      state.skills.push(skill);
    }
    lsSet(LS_KEYS.skills, state.skills);
    renderSelected();
    renderPopular();
    updateLimitNote();
  }

  /* Search */
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.hidden = true; return; }

    const matches = POPULAR_SKILLS.filter(s => s.toLowerCase().includes(q));
    /* Also add typed value if not in list */
    const typed = searchInput.value.trim();
    if (typed && !POPULAR_SKILLS.map(s => s.toLowerCase()).includes(typed.toLowerCase())) {
      matches.push(typed);
    }

    searchResults.innerHTML = '';
    if (matches.length === 0) {
      searchResults.innerHTML = '<p style="padding:12px 16px;font-size:13px;color:#94A3B8">No results found</p>';
    } else {
      matches.slice(0, 8).forEach(skill => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-result-item' + (state.skills.includes(skill) ? ' result--active' : '');
        btn.textContent = skill;
        if (state.skills.includes(skill)) {
          const mark = document.createElement('span');
          mark.style.cssText = 'font-size:13px;color:var(--mint);font-weight:700';
          mark.textContent = '✓';
          btn.appendChild(mark);
        }
        btn.addEventListener('click', () => {
          toggleSkill(skill);
          searchInput.value = '';
          searchResults.hidden = true;
        });
        searchResults.appendChild(btn);
      });
    }
    searchResults.hidden = false;
  });

  /* Close search results on outside click */
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.hidden = true;
    }
  });

  /* Init render */
  renderSelected();
  renderPopular();
  updateLimitNote();

  continueBtn.addEventListener('click', () => {
    if (state.skills.length === 0) return;
    goNext();
  });
  backBtn.addEventListener('click', goBack);
}

/* ═══════════════════════════════════════════════════════════════
   STEP 4 — Experience
   ═══════════════════════════════════════════════════════════════ */
function initStep4() {
  const list        = document.getElementById('expList');
  const continueBtn = document.getElementById('continueStep4');
  const backBtn     = document.getElementById('backStep4');
  const cards       = list.querySelectorAll('.exp-card');

  if (state.experience) {
    cards.forEach(c => {
      if (c.dataset.value === state.experience) c.classList.add('selected');
    });
    continueBtn.disabled = false;
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.experience = card.dataset.value;
      lsSet(LS_KEYS.experience, state.experience);
      continueBtn.disabled = false;
    });
  });

  continueBtn.addEventListener('click', () => {
    if (!state.experience) return;
    goNext();
  });
  backBtn.addEventListener('click', goBack);
}

/* ═══════════════════════════════════════════════════════════════
   STEP 5 — Location
   ═══════════════════════════════════════════════════════════════ */
function initStep5() {
  const countrySelect = document.getElementById('countrySelect');
  const cityInput     = document.getElementById('cityInput');
  const continueBtn   = document.getElementById('continueStep5');
  const backBtn       = document.getElementById('backStep5');

  /* Restore */
  if (state.country) countrySelect.value = state.country;
  if (state.city)    cityInput.value     = state.city;

  function syncContinue() {
    continueBtn.disabled = !countrySelect.value;
  }
  syncContinue();

  countrySelect.addEventListener('change', () => {
    state.country = countrySelect.value;
    lsSet(LS_KEYS.country, state.country);
    syncContinue();
  });

  cityInput.addEventListener('input', () => {
    state.city = cityInput.value.trim();
    lsSet(LS_KEYS.city, state.city);
  });

  continueBtn.addEventListener('click', () => {
    if (!state.country) return;
    goNext();
  });
  backBtn.addEventListener('click', goBack);
}

/* ═══════════════════════════════════════════════════════════════
   STEP 6 — Success constellation
   ═══════════════════════════════════════════════════════════════ */
function initStep6() {
  const container = document.getElementById('successConstellation');
  const dots = [
    { top: '12%', left: '8%',  size: 6,  dur: '3.2s', delay: '0s'   },
    { top: '20%', left: '88%', size: 8,  dur: '4s',   delay: '0.3s' },
    { top: '70%', left: '6%',  size: 5,  dur: '3.6s', delay: '0.6s' },
    { top: '78%', left: '82%', size: 7,  dur: '4.4s', delay: '0.2s' },
    { top: '45%', left: '4%',  size: 4,  dur: '3s',   delay: '0.9s' },
    { top: '35%', left: '92%', size: 5,  dur: '3.8s', delay: '0.4s' },
    { top: '85%', left: '44%', size: 6,  dur: '4.2s', delay: '0.7s' },
    { top: '8%',  left: '52%', size: 4,  dur: '3.4s', delay: '1s'   },
  ];
  dots.forEach(d => {
    const el = document.createElement('div');
    el.className = 'constellation-dot';
    el.style.cssText = `top:${d.top};left:${d.left};width:${d.size}px;height:${d.size}px;--dur:${d.dur};--delay:${d.delay}`;
    container.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════ */
function init() {
  restoreState();

  /* Set initial step visible */
  const initialStep = document.getElementById(`step${state.currentStep}`);
  if (initialStep) {
    initialStep.classList.remove('ob-step--hidden');
    initialStep.classList.add('ob-step--active');
  }

  updateProgress(state.currentStep);

  /* Init each step */
  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();
  initStep6();
}

document.addEventListener('DOMContentLoaded', init);

/* ═══════════════════════════════════════════════════════════════
   FIREBASE AUTH HOOK — wire up here when ready
   Replace the <a href="login.html"> links in step 6 with:
   
   createAccountBtn.addEventListener('click', async () => {
     // const { email, password } = collectAuthForm();
     // await firebase.auth().createUserWithEmailAndPassword(email, password);
     // then save onboarding data to Firestore using state object
   });
   
   The entire state object is ready for upload:
   { role, lookingFor, skills, experience, country, city }
   ═══════════════════════════════════════════════════════════════ */
