/**
 * SendGrid: invoice to customer + pickup confirmation to merchant after OTP pickup.
 */
/* eslint-env node */
/* global module, require */

const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const { buildInvoicePdfBuffer } = require('./invoicePdf');
const invoiceFromOrder = require('./invoiceFromOrder');
const { fetchTaxPercentForCountry } = require('./taxFromFirestore');
const { getSendgridApiKey, getSendgridFromEmail } = require('./sendgridEnv');
const {
  isValidEmail,
  resolveCustomerEmail,
  resolveMerchantEmail,
  customerDisplayName,
} = require('./orderEmailRecipients');

const APP = 'BestbyBites';
const FROM_NAME = 'BestbyBites';
const { buildInlineLogo } = require('./emailLogo');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const sym = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : `${currency || ''} `;
  return `${sym}${n.toFixed(2)}`.trim();
}

/**
 * @param {string} orderId
 * @param {import('./invoiceFromOrder').buildMerchantInvoicePayload extends Function ? any : any} payload
 */
function buildCustomerInvoiceHtml(orderId, payload) {
  const inline = buildInlineLogo('merchant-logo');
  const storeName = escapeHtml(payload.store?.name || 'Store');
  const invNo = escapeHtml(String(payload.invoiceNumber || `INV-${orderId}`));
  const currency = payload.currencyCode || 'INR';
  const rows = (payload.items || [])
    .map(
      (it) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${escapeHtml(it.description)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(String(it.quantity))}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatMoney(it.lineTotal, currency)}</td>
    </tr>`
    )
    .join('');
  const sub = formatMoney(payload.subtotal, currency);
  const vat =
    payload.vatAmount > 0
      ? `<tr><td colspan="2" style="padding:8px;text-align:right;">Tax (VAT)</td><td style="padding:8px;text-align:right;">${formatMoney(payload.vatAmount, currency)}</td></tr>`
      : '';
  const total = formatMoney(payload.grandTotal, currency);

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;padding:24px;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <tr><td style="padding:24px 20px;background:#0f5132;color:#fff;">
      ${inline ? `<img src="${inline.logoSrc}" alt="${escapeHtml(APP)}" width="140" style="display:block;height:auto;max-width:180px;margin:0 0 12px 0;" />` : `<div style="font-size:14px;font-weight:600;">${escapeHtml(APP)}</div>`}
      <div style="font-size:20px;font-weight:700;margin-top:8px;">Receipt / Invoice</div>
      <div style="font-size:14px;opacity:.95;margin-top:6px;">Order ${escapeHtml(String(orderId))} · ${invNo}</div>
    </td></tr>
    <tr><td style="padding:20px;">
      <p style="margin:0 0 16px;color:#18181b;">Thank you for your order from <strong>${storeName}</strong>. Your pickup is confirmed. Your invoice is attached as a PDF.</p>
      <table width="100%" style="border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th align="left" style="padding:10px 8px;">Item</th>
            <th style="padding:10px 8px;">Qty</th>
            <th align="right" style="padding:10px 8px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="2" style="padding:10px 8px;text-align:right;font-weight:600;">Subtotal</td>
          <td style="padding:10px 8px;text-align:right;">${sub}</td></tr>
          ${vat}
          <tr><td colspan="2" style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;">Total</td>
          <td style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;">${total}</td></tr>
        </tfoot>
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#71717a;">Payment: ${escapeHtml(String(payload.paymentMethodLabel || 'Paid'))}</p>
    </td></tr>
  </table>
</body></html>`.trim();
}

function buildCustomerInvoiceText(orderId, payload) {
  const lines = (payload.items || []).map(
    (it) => `- ${it.description} x${it.quantity} = ${it.lineTotal}`
  );
  return [
    `${APP} — Receipt for order ${orderId}`,
    `Invoice: ${payload.invoiceNumber}`,
    `Store: ${payload.store?.name || ''}`,
    '',
    ...lines,
    '',
    `Total: ${payload.grandTotal} ${payload.currencyCode || ''}`,
    '',
    'Your pickup is confirmed. A PDF invoice is attached. Thank you!',
  ].join('\n');
}

