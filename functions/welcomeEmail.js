/**
 * SendGrid welcome email for new store / merchant onboarding.
 * API key: SENDGRID_MAIL_KEY or SENDGRID_API_KEY (functions/.env — same as sendLoginEmail).
 * Template: dynamic SendGrid template with {{name}}.
 */
/* eslint-env node */
/* global module, require */

const sgMail = require('@sendgrid/mail');

const TEMPLATE_ID = 'd-b9676d2e0f7440bf9d2f067e902b8e21';
const FROM_EMAIL = 'support@bestbybites.com';

/**
 * @param {string|undefined} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Practical validation (not full RFC 5322)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(trimmed);
}

/**
 * Prefer explicit `name`; fall back to store fields used in this app (`title`, etc.).
 * @param {FirebaseFirestore.DocumentData|null|undefined} data
 * @returns {string}
 */
function extractDisplayName(data) {
  if (!data || typeof data !== 'object') return 'Merchant';
  const candidates = [
    data.name,
    data.title,
    data.storeName,
    data.store_name,
    data.displayName,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'Merchant';
}

/**
 * @param {string} apiKey SendGrid API key
 * @param {{ to: string, name: string }} params
 * @returns {Promise<void>}
 */
async function sendWelcomeEmail(apiKey, { to, name }) {
  sgMail.setApiKey(apiKey);
  const msg = {
    to: to.trim(),
    from: FROM_EMAIL,
    templateId: TEMPLATE_ID,
    dynamicTemplateData: {
      name,
    },
  };
  await sgMail.send(msg);
}

/**
 * Firestore onCreate handler body (v2).
 * @param {*} event
 * @param {string} apiKey
 * @param {string} logLabel e.g. vendors/abc
 * @returns {Promise<void>}
 */
async function processWelcomeEmailEvent(event, apiKey, logLabel) {
  const snapshot = event.data;
  if (!snapshot) {
    console.error('[welcomeEmail] No document snapshot', { logLabel });
    return;
  }

  const data = snapshot.data();
  const emailRaw = data && data.email != null ? String(data.email) : '';
  const email = emailRaw.trim();

  if (!isValidEmail(email)) {
    console.warn('[welcomeEmail] Skipping: missing or invalid email', {
      logLabel,
      email: emailRaw || '(empty)',
    });
    return;
  }

  const name = extractDisplayName(data);

  try {
    await sendWelcomeEmail(apiKey, { to: email, name });
    console.log('[welcomeEmail] Success', { logLabel, email, name });
  } catch (err) {
    console.error('[welcomeEmail] SendGrid error', {
      logLabel,
      email,
      message: err && err.message,
      code: err && err.code,
    });
    throw err;
  }
}

module.exports = {
  isValidEmail,
  extractDisplayName,
  sendWelcomeEmail,
  processWelcomeEmailEvent,
  FROM_EMAIL,
  TEMPLATE_ID,
};
