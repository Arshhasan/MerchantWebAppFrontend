/**
 * SendGrid welcome email when merchant onboarding completes (store has title + resolvable email).
 * Recipient: vendors.email, else users/{author}.email, else Firebase Auth user record.
 * Uses inline HTML (dark theme + logo URL) — no SendGrid dashboard template required.
 *
 * Env:
 * - SENDGRID_MAIL_KEY or SENDGRID_API_KEY
 * - MERCHANT_APP_ORIGIN (e.g. https://yourdomain.com/merchant) — used for dashboard links
 *   (logo/static assets use origin only, e.g. https://yourdomain.com/logo.png)
 */
/* eslint-env node */
/* global module, require, process */

const sgMail = require('@sendgrid/mail');
const { getSendgridFromEmail } = require('./sendgridEnv');
const { buildInlineLogo } = require('./emailLogo');

/** Match customer-facing order emails (same address) so Gmail shows one trusted brand. */
const FROM_NAME = 'BestbyBites';
const APP_NAME = 'Best By Bites';
const MERCHANT_LABEL = 'MERCHANT';
const LOGO_FILE = 'best-by-bites-final-logo-white.png';

/** Dark theme — aligns with merchant logo (green on black). */
const BG = '#000000';
const CARD_BG = '#0c0c0e';
const BORDER = '#27272a';
const TEXT = '#fafafa';
const MUTED = '#a1a1aa';
const ACCENT = '#22c55e';

/**
 * @returns {string} base URL without trailing slash
 */
function getMerchantAppBaseUrl() {
  const raw =
    process.env.MERCHANT_APP_ORIGIN ||
    process.env.MERCHANT_APP_PUBLIC_URL ||
    '';
  let s = String(raw).trim().replace(/\/$/, '');
  if (!s) {
    const pid = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
    if (pid) {
      s = `https://${pid}.web.app/merchant`.replace(/\/$/, '');
    }
  }
  return s;
}

/**
 * Origin used for static assets in emails (must not include SPA routes like /merchant).
 * @returns {string}
 */
function getMerchantAppOrigin() {
  const raw =
    process.env.MERCHANT_APP_ORIGIN ||
    process.env.MERCHANT_APP_PUBLIC_URL ||
    '';
  const s = String(raw).trim();
  if (s) {
    try {
      return new URL(s).origin;
    } catch {
      // Fall through to project-id based default.
    }
  }
  const pid = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
  return pid ? `https://${pid}.web.app` : '';
}

/**
 * @returns {string}
 */
function getLogoUrl() {
  const origin = getMerchantAppOrigin();
  if (!origin) return '';
  return `${origin}/${LOGO_FILE}`;
}

/**
 * @returns {string}
 */
function getDashboardUrl() {
  const base = getMerchantAppBaseUrl();
  if (!base) return '';
  return `${base}/dashboard`;
}

/**
 * @param {string|undefined} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (email == null) return false;
  const trimmed = String(email).trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * @param {*} auth firebase-admin auth()
 * @param {*} db firestore
 * @param {object|null|undefined} vendorData
 * @returns {Promise<{ email: string, source: 'vendor'|'users'|'auth' } | null>}
 */
async function resolveWelcomeRecipientEmail(auth, db, vendorData) {
  if (!vendorData || typeof vendorData !== 'object') return null;

  if (isValidEmail(vendorData.email)) {
    return { email: String(vendorData.email).trim(), source: 'vendor' };
  }

  const uid =
    vendorData.author != null ? String(vendorData.author).trim() : '';
  if (!uid) return null;

  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists) {
      const u = userSnap.data() || {};
      const fromUser = [u.email, u.userEmail, u.mail].find((x) => isValidEmail(x));
      if (fromUser) {
        return { email: String(fromUser).trim(), source: 'users' };
      }
    }
  } catch (err) {
    console.warn('[welcomeEmail] users/{author} lookup failed', {
      message: err && err.message,
    });
  }

  try {
    const record = await auth.getUser(uid);
    if (record.email && isValidEmail(record.email)) {
      return { email: record.email.trim(), source: 'auth' };
    }
  } catch (err) {
    console.warn('[welcomeEmail] auth.getUser failed', {
      uid,
      message: err && err.message,
    });
  }

  return null;
}

/**
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ name: string, storeName: string, logoUrl: string, dashboardUrl: string }} p
 * @returns {{ html: string, text: string }}
 */
