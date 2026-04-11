/* eslint-env node */
/* global module, process */
/**
 * Default From when SENDGRID_FROM_EMAIL is unset (production).
 * Override with SENDGRID_FROM_EMAIL in functions/.env or Cloud Function config (e.g. temporary testing).
 *
 * If SendGrid shows "Processed" but never "Delivered" for some recipients while others work,
 * check SendGrid trial limits / Single Sender verified recipients / suppressions — not usually an app bug.
 */
const DEFAULT_SENDGRID_FROM_EMAIL = 'support@bestbybites.com';

/**
 * Shared SendGrid API key from env (callable + welcome email).
 * Prefer SENDGRID_MAIL_KEY if SENDGRID_API_KEY is also a Google Cloud Secret name (deploy clash).
 */
function getSendgridApiKey() {
  const raw = process.env.SENDGRID_MAIL_KEY || process.env.SENDGRID_API_KEY;
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  // UTF-8 BOM from some editors
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * @returns {boolean}
 */
function hasSendgridApiKey() {
  return getSendgridApiKey().length > 0;
}

/**
 * Verified sender address in SendGrid (Single Sender or domain auth).
 * @returns {string}
 */
function getSendgridFromEmail() {
  const raw =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM_MAIL ||
    '';
  let s = String(raw).trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s || DEFAULT_SENDGRID_FROM_EMAIL;
}

module.exports = {
  getSendgridApiKey,
  hasSendgridApiKey,
  getSendgridFromEmail,
  DEFAULT_SENDGRID_FROM_EMAIL,
};
