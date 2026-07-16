/**
 * auth.js — HIRENT Authentication Logic
 *
 * Handles all Firebase Auth operations:
 *   - Email/Password login & signup
 *   - Google OAuth
 *   - Forgot password
 *   - Auth state listener
 *   - Firestore user document management
 *   - Session persistence (Remember Me)
 *   - Redirect to DashboardManager after auth
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { auth, db } from './firebase.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const DASHBOARD_MANAGER = 'dashboard-manager.html';
const LS_KEYS = {
  role:        'hirent_role',
  lookingFor:  'hirent_lookingFor',
  skills:      'hirent_skills',
  experience:  'hirent_experience',
  country:     'hirent_country',
  city:        'hirent_city',
};

/* Firebase error code → human-readable message */
const ERROR_MESSAGES = {
  'auth/email-already-in-use':     'An account with this email already exists.',
  'auth/invalid-email':            'Please enter a valid email address.',
  'auth/weak-password':            'Password must be at least 8 characters.',
  'auth/user-not-found':           'No account found with this email address.',
  'auth/wrong-password':           'Incorrect password. Please try again.',
  'auth/invalid-credential':       'Incorrect email or password. Please try again.',
  'auth/too-many-requests':        'Too many attempts. Please try again in a few minutes.',
  'auth/network-request-failed':   'Network error. Please check your connection.',
  'auth/popup-closed-by-user':     'Google sign-in was cancelled.',
  'auth/popup-blocked':            'Pop-up blocked. Please allow pop-ups for this site.',
  'auth/user-disabled':            'This account has been disabled.',
  'auth/operation-not-allowed':    'This sign-in method is not enabled.',
};

function friendlyError(code) {
  return ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';
}

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration  ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const iconSvg = {
    success: '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    info:    '<svg viewBox="0 0 12 12" fill="none"><path d="M6 5.5v4M6 3.5v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg[type]}</div>
    <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   BUTTON LOADING STATE
   ═══════════════════════════════════════════════════════════════ */
/**
 * Toggle a button's loading state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 */
export function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.classList.add('loading');
  } else {
    btn.classList.remove('loading');
  }
}

/* ═══════════════════════════════════════════════════════════════
   FORM VALIDATION HELPERS
   ═══════════════════════════════════════════════════════════════ */
export function showFieldError(inputEl, errorEl, message) {
  if (!inputEl || !errorEl) return;
  inputEl.classList.add('input--error');
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

export function clearFieldError(inputEl, errorEl) {
  if (!inputEl || !errorEl) return;
  inputEl.classList.remove('input--error');
  errorEl.classList.remove('visible');
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const PASSWORD_RULES = [
  { id: 'length',    label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter',   test: pw => /[A-Z]/.test(pw) },
  { id: 'number',    label: 'One number',             test: pw => /[0-9]/.test(pw) },
  { id: 'special',   label: 'One special character',  test: pw => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(pw) },
];

export function checkPasswordStrength(password) {
  return PASSWORD_RULES.map(rule => ({ ...rule, met: rule.test(password) }));
}

export function isPasswordStrong(password) {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

/* ═══════════════════════════════════════════════════════════════
   FIRESTORE — USER DOCUMENT
   ═══════════════════════════════════════════════════════════════ */
/**
 * Read onboarding data from localStorage.
 * Returns an object ready to store in Firestore.
 */
function collectOnboardingData() {
  const safe = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return localStorage.getItem(key) || fallback;
    }
  };
  return {
    role:       safe(LS_KEYS.role, ''),
    lookingFor: safe(LS_KEYS.lookingFor, []),
    skills:     safe(LS_KEYS.skills, []),
    experience: safe(LS_KEYS.experience, ''),
    country:    safe(LS_KEYS.country, ''),
    city:       safe(LS_KEYS.city, ''),
  };
}

/**
 * Create a new user document in Firestore.
 * Only called once per user — on first sign-up or first Google sign-in.
 */
async function createUserDocument(uid, { name, email, provider }) {
  const onboarding = collectOnboardingData();
  await setDoc(doc(db, 'users', uid), {
    uid,
    name:                name || '',
    email:               email || '',
    role:                onboarding.role || '',
    provider,
    lookingFor:          onboarding.lookingFor,
    skills:              onboarding.skills,
    experience:          onboarding.experience,
    country:             onboarding.country,
    city:                onboarding.city,
    profileCompleted:    false,
    onboardingCompleted: onboarding.role !== '',
    createdAt:           serverTimestamp(),
    lastLogin:           serverTimestamp(),
  });
}

/**
 * Update lastLogin timestamp on every successful sign-in.
 */
async function touchLastLogin(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), { lastLogin: serverTimestamp() });
  } catch {
    /* Document may not exist yet during sign-up race — safe to ignore */
  }
}

/**
 * Check if a Firestore user document already exists.
 */
async function userDocExists(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists();
}

/* ═══════════════════════════════════════════════════════════════
   AUTH STATE LISTENER
   Runs on every page that imports auth.js.
   Redirects authenticated users to DashboardManager immediately.
   ═══════════════════════════════════════════════════════════════ */
let authListenerInitialised = false;

