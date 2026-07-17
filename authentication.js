/**
 * authentication.js — HIRENT Authentication Controller
 *
 * Connects the Login / Signup UI with auth.js.
 * Does NOT contain any Firebase logic — only imports from auth.js.
 *
 * Architecture:
 *   login.html / signup.html
 *     → authentication.js
 *       → auth.js
 *         → firebase.js
 *           → Firebase
 */

import {
  signInEmail,
  signUpEmail,
  signInGoogle,
  forgotPassword,
  initAuthListener,
  initForgotPasswordModal,
  initPasswordToggle,
  validateEmail,
  isPasswordStrong,
  checkPasswordStrength,
  showFieldError,
  clearFieldError,
  setButtonLoading,
  friendlyError,
  showToast,
} from './auth.js';

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP — run as soon as the module loads
   ═══════════════════════════════════════════════════════════════ */
function boot() {
  /* Auth state listener — redirects to DashboardManager if logged in */
  initAuthListener();

  const page = document.body.dataset.page;

  if (page === 'login') {
    initLogin();
  } else if (page === 'signup') {
    initSignup();
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN PAGE CONTROLLER
   ═══════════════════════════════════════════════════════════════ */
function initLogin() {
  /* ── DOM refs ───────────────────────────────────────────── */
  const form          = document.getElementById('loginForm');
  const emailInput    = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const rememberCheck = document.getElementById('rememberMe');
  const loginBtn      = document.getElementById('loginBtn');
  const googleBtn     = document.getElementById('googleBtn');
  const pwToggle      = document.getElementById('loginPwToggle');
  const forgotTrigger = document.getElementById('forgotPasswordBtn');
  const emailError    = document.getElementById('loginEmailError');
  const passwordError = document.getElementById('loginPasswordError');

  if (!form) return;

  /* ── Password show/hide ─────────────────────────────────── */
  initPasswordToggle(passwordInput, pwToggle);

  /* ── Forgot password modal ──────────────────────────────── */
  initForgotPasswordModal(forgotTrigger);

  /* ── Clear errors on input ──────────────────────────────── */
  emailInput.addEventListener('input', () => clearFieldError(emailInput, emailError));
  passwordInput.addEventListener('input', () => clearFieldError(passwordInput, passwordError));

  /* ── Login form submission ──────────────────────────────── */
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberCheck.checked;
    let hasError   = false;

    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);

    /* Validate email */
    if (!email) {
      showFieldError(emailInput, emailError, 'Please enter your email address.');
      hasError = true;
    } else if (!validateEmail(email)) {
      showFieldError(emailInput, emailError, 'Please enter a valid email address.');
      hasError = true;
    }

    /* Validate password */
    if (!password) {
      showFieldError(passwordInput, passwordError, 'Please enter your password.');
      hasError = true;
    }

    if (hasError) return;

    /* Loading state — prevents double submission */
    setButtonLoading(loginBtn, true);

    try {
      await signInEmail(email, password, remember);
      /* onAuthStateChanged inside auth.js handles the redirect */
    } catch (err) {
      const msg = friendlyError(err.code);
      if (err.code === 'auth/invalid-email' || err.code === 'auth/user-not-found') {
        showFieldError(emailInput, emailError, msg);
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showFieldError(passwordInput, passwordError, msg);
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setButtonLoading(loginBtn, false);
    }
  });

  /* ── Google sign-in ─────────────────────────────────────── */
  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    try {
      await signInGoogle();
      /* onAuthStateChanged handles redirect */
    } catch (err) {
      showToast(friendlyError(err.code), 'error');
    } finally {
      googleBtn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SIGNUP PAGE CONTROLLER
   ═══════════════════════════════════════════════════════════════ */
function initSignup() {
  /* ── DOM refs ───────────────────────────────────────────── */
  const form          = document.getElementById('signupForm');
  const nameInput     = document.getElementById('signupName');
  const emailInput    = document.getElementById('signupEmail');
  const passwordInput = document.getElementById('signupPassword');
  const confirmInput  = document.getElementById('signupConfirmPassword');
  const termsCheck    = document.getElementById('signupTerms');
  const signupBtn     = document.getElementById('signupBtn');
  const googleBtn     = document.getElementById('googleBtn');

  const nameError     = document.getElementById('signupNameError');
  const emailError    = document.getElementById('signupEmailError');
  const passwordError = document.getElementById('signupPasswordError');
  const confirmError  = document.getElementById('signupConfirmError');
  const termsError    = document.getElementById('signupTermsError');

  if (!form) return;

  /* ── Password toggles ───────────────────────────────────── */
  initPasswordToggle(passwordInput, document.getElementById('signupPwToggle'));
  initPasswordToggle(confirmInput,  document.getElementById('signupConfirmToggle'));

  /* ── Live password strength indicators ──────────────────── */
  const ruleEls = {
    length:    document.getElementById('rule-length'),
    number:    document.getElementById('rule-number'),
    uppercase: document.getElementById('rule-uppercase'),
    special:   document.getElementById('rule-special'),
  };

  passwordInput.addEventListener('input', () => {
    clearFieldError(passwordInput, passwordError);
    const results = checkPasswordStrength(passwordInput.value);
    results.forEach(({ id, met }) => {
      const el = ruleEls[id];
      if (el) el.classList.toggle('rule--met', met);
    });
  });

  /* ── Clear errors on input ──────────────────────────────── */
  nameInput.addEventListener('input',    () => clearFieldError(nameInput,    nameError));
  emailInput.addEventListener('input',   () => clearFieldError(emailInput,   emailError));
  confirmInput.addEventListener('input', () => clearFieldError(confirmInput, confirmError));
  termsCheck.addEventListener('change',  () => clearFieldError(termsCheck,   termsError));

  /* ── Signup form submission ─────────────────────────────── */
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name     = nameInput.value.trim();
    const email    = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm  = confirmInput.value;
    const terms    = termsCheck.checked;
    let hasError   = false;

    /* Reset all errors */
    [
      [nameInput, nameError],
      [emailInput, emailError],
      [passwordInput, passwordError],
      [confirmInput, confirmError],
      [termsCheck, termsError],
    ].forEach(([el, errEl]) => clearFieldError(el, errEl));

    /* Validate name */
    if (!name) {
      showFieldError(nameInput, nameError, 'Please enter your full name.');
      hasError = true;
    } else if (name.length < 2) {
      showFieldError(nameInput, nameError, 'Name must be at least 2 characters.');
      hasError = true;
    }

    /* Validate email */
    if (!email) {
      showFieldError(emailInput, emailError, 'Please enter your email address.');
      hasError = true;
    } else if (!validateEmail(email)) {
      showFieldError(emailInput, emailError, 'Please enter a valid email address.');
      hasError = true;
    }

    /* Validate password strength */
    if (!password) {
      showFieldError(passwordInput, passwordError, 'Please create a password.');
      hasError = true;
    } else if (!isPasswordStrong(password)) {
      showFieldError(passwordInput, passwordError, 'Password does not meet all requirements.');
      hasError = true;
    }

    /* Validate confirm password */
    if (!confirm) {
      showFieldError(confirmInput, confirmError, 'Please confirm your password.');
      hasError = true;
    } else if (password && confirm !== password) {
      showFieldError(confirmInput, confirmError, 'Passwords do not match.');
      hasError = true;
    }

    /* Validate terms */
    if (!terms) {
      showFieldError(termsCheck, termsError, 'You must agree to the Terms of Service and Privacy Policy.');
      hasError = true;
    }

    if (hasError) return;

    /* Loading state */
    setButtonLoading(signupBtn, true);

    try {
      await signUpEmail(name, email, password);
      /* onAuthStateChanged inside auth.js handles the redirect */
    } catch (err) {
      const msg = friendlyError(err.code);
      if (err.code === 'auth/email-already-in-use') {
        showFieldError(emailInput, emailError, msg);
      } else if (err.code === 'auth/weak-password') {
        showFieldError(passwordInput, passwordError, msg);
      } else if (err.code === 'auth/invalid-email') {
        showFieldError(emailInput, emailError, msg);
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setButtonLoading(signupBtn, false);
    }
  });

  /* ── Google sign-up ──────────────────────────────────────── */
  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    try {
      await signInGoogle();
    } catch (err) {
      showToast(friendlyError(err.code), 'error');
    } finally {
      googleBtn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   INITIALISE
   ═══════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