function buildWelcomeEmailContent({ name, storeName, logoUrl, dashboardUrl }) {
  const safeName = escapeHtml(name);
  const safeStore = escapeHtml(storeName);
  const safeApp = escapeHtml(APP_NAME);
  const ctaLabel = 'Open merchant dashboard';
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeApp} ${escapeHtml(MERCHANT_LABEL)}" width="200" style="display:block;margin:0 auto 24px auto;max-width:200px;height:auto;" />`
    : `<p style="margin:0 0 24px 0;font-size:20px;font-weight:700;color:${ACCENT};letter-spacing:0.04em;text-align:center;">${safeApp}<br/><span style="font-size:12px;font-weight:600;color:${MUTED};">${escapeHtml(MERCHANT_LABEL)}</span></p>`;

  const ctaRow = dashboardUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 0 auto;">
        <tr>
          <td style="border-radius:10px;background:${ACCENT};">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#052e16;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
      </table>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome — ${safeApp}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:${CARD_BG};border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:36px 28px 32px 28px;font-size:15px;color:${TEXT};line-height:1.65;">
              ${logoBlock}
              <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;letter-spacing:0.12em;color:${ACCENT};text-transform:uppercase;text-align:center;">Welcome</p>
              <p style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:${TEXT};text-align:center;">Hi ${safeName},</p>
              <p style="margin:0 0 12px 0;color:${MUTED};text-align:center;">Your store <strong style="color:${TEXT};">${safeStore}</strong> is set up on ${safeApp} Merchant.</p>
              <p style="margin:0;color:${MUTED};text-align:center;">You can manage surprise bags, orders, and your outlet anytime from the dashboard.</p>
              ${ctaRow}
              <p style="margin:32px 0 0 0;font-size:12px;color:${MUTED};text-align:center;line-height:1.5;">If you did not create this store, you can ignore this email or contact support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `${APP_NAME} Merchant`,
    '',
    `Hi ${name},`,
    '',
    `Your store "${storeName}" is set up on ${APP_NAME} Merchant.`,
    'Manage surprise bags, orders, and your outlet from the dashboard.',
    dashboardUrl ? `\n${ctaLabel}: ${dashboardUrl}` : '',
    '',
    'If you did not create this store, you can ignore this email.',
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}

/**
 * @param {string} apiKey
 * @param {{ to: string, name: string, storeName: string }} params
 * @returns {Promise<{ statusCode?: number, messageId?: string }>}
 */
async function sendWelcomeEmail(apiKey, { to, name, storeName }) {
  const base = getMerchantAppBaseUrl();
  if (!base) {
    console.error(
      '[welcomeEmail] MERCHANT_APP_ORIGIN (or MERCHANT_APP_PUBLIC_URL) is required for logo and dashboard links'
    );
  }

  const inline = buildInlineLogo('merchant-logo');
  const logoUrl = inline?.logoSrc || getLogoUrl();
  const dashboardUrl = getDashboardUrl();
  const { html, text } = buildWelcomeEmailContent({
    name,
    storeName: storeName || name,
    logoUrl,
    dashboardUrl,
  });

  const fromEmail = getSendgridFromEmail();
  sgMail.setApiKey(apiKey);
  try {
    const [response] = await sgMail.send({
      to: to.trim(),
      from: { email: fromEmail, name: FROM_NAME },
      replyTo: fromEmail,
      // Transactional-style subject (less “marketing”) tends to land in Primary vs Promotions.
      subject: `${storeName || 'Your store'} is ready — BestbyBites Merchant`,
      text,
      html,
      ...(inline ? { attachments: inline.attachments } : {}),
    });
    const statusCode = response && response.statusCode;
    const rawId =
      response &&
      response.headers &&
      (response.headers['x-message-id'] || response.headers['X-Message-Id']);
    const messageId =
      typeof rawId === 'string' ? rawId.trim().replace(/^<|>$/g, '') : undefined;
    console.log('[welcomeEmail] SendGrid accepted welcome message', {
      to: to.trim(),
      statusCode,
      messageId: messageId || null,
    });
    return { statusCode, messageId };
  } catch (sgErr) {
    const status =
      sgErr?.response?.statusCode ||
      sgErr?.response?.status ||
      sgErr?.code;
    const body = sgErr?.response?.body;
    const msg = (sgErr && sgErr.message) || String(sgErr);
    console.error('[welcomeEmail] SendGrid send failed', {
      status,
      message: msg,
      body: typeof body === 'object' ? JSON.stringify(body) : body,
    });
    throw sgErr;
  }
}

/**
 * Whether this vendor/store document should receive the welcome email (onboarding-ready).
 * Email may be resolved later via users/{author} or Auth if missing on the vendor doc.
 * @param {FirebaseFirestore.DocumentData|undefined|null} data
 * @returns {boolean}
 */
function isEligibleForWelcomeEmail(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.welcomeEmailSent === true) return false;
  if (!String(data.title || '').trim()) return false;
  if (isValidEmail(data.email)) return true;
  const uid = data.author != null ? String(data.author).trim() : '';
  return !!uid;
}

module.exports = {
  isValidEmail,
  extractDisplayName,
  sendWelcomeEmail,
  buildWelcomeEmailContent,
  getMerchantAppBaseUrl,
  getLogoUrl,
  getDashboardUrl,
  isEligibleForWelcomeEmail,
  resolveWelcomeRecipientEmail,
  getSendgridFromEmail,
  FROM_NAME,
  LOGO_FILE,
};
