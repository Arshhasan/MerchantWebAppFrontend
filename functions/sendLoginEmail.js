/* eslint-env node */
/* global module, require, process */
/**
 * Callable: generate Firebase email-link with Admin SDK, send via SendGrid only.
 * Do NOT call sendSignInLinkToEmail from the client — that sends Firebase's default email.
 *
 * SendGrid key: read SENDGRID_MAIL_KEY or SENDGRID_API_KEY (process.env).
 * Use SENDGRID_MAIL_KEY in functions/.env if Gen2 functions still have a Secret named SENDGRID_API_KEY
 * (deploying plain SENDGRID_API_KEY from .env overlaps that secret and fails with HTTP 400).
 * After removing the old secret, you may use SENDGRID_API_KEY in .env only.
 * Optional: ALLOWED_EMAIL_LINK_ORIGINS — comma-separated URL prefixes (e.g. https://app.com,http://localhost:5173)
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

/** Must match a verified sender in SendGrid (Single Sender or domain auth). */
const FROM_EMAIL = 'support@bestbybites.com';
const APP_NAME = 'BestByBites';

/**
 * Read SendGrid key from env (deploy: functions/.env → `firebase deploy` injects into the function).
 * Trims whitespace; strips accidental quotes from .env.
 * @returns {string}
 */
function getSendgridApiKey() {
  const raw = process.env.SENDGRID_MAIL_KEY || process.env.SENDGRID_API_KEY;
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}
const BUTTON_COLOR = '#10b981';
/** Firebase default sign-in links are short-lived; align messaging with Auth settings. */
const LINK_TTL_MINUTES = 10;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

  const raw = process.env.ALLOWED_EMAIL_LINK_ORIGINS || '';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const merchantOrigin = (process.env.MERCHANT_APP_ORIGIN || '').replace(/\/$/, '');

  if (allowed.length === 0) {
    const localHttp =
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    if (localHttp) return;
    if (merchantOrigin && urlString.startsWith(merchantOrigin)) return;
    // Any other HTTPS URL: Firebase Auth still validates `continueUrl` against
    // Authentication → Settings → Authorized domains when generating the link.
    if (u.protocol === 'https:') return;
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Use an https continueUrl, or http://localhost for dev, or set MERCHANT_APP_ORIGIN / ' +
        'ALLOWED_EMAIL_LINK_ORIGINS on this function.'
    );
  }

  const ok = allowed.some((prefix) => urlString.startsWith(prefix));
  if (!ok) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'continueUrl is not in ALLOWED_EMAIL_LINK_ORIGINS'
    );
  }
}

/**
 * @param {string} email
 * @param {string} continueUrl
 * @returns {Promise<string>}
 */
async function buildFirebaseSignInLink(email, continueUrl) {
  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };
  return admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);
}

function buildEmailPayload(name, loginUrl) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = loginUrl;

  const text = [
    `${APP_NAME}`,
    '',
    `Hi ${name || 'there'},`,
    '',
    'Click below to securely log in.',
    '',
    safeUrl,
    '',
    `This link expires in ${LINK_TTL_MINUTES} minutes.`,
    '',
    'If you did not request this email, you can safely ignore it. Do not share this link with anyone.',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login to ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:28px 28px 8px 28px;font-size:15px;color:#18181b;line-height:1.6;">
              <div style="font-size:13px;font-weight:600;letter-spacing:0.06em;color:#71717a;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(APP_NAME)}</div>
              <p style="margin:0 0 16px 0;">Hi ${safeName},</p>
              <p style="margin:0 0 24px 0;">Click below to securely log in</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="border-radius:8px;background:${BUTTON_COLOR};">
                    <a href="${escapeHtml(safeUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Login to your account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Or copy and paste this link into your browser:</p>
              <p style="margin:0 0 20px 0;font-size:12px;word-break:break-all;color:#52525b;">${escapeHtml(safeUrl)}</p>
              <p style="margin:0 0 12px 0;font-size:13px;color:#71717a;">This link expires in ${LINK_TTL_MINUTES} minutes.</p>
              <p style="margin:0;font-size:13px;color:#71717a;">For your security, never forward this email. If you did not request a login link, you can ignore this message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { text, html };
}

