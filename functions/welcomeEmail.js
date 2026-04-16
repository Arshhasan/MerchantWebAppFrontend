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
const { buildInlineLogo, LOGO_FILE } = require('./emailLogo');

/** Match customer-facing order emails (same address) so Gmail shows one trusted brand. */
const FROM_NAME = 'BestbyBites';
const APP_NAME = 'Best By Bites';
const MERCHANT_LABEL = 'MERCHANT';
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
  // Match the merchant auth email theme (clean white card + compact green header).
  const outerBg = '#f3f4f6';
  const headerBg = '#0b3d1b';
  const cardBg = '#ffffff';
  const border = '#e5e7eb';
  const textDark = '#111827';
  const textMuted = '#6b7280';
  const ctaGreen = '#03c55b';
  const badgeBg = '#dcfce7';
  const badgeText = '#166534';

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeApp} ${escapeHtml(MERCHANT_LABEL)}" height="128" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;height:128px;width:auto;max-width:560px;" />`
    : `<p style="margin:0;color:#ffffff;font-size:18px;font-weight:800;line-height:1.1;">${safeApp}</p><p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:0.12em;line-height:1.2;">${escapeHtml(MERCHANT_LABEL)}</p>`;

  const ctaRow = dashboardUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px auto 0 auto;">
        <tr>
          <td style="border-radius:999px;background:${ctaGreen};">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:800;color:#ffffff !important;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
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
<body style="margin:0;padding:0;background:${outerBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${outerBg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${cardBg};border-radius:12px;overflow:hidden;border:1px solid ${border};box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:${headerBg};padding:10px 20px;text-align:center;line-height:0;font-size:0;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 26px;text-align:center;">
              <span style="display:inline-block;background:${badgeBg};color:${badgeText};font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;">Welcome</span>
              <h1 style="margin:14px 0 0;color:${headerBg};font-size:24px;font-weight:900;line-height:1.25;">Hi ${safeName},</h1>
              <p style="margin:10px 0 0;color:${textMuted};font-size:15px;line-height:1.6;">
                Your store <strong style="color:${textDark};">${safeStore}</strong> is set up on ${safeApp} Merchant.
              </p>
              <p style="margin:10px 0 0;color:${textMuted};font-size:15px;line-height:1.6;">
                You can manage Surprise Bags, orders, and your outlet anytime from the dashboard.
              </p>
              
              <p style="margin:22px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                If you did not create this store, you can ignore this email or contact support.
              </p>
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
