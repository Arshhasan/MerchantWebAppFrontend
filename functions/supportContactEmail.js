/* eslint-env node */
/* global module, require */

const functions = require('firebase-functions/v1');
const sgMail = require('@sendgrid/mail');
const { getSendgridApiKey, getSendgridFromEmail } = require('./sendgridEnv');

const SUPPORT_EMAIL = 'support@bestbybites.com';
const FROM_NAME = 'Bestby Bites Support';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function cleanField(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

async function runSupportContactEmail(data) {
  try {
    const fullName = cleanField(data && data.fullName, 120);
    const email = cleanField(data && data.email, 160).toLowerCase();
    const phone = cleanField(data && data.phone, 40);
    const address = cleanField(data && data.address, 240);
    const subject = cleanField(data && data.subject, 180);
    const message = cleanField(data && data.message, 4000);
    const company = cleanField(data && data.company, 120);
    const honeypot = cleanField(data && data.website, 120);

    if (honeypot) {
      return { success: true };
    }
    if (!fullName) {
      throw new functions.https.HttpsError('invalid-argument', 'Full name is required.');
    }
    if (!isValidEmail(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
    }
    if (!subject) {
      throw new functions.https.HttpsError('invalid-argument', 'Subject is required.');
    }
    if (!message) {
      throw new functions.https.HttpsError('invalid-argument', 'Message is required.');
    }

    const apiKey = getSendgridApiKey();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Support email service is not configured.'
      );
    }

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,sans-serif;color:#163126;">
    <table role="presentation" width="100%" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #d9e6de;">
      <tr>
        <td style="background:#0b3d2e;padding:24px 28px;color:#ffffff;">
          <div style="font-size:28px;font-weight:800;line-height:1.1;">New Support Request</div>
          <div style="margin-top:8px;font-size:15px;color:rgba(255,255,255,0.82);">Submitted from the merchant auth contact page.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;width:160px;font-weight:700;color:#0b3d2e;">Full name</td>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;color:#48605a;">${escapeHtml(fullName)}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;font-weight:700;color:#0b3d2e;">Email</td>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;color:#48605a;">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;font-weight:700;color:#0b3d2e;">Phone</td>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;color:#48605a;">${escapeHtml(phone || '—')}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;font-weight:700;color:#0b3d2e;">Address</td>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;color:#48605a;">${escapeHtml(address || '—')}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;font-weight:700;color:#0b3d2e;">Company</td>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;color:#48605a;">${escapeHtml(company || '—')}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;font-weight:700;color:#0b3d2e;">Subject</td>
              <td style="padding:12px 0;border-bottom:1px solid #edf3ef;color:#48605a;">${escapeHtml(subject)}</td>
            </tr>
          </table>
          <div style="margin-top:24px;">
            <div style="font-size:14px;font-weight:700;color:#0b3d2e;margin-bottom:10px;">Message</div>
            <div style="padding:16px 18px;background:#f7faf8;border:1px solid #e4eee8;border-radius:14px;color:#3d5550;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

    const text = [
      'New support request from merchant auth contact page',
      '',
      `Full name: ${fullName}`,
      `Email: ${email}`,
      `Phone: ${phone || '—'}`,
      `Address: ${address || '—'}`,
      `Company: ${company || '—'}`,
      `Subject: ${subject}`,
      '',
      'Message:',
      message,
    ].join('\n');

    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: SUPPORT_EMAIL,
      from: { email: getSendgridFromEmail(), name: FROM_NAME },
      replyTo: { email, name: fullName },
      subject: `[Merchant Support] ${subject}`,
      text,
      html,
    });

    return { success: true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('[supportContactEmail]', err);
    throw new functions.https.HttpsError(
      'internal',
      err && err.message ? err.message : 'Failed to send support email.'
    );
  }
}

module.exports = {
  runSupportContactEmail,
};
