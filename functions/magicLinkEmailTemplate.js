/* eslint-env node */
/* global module, process */
/**
 * HTML + plain text for passwordless sign-in / sign-up emails (SendGrid).
 * Matches merchant-facing “Bestby Bites” card layout (dark green header, CTA, security note).
 */

const LOGO_FILE = 'logo-bestbbybites-merchant-dark-photoroom.png';

/**
 * @returns {string}
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
      s = `https://${pid}.web.app/merchant`;
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
  return `${origin}/${LOGO_FILE}`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * @returns {string}
 */
function getWebsiteUrl() {
  const base = getMerchantAppBaseUrl();
  if (!base) return 'https://bestbybites.com';
  try {
    const u = new URL(base);
    return `${u.origin}/`;
  } catch {
    return base;
  }
}

/**
 * Escape for HTML text nodes.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ signInLink: string, displayName?: string, variant?: 'login' | 'signup' }} opts
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildMagicLinkEmail(opts) {
  const signInLink = opts.signInLink || '';
  const displayName = (opts.displayName || '').trim();
  const variant = opts.variant === 'signup' ? 'signup' : 'login';

  const subject =
    variant === 'signup'
      ? 'Complete your BestbyBites merchant signup'
      : 'Sign in to BestbyBites';

  const headline = variant === 'signup' ? 'Welcome!' : 'Welcome Back!';
  const bodyLine =
    variant === 'signup'
      ? 'Tap the button below to securely finish setting up your BestbyBites merchant account. No password needed.'
      : 'Tap the button below to securely sign in to your BestbyBites account. No password needed.';
  const ctaLabel = variant === 'signup' ? 'Continue to My Account →' : 'Sign In to My Account →';

  const greeting = displayName
    ? `Hi ${escapeHtml(displayName)},`
    : '';
  const greetingText = displayName ? `Hi ${displayName},` : '';

  const logoUrl = getLogoUrl();
  const websiteUrl = getWebsiteUrl();
  const year = new Date().getFullYear();

  const headerBg = '#0b3d1b';
  const ctaGreen = '#03c55b';
  const badgeBg = '#dcfce7';
  const badgeText = '#166534';
  const textDark = '#111827';
  const textMuted = '#6b7280';
  const boxBorder = '#e5e7eb';
  const cardBg = '#ffffff';
  const outerBg = '#f3f4f6';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${outerBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(bodyLine)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${outerBg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${cardBg};border-radius:12px 12px 0 0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:${headerBg};padding:28px 20px;text-align:center;">
              ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Bestby Bites" width="160" style="max-width:200px;height:auto;display:block;margin:0 auto;" />` : `<p style="margin:0;color:#fff;font-size:20px;font-weight:800;">bestby bites</p><p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:0.12em;">FOOD MARKETPLACE</p>`}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;text-align:center;">
              <span style="display:inline-block;background:${badgeBg};color:${badgeText};font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;">Secure Sign-In</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;text-align:center;">
              <h1 style="margin:0;color:${headerBg};font-size:26px;font-weight:800;line-height:1.25;">${headline}</h1>
            </td>
          </tr>
          ${greeting ? `<tr><td style="padding:12px 24px 0;text-align:center;"><p style="margin:0;color:${textDark};font-size:15px;">${greeting}</p></td></tr>` : ''}
          <tr>
            <td style="padding:16px 24px 8px;text-align:center;">
              <p style="margin:0;color:${textMuted};font-size:15px;line-height:1.55;">${escapeHtml(bodyLine)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px;text-align:center;">
              <a href="${escapeHtml(signInLink)}" style="display:inline-block;background:${ctaGreen};color:#ffffff !important;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px;box-shadow:0 4px 14px rgba(3,197,91,0.35);">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${boxBorder};border-radius:10px;background:#fafafa;">
                <tr>
                  <td style="padding:14px 16px;text-align:center;font-size:13px;color:${textMuted};line-height:1.5;">
                    This link is <strong style="color:${textDark};">secure</strong>, <strong style="color:${textDark};">expires in 1 hour</strong>, and can only be used <strong style="color:${textDark};">once</strong>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${boxBorder};border-radius:10px;background:#f9fafb;">
                <tr>
                  <td style="padding:14px 16px;text-align:center;font-size:13px;color:${textMuted};line-height:1.55;">
                    <strong style="color:${textDark};display:block;margin-bottom:6px;">Didn&apos;t request this?</strong>
                    If you didn&apos;t try to sign in, you can safely ignore this email. Your account is secure.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin-top:4px;">
          <tr>
            <td style="padding:20px 16px 28px;text-align:center;">
              <p style="margin:0 0 8px;color:${headerBg};font-size:15px;font-weight:800;">Bestby Bites</p>
              <p style="margin:0 0 12px;font-size:13px;">
                <a href="${escapeHtml(websiteUrl)}" style="color:${ctaGreen};font-weight:600;text-decoration:none;">Website</a>
                <span style="color:#d1d5db;margin:0 10px;">|</span>
                <a href="mailto:support@bestbybites.com" style="color:${ctaGreen};font-weight:600;text-decoration:none;">Support</a>
              </p>
              <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;">&copy; ${year} Bestby Bites. All rights reserved.</p>
              <p style="margin:0;color:#9ca3af;font-size:11px;">Save Food. Save Money.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    subject,
    '',
    headline,
    greetingText,
    bodyLine,
    '',
    `Sign in: ${signInLink}`,
    '',
    'This link is secure, expires in 1 hour, and can only be used once.',
    '',
    "Didn't request this? If you didn't try to sign in, you can safely ignore this email.",
    '',
    `Bestby Bites | ${websiteUrl} | support@bestbybites.com`,
    `© ${year} Bestby Bites. Save Food. Save Money.`,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join('\n');

  return { subject, html, text };
}

module.exports = {
  buildMagicLinkEmail,
  getMerchantAppBaseUrl,
};