/**
 * Initialise the auth state listener.
 * Call this once per page after DOM is ready.
 * @param {Function} [onUnauthenticated]  Called when no user is signed in.
 */
export function initAuthListener(onUnauthenticated) {
  if (authListenerInitialised) return;
  authListenerInitialised = true;

  onAuthStateChanged(auth, user => {
    if (user) {
      /* Authenticated — hand off to DashboardManager */
      window.location.replace(DASHBOARD_MANAGER);
    } else {
      /* Not authenticated — hide page loader, let page render */
      hidePageLoader();
      if (typeof onUnauthenticated === 'function') onUnauthenticated();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   PAGE LOADER
   ═══════════════════════════════════════════════════════════════ */
function hidePageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SIGN IN — Email / Password
   ═══════════════════════════════════════════════════════════════ */
/**
 * @param {string}  email
 * @param {string}  password
 * @param {boolean} rememberMe
 * @returns {Promise<void>}
 */
export async function signInEmail(email, password, rememberMe) {
  const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
  await touchLastLogin(user.uid);
  /* onAuthStateChanged will fire and redirect to DashboardManager */
}

/* ═══════════════════════════════════════════════════════════════
   SIGN UP — Email / Password
   ═══════════════════════════════════════════════════════════════ */
/**
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<void>}
 */
export async function signUpEmail(name, email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(user, { displayName: name.trim() });
  await createUserDocument(user.uid, { name: name.trim(), email: email.trim(), provider: 'email' });
  /* onAuthStateChanged will fire and redirect */
}

/* ═══════════════════════════════════════════════════════════════
   GOOGLE SIGN-IN / SIGN-UP
   ═══════════════════════════════════════════════════════════════ */
/**
 * Signs in with Google popup.
 * Creates a Firestore document only if this is the first sign-in.
 * @returns {Promise<void>}
 */
export async function signInGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);

  const isNew = !(await userDocExists(user.uid));
  if (isNew) {
    await createUserDocument(user.uid, {
      name:     user.displayName || '',
      email:    user.email || '',
      provider: 'google',
    });
  } else {
    await touchLastLogin(user.uid);
  }
  /* onAuthStateChanged will fire and redirect */
}

/* ═══════════════════════════════════════════════════════════════
   FORGOT PASSWORD
   ═══════════════════════════════════════════════════════════════ */
/**
 * Send a password reset email.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function forgotPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

/* ═══════════════════════════════════════════════════════════════
   PASSWORD TOGGLE HELPER
   ═══════════════════════════════════════════════════════════════ */
/**
 * Wire a show/hide toggle button to a password input.
 * @param {HTMLInputElement}  inputEl
 * @param {HTMLButtonElement} toggleBtn
 */
export function initPasswordToggle(inputEl, toggleBtn) {
  if (!inputEl || !toggleBtn) return;

  const eyeOpen = `<svg viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
  const eyeOff  = `<svg viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

  toggleBtn.innerHTML = eyeOpen;
  toggleBtn.setAttribute('aria-label', 'Show password');

  toggleBtn.addEventListener('click', () => {
    const isHidden = inputEl.type === 'password';
    inputEl.type = isHidden ? 'text' : 'password';
    toggleBtn.innerHTML = isHidden ? eyeOff : eyeOpen;
    toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

/* ═══════════════════════════════════════════════════════════════
   FORGOT PASSWORD MODAL
   ═══════════════════════════════════════════════════════════════ */
/**
 * Initialise the forgot password modal.
 * Expects elements: #forgotModal, #forgotModalClose, #forgotEmail,
 *                   #forgotSubmitBtn, #forgotEmailError
 */
export function initForgotPasswordModal(openTrigger) {
  const modal      = document.getElementById('forgotModal');
  const closeBtn   = document.getElementById('forgotModalClose');
  const emailInput = document.getElementById('forgotEmail');
  const submitBtn  = document.getElementById('forgotSubmitBtn');
  const errorEl    = document.getElementById('forgotEmailError');

  if (!modal) return;

  function openModal() {
    if (emailInput) emailInput.value = '';
    if (errorEl)    clearFieldError(emailInput, errorEl);
    modal.classList.add('open');
    if (emailInput) setTimeout(() => emailInput.focus(), 100);
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  if (openTrigger) openTrigger.addEventListener('click', openModal);
  if (closeBtn)    closeBtn.addEventListener('click', closeModal);

  /* Close on backdrop click */
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  /* Close on Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      clearFieldError(emailInput, errorEl);

      if (!email) {
        showFieldError(emailInput, errorEl, 'Please enter your email address.');
        return;
      }
      if (!validateEmail(email)) {
        showFieldError(emailInput, errorEl, 'Please enter a valid email address.');
        return;
      }

      setButtonLoading(submitBtn, true);
      try {
        await forgotPassword(email);
        closeModal();
        showToast('Password reset email sent. Check your inbox.', 'success');
      } catch (err) {
        const msg = friendlyError(err.code);
        showFieldError(emailInput, errorEl, msg);
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    /* Submit on Enter inside the email input */
    emailInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitBtn.click();
    });
  }
}

/* Export friendlyError so pages can use it */
export { friendlyError };