/**
 * @param {object} data
 * @returns {Promise<{ success: boolean }>}
 */
async function runSendLoginEmail(data) {
  try {
    const email = data && data.email != null ? String(data.email).trim() : '';
    const name = data && data.name != null ? String(data.name).trim() : '';
    const continueUrl =
      data && data.continueUrl != null
        ? String(data.continueUrl).trim()
        : '';

    if (!isValidEmail(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required');
    }

    const displayName = name || email.split('@')[0] || 'there';

    if (!continueUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'continueUrl is required (e.g. https://your-app.com/email-link-handler)'
      );
    }

    assertAllowedContinueUrl(continueUrl);

    const apiKey = getSendgridApiKey();
    if (!apiKey) {
      console.error('[sendLoginEmail] Missing SENDGRID_MAIL_KEY or SENDGRID_API_KEY in process.env');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Missing SENDGRID_MAIL_KEY at runtime. Fix: (1) From project root run: firebase deploy --only functions:sendLoginEmail ' +
          'with functions/.env present on that machine, OR (2) Google Cloud Console → Cloud Functions → sendLoginEmail → ' +
          'Edit → Runtime environment variables → add SENDGRID_MAIL_KEY = your SG.xxx key → Deploy.'
      );
    }
    if (!/^SG\./.test(apiKey)) {
      console.warn('[sendLoginEmail] API key does not start with SG.; SendGrid keys usually look like SG.xxx');
    }

    let loginLink;
    try {
      loginLink = await buildFirebaseSignInLink(email, continueUrl);
    } catch (authErr) {
      const code =
        (authErr && authErr.code) ||
        (authErr && authErr.errorInfo && authErr.errorInfo.code);
      const msg = (authErr && authErr.message) || String(authErr);
      console.error('[sendLoginEmail] generateSignInWithEmailLink failed', { code, msg });
      if (code === 'auth/invalid-continue-uri' || /continue[- ]uri/i.test(msg)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Add your site domain to Firebase Console → Authentication → Settings → Authorized domains, ' +
            'and ensure the continue URL matches (same origin as this app).'
        );
      }
      if (code === 'auth/operation-not-allowed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Enable Email link (passwordless) sign-in in Firebase Console → Authentication → Sign-in method.'
        );
      }
      throw new functions.https.HttpsError(
        'internal',
        `Could not create sign-in link: ${msg}`
      );
    }

    const { text, html } = buildEmailPayload(displayName, loginLink);

    sgMail.setApiKey(apiKey);
    try {
      await sgMail.send({
        to: email,
        from: FROM_EMAIL,
        subject: `Login to ${APP_NAME}`,
        text,
        html,
      });
    } catch (sgErr) {
      const status =
        sgErr?.response?.statusCode ||
        sgErr?.response?.status ||
        sgErr?.code;
      const body = sgErr?.response?.body;
      const msg = (sgErr && sgErr.message) || String(sgErr);
      console.error('[sendLoginEmail] SendGrid error', {
        status,
        message: msg,
        body: typeof body === 'object' ? JSON.stringify(body) : body,
      });

      const isUnauthorized =
        status === 401 ||
        Number(status) === 401 ||
        /401|Unauthorized/i.test(String(msg));

      if (isUnauthorized) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'SendGrid returned 401 Unauthorized: the API key is invalid, expired, or lacks Mail Send. ' +
            'In SendGrid → Settings → API Keys, create a new Full Access key (or one with Mail Send). ' +
            'Set functions/.env to SENDGRID_MAIL_KEY=SG.your_key (one line, no quotes), then ' +
            'firebase deploy --only functions:sendLoginEmail. ' +
            'If it still fails, add SENDGRID_MAIL_KEY in Google Cloud → Cloud Functions → sendLoginEmail → Edit → Runtime environment variables.'
        );
      }

      throw new functions.https.HttpsError(
        'failed-precondition',
        `SendGrid error (${status || 'unknown'}). From address must be support@bestbybites.com (verified). ${msg}`
      );
    }

    return { success: true };
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
