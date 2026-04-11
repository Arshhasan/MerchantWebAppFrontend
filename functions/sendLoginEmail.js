/* eslint-env node */
/* global module, require */
/**
 * Callable (legacy): was used to generate an email link with Admin SDK and send it via SendGrid.
 * The merchant web app now uses the client SDK `sendSignInLinkToEmail` (Firebase default email).
 *
 * This handler is kept deployed so old clients get a clear error instead of `functions/not-found`.
 * continueUrl: only validated as a valid http(s) URL when callers still hit this endpoint.
 */

const functions = require('firebase-functions/v1');

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const t = email.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/**
 * @param {string} urlString
 * @returns {void}
 */
function assertAllowedContinueUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid continueUrl');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'continueUrl must use http or https'
    );
  }
}

/**
 * @param {object} data
 * @returns {Promise<{ success: boolean }>}
 */
async function runSendLoginEmail(data) {
  try {
    const email = data && data.email != null ? String(data.email).trim() : '';
    const continueUrl =
      data && data.continueUrl != null
        ? String(data.continueUrl).trim()
        : '';

    if (!isValidEmail(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required');
    }

    if (!continueUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'continueUrl is required (e.g. https://your-app.com/email-link-handler)'
      );
    }

    assertAllowedContinueUrl(continueUrl);

    throw new functions.https.HttpsError(
      'failed-precondition',
      'Login links are sent with Firebase Auth email from the app (sendSignInLinkToEmail). ' +
        'Update the merchant web app to the latest version. SendGrid login mail is disabled on the server.'
    );

    /*
     * --- Previous implementation: Admin SDK link + SendGrid (disabled) ---
     *
     * const { getSendgridApiKey, getSendgridFromEmail } = require('./sendgridEnv');
     * const sgMail = require('@sendgrid/mail');
     * const apiKey = getSendgridApiKey();
     * if (!apiKey) { ... }
     * const loginLink = await admin.auth().generateSignInWithEmailLink(email, {
     *   url: continueUrl,
     *   handleCodeInApp: true,
     * });
     * const { text, html } = buildEmailPayload(displayName, loginLink);
     * await sgMail.send({ to: email, from: { email: fromEmail, name: 'BestbyBites' }, ... });
     * return { success: true };
     */
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('[sendLoginEmail] unexpected', err);
    throw new functions.https.HttpsError(
      'internal',
      err && err.message ? err.message : 'Unexpected error'
    );
  }
}

module.exports = {
  runSendLoginEmail,
};
