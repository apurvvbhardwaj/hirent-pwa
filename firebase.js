/**
 * firebase.js — HIRENT Firebase Initialization
 *
 * Replace the firebaseConfig object with your real Firebase project
 * credentials from: Firebase Console → Project Settings → General → Your apps
 *
 * All other files import from this module — never import firebase/app twice.
 */

import { initializeApp }         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }               from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─────────────────────────────────────────────────────────────────────────────
// REPLACE THESE VALUES with your Firebase project configuration.
// Firebase Console → Project Settings → General → SDK snippet → Config
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_AUTH_DOMAIN',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
// ─────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
