/* eslint-env node */
/* global module, require */
/**
 * Callable: generate Firebase email sign-in link (Admin SDK) and send via SendGrid
 * using the branded HTML template in magicLinkEmailTemplate.js.
 *
 * Env: SENDGRID_MAIL_KEY or SENDGRID_API_KEY, SENDGRID_FROM_EMAIL (optional),
 * MERCHANT_APP_ORIGIN (logo + footer links).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const { getSendgridApiKey, getSendgridFromEmail } = require('./sendgridEnv');
const { buildMagicLinkEmail } = require('./magicLinkEmailTemplate');

const FROM_NAME = 'Bestby Bites';

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
    const displayName =
      data && data.displayName != null ? String(data.displayName).trim() : '';
    const variantRaw = data && data.variant != null ? String(data.variant).trim().toLowerCase() : '';
    const variant = variantRaw === 'signup' ? 'signup' : 'login';

    if (!isValidEmail(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required');
    }

    if (!continueUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'continueUrl is required (e.g. https://your-app.com/merchant/email-link-handler)'
      );
    }

    assertAllowedContinueUrl(continueUrl);

    const apiKey = getSendgridApiKey();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'SendGrid is not configured (set SENDGRID_MAIL_KEY or SENDGRID_API_KEY for the login email).'
      );
    }

    const loginLink = await admin.auth().generateSignInWithEmailLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });

    const { subject, html, text, attachments } = buildMagicLinkEmail({
      signInLink: loginLink,
      displayName: displayName || undefined,
      variant,
    });

    sgMail.setApiKey(apiKey);
    const fromEmail = getSendgridFromEmail();

    await sgMail.send({
      to: email,
      from: { email: fromEmail, name: FROM_NAME },
      subject,
      text,
      html,
      ...(attachments ? { attachments } : {}),
    });

    return { success: true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('[sendLoginEmail]', err);
    throw new functions.https.HttpsError(
      'internal',
      err && err.message ? err.message : 'Failed to send login email'
    );
  }
}

module.exports = {
  runSendLoginEmail,
};