function buildMerchantPickupHtml(orderId, payload, customerLabel) {
  const inline = buildInlineLogo('merchant-logo');
  const store = escapeHtml(payload.store?.name || 'Your store');
  const total = formatMoney(payload.grandTotal, payload.currencyCode || 'INR');
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;padding:24px;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;padding:24px;">
    <tr><td>
      ${inline ? `<img src="${inline.logoSrc}" alt="${escapeHtml(APP)}" width="140" style="display:block;height:auto;max-width:180px;margin:0 0 12px 0;" />` : ''}
      <div style="font-size:12px;font-weight:600;color:#16a34a;text-transform:uppercase;">Pickup confirmed</div>
      <h1 style="margin:12px 0 8px;font-size:20px;color:#18181b;">Order #${escapeHtml(String(orderId))}</h1>
      <p style="margin:0;color:#52525b;line-height:1.6;">The customer completed pickup (OTP verified). Order total: <strong>${total}</strong>. A PDF invoice is attached to this email.</p>
      <p style="margin:16px 0 0;color:#52525b;">Store: <strong>${store}</strong><br/>Customer: ${escapeHtml(customerLabel)}</p>
    </td></tr>
  </table>
</body></html>`.trim();
}

function buildMerchantPickupText(orderId, payload, customerLabel) {
  return [
    `${APP} Merchant — Pickup confirmed`,
    `Order: ${orderId}`,
    `Store: ${payload.store?.name || ''}`,
    `Customer: ${customerLabel}`,
    `Total: ${payload.grandTotal} ${payload.currencyCode || ''}`,
    '',
    'The customer completed pickup (OTP verified).',
    'A PDF invoice is attached.',
  ].join('\n');
}

function safeInvoiceFilename(orderId) {
  const base = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '_') || 'order';
  return `Invoice-${base}.pdf`;
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} orderId
 * @param {Record<string, unknown>} orderData
 * @param {string} merchantUid
 * @returns {Promise<{ customerSent: boolean, merchantSent: boolean, errors: string[], skipped?: boolean }>}
 */
async function sendPickupInvoiceEmails(db, orderId, orderData, merchantUid) {
  const errors = [];
  if (orderData && orderData.pickupNotificationEmailsSent === true) {
    console.log('[pickupEmail] skip: already sent', orderId);
    return {
      customerSent: false,
      merchantSent: false,
      errors: [],
      skipped: true,
    };
  }

  const apiKey = getSendgridApiKey();
  if (!apiKey) {
    console.warn('[pickupEmail] Missing SendGrid API key; skip pickup emails');
    return { customerSent: false, merchantSent: false, errors: ['no_api_key'] };
  }

  const merchantId = invoiceFromOrder.resolveInvoiceMerchantId(orderData);
  if (!merchantId) {
    console.warn('[pickupEmail] missing merchantId on order', orderId);
    return { customerSent: false, merchantSent: false, errors: ['no_merchant_id'] };
  }

  const v = orderData.vendor || {};
  const countryField =
    v.country ||
    v.countryName ||
    v.country_name ||
    v.countryCode ||
    v.country_code ||
    (orderData.address && typeof orderData.address === 'object'
      ? orderData.address.country || orderData.address.countryCode
      : '') ||
    '';
  const currencyCode = String(orderData.currency || orderData.currencyCode || 'INR');
  let taxPercent = 0;
  try {
    const c = String(countryField || '').trim();
    if (c) {
      taxPercent = await fetchTaxPercentForCountry(db, c, currencyCode);
    }
  } catch (e) {
    console.warn('[pickupEmail] tax read failed', e?.message);
  }

  const payload = invoiceFromOrder.buildMerchantInvoicePayload(
    orderId,
    orderData,
    merchantId,
    taxPercent
  );

  let attachments = [];
  try {
    const pdfBuf = await buildInvoicePdfBuffer(payload, orderId);
    attachments = [
      {
        content: pdfBuf.toString('base64'),
        filename: safeInvoiceFilename(orderId),
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ];
  } catch (e) {
    console.error('[pickupEmail] PDF build failed; sending without attachment', orderId, e?.message || e);
    errors.push(`pdf:${e.message}`);
  }

  // Inline logo for consistent branding across email clients.
  const inlineLogo = buildInlineLogo('merchant-logo');
  if (inlineLogo?.attachments?.length) {
    attachments = [...inlineLogo.attachments, ...attachments];
  }

  let customerEmail = '';
  try {
    customerEmail = await resolveCustomerEmail(db, orderData);
  } catch (e) {
    errors.push(`customer_resolve:${e.message}`);
  }
  const customerLabel = customerDisplayName(orderData);

  let merchantEmail = '';
  try {
    merchantEmail = await resolveMerchantEmail(db, orderData, merchantUid);
  } catch (e) {
    errors.push(`merchant_resolve:${e.message}`);
  }

  const fromEmail = getSendgridFromEmail();
  sgMail.setApiKey(apiKey);

  let customerSent = false;
  let merchantSent = false;

  if (isValidEmail(customerEmail)) {
    try {
      await sgMail.send({
        to: customerEmail,
        from: { email: fromEmail, name: FROM_NAME },
        replyTo: fromEmail,
        subject: `${APP} — Receipt for order #${orderId}`,
        text: buildCustomerInvoiceText(orderId, payload),
        html: buildCustomerInvoiceHtml(orderId, payload),
        attachments,
      });
      customerSent = true;
      console.log('[pickupEmail] customer invoice sent', { orderId, to: customerEmail });
    } catch (e) {
      console.error('[pickupEmail] customer send failed', e?.message || e);
      errors.push(`customer:${e.message}`);
    }
  } else {
    console.warn('[pickupEmail] no customer email on order', orderId);
    errors.push('no_customer_email');
  }

  if (isValidEmail(merchantEmail)) {
    try {
      await sgMail.send({
        to: merchantEmail,
        from: { email: fromEmail, name: FROM_NAME },
        replyTo: fromEmail,
        subject: `Pickup confirmed — Order #${orderId}`,
        text: buildMerchantPickupText(orderId, payload, customerLabel),
        html: buildMerchantPickupHtml(orderId, payload, customerLabel),
        attachments,
      });
      merchantSent = true;
      console.log('[pickupEmail] merchant confirmation sent', { orderId, to: merchantEmail });
    } catch (e) {
      console.error('[pickupEmail] merchant send failed', e?.message || e);
      errors.push(`merchant:${e.message}`);
    }
  } else {
    console.warn('[pickupEmail] no merchant email for uid/vendor', merchantUid, merchantId);
    errors.push('no_merchant_email');
  }

  if (customerSent || merchantSent) {
    try {
      await db
        .collection('restaurant_orders')
        .doc(orderId)
        .update({
          pickupNotificationEmailsSent: true,
          pickupNotificationEmailsSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
      console.error('[pickupEmail] failed to set notification flag', orderId, e?.message || e);
    }
  }

  return { customerSent, merchantSent, errors };
}

module.exports = {
  sendPickupInvoiceEmails,
};
