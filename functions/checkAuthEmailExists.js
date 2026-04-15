/* eslint-env node */
/* global module, require */
/**
 * Callable: check if an email is registered in Firebase Auth (Admin SDK).
 * Use this instead of client fetchSignInMethodsForEmail when Email Enumeration Protection
 * is enabled (client API returns empty methods even for registered emails).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const t = email.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

async function runCheckAuthEmailExists(data) {
  const raw = data && data.email != null ? String(data.email).trim() : '';
  if (!isValidEmail(raw)) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid email is required');
  }
  const email = raw.toLowerCase();

  try {
    await admin.auth().getUserByEmail(email);
    return { exists: true };
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      return { exists: false };
    }
    console.error('[checkAuthEmailExists]', err);
    throw new functions.https.HttpsError(
      'internal',
      err && err.message ? err.message : 'Email lookup failed'
    );
  }
}

module.exports = {
  runCheckAuthEmailExists,
};
