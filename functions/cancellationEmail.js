/**
 * SendGrid: order cancelled — notify customer and merchant (merchant reject flow).
 */
/* eslint-env node */
/* global module, require */

const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const invoiceFromOrder = require('./invoiceFromOrder');
const { getSendgridApiKey, getSendgridFromEmail } = require('./sendgridEnv');
const {
  isValidEmail,
  resolveCustomerEmail,
  resolveMerchantEmail,
  customerDisplayName,
} = require('./orderEmailRecipients');

const APP = 'BestbyBites';
const FROM_NAME = 'BestbyBites';

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

function storeNameFromOrder(orderData) {
  const v = orderData.vendor || {};
  return String(v.title || v.storeName || v.name || 'Store').trim() || 'Store';
}

/**
 * @param {string} orderId
 * @param {Record<string, unknown>} orderData
 * @param {string} reason
 * @param {'customer'|'merchant'} audience
 */
function buildCancellationHtml(orderId, orderData, reason, audience) {
  const store = escapeHtml(storeNameFromOrder(orderData));
  const rid = escapeHtml(String(reason || 'No reason provided'));
  const currency = String(orderData.currency || orderData.currencyCode || 'INR');
  let total = 0;
  try {
    total = invoiceFromOrder.computeOrderPayableTotal(orderData);
  } catch {
    total = 0;
  }
  const totalStr = formatMoney(total, currency);

  const headline =
    audience === 'customer'
      ? 'Your order was cancelled'
      : 'Order cancelled';

  const bodyCustomer = `
      <p style="margin:0 0 16px;color:#18181b;line-height:1.6;">
        Your order <strong>#${escapeHtml(String(orderId))}</strong> from <strong>${store}</strong> has been cancelled by the store.
      </p>
      <p style="margin:0 0 12px;color:#52525b;font-size:14px;"><strong>Reason:</strong> ${rid}</p>
      <p style="margin:0;color:#71717a;font-size:14px;">Order total was ${totalStr}. If you were charged, refunds follow your payment provider&apos;s timing.</p>`;

  const bodyMerchant = `
      <p style="margin:0 0 16px;color:#18181b;line-height:1.6;">
        Order <strong>#${escapeHtml(String(orderId))}</strong> has been marked <strong>cancelled</strong>.
      </p>
      <p style="margin:0 0 12px;color:#52525b;font-size:14px;"><strong>Reason recorded:</strong> ${rid}</p>
      <p style="margin:0;color:#71717a;font-size:14px;">Store: ${store} · Order total was ${totalStr}</p>`;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;padding:24px;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <tr><td style="padding:22px 20px;background:#7f1d1d;color:#fff;">
      <div style="font-size:14px;font-weight:600;">${escapeHtml(APP)}</div>
      <div style="font-size:20px;font-weight:700;margin-top:8px;">${escapeHtml(headline)}</div>
    </td></tr>
    <tr><td style="padding:22px 20px;">
      ${audience === 'customer' ? bodyCustomer : bodyMerchant}
    </td></tr>
  </table>
</body></html>`.trim();
}

function buildCancellationText(orderId, orderData, reason, audience) {
  const store = storeNameFromOrder(orderData);
  let total = 0;
  try {
    total = invoiceFromOrder.computeOrderPayableTotal(orderData);
  } catch {
    total = 0;
  }
  const r = reason || 'No reason provided';
  if (audience === 'customer') {
    return [
      `${APP} — Order #${orderId} cancelled`,
      `Store: ${store}`,
      `Reason: ${r}`,
      `Order total: ${total}`,
      '',
      'The store cancelled this order. Contact support if you have questions.',
    ].join('\n');
  }
  return [
    `${APP} Merchant — Order #${orderId} cancelled`,
    `Store: ${store}`,
    `Reason: ${r}`,
    `Order total: ${total}`,
  ].join('\n');
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} orderId
 * @param {Record<string, unknown>} orderData — after cancel update
 * @param {string} merchantUid
 * @param {string} [cancelReason]
 * @returns {Promise<{ customerSent: boolean, merchantSent: boolean, errors: string[] }>}
 */
async function sendOrderCancelledEmails(db, orderId, orderData, merchantUid, cancelReason) {
  const errors = [];
  if (orderData && orderData.cancellationNotificationEmailsSent === true) {
    console.log('[cancellationEmail] skip: already sent', orderId);
    return {
      customerSent: false,
      merchantSent: false,
      errors: [],
      skipped: true,
    };
  }

  const reason =
    cancelReason ||
    orderData.cancelledReason ||
    orderData.rejectionReason ||
    '';

  const apiKey = getSendgridApiKey();
  if (!apiKey) {
    console.warn('[cancellationEmail] Missing SendGrid API key');
    return { customerSent: false, merchantSent: false, errors: ['no_api_key'] };
  }

  let customerEmail = '';
  try {
    customerEmail = await resolveCustomerEmail(db, orderData);
  } catch (e) {
    errors.push(`customer_resolve:${e.message}`);
  }

  let merchantEmail = '';
  try {
    merchantEmail = await resolveMerchantEmail(db, orderData, merchantUid);
  } catch (e) {
    errors.push(`merchant_resolve:${e.message}`);
  }

  const customerLabel = customerDisplayName(orderData);
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
        subject: `${APP} — Order #${orderId} cancelled`,
        text: buildCancellationText(orderId, orderData, reason, 'customer'),
        html: buildCancellationHtml(orderId, orderData, reason, 'customer'),
      });
      customerSent = true;
      console.log('[cancellationEmail] customer notified', { orderId, to: customerEmail });
    } catch (e) {
      console.error('[cancellationEmail] customer send failed', e?.message || e);
      errors.push(`customer:${e.message}`);
    }
  } else {
    console.warn('[cancellationEmail] no customer email', orderId);
    errors.push('no_customer_email');
  }

  if (isValidEmail(merchantEmail)) {
    try {
      await sgMail.send({
        to: merchantEmail,
        from: { email: fromEmail, name: FROM_NAME },
        replyTo: fromEmail,
        subject: `Cancelled — Order #${orderId} (${customerLabel})`,
        text: buildCancellationText(orderId, orderData, reason, 'merchant'),
        html: buildCancellationHtml(orderId, orderData, reason, 'merchant'),
      });
      merchantSent = true;
      console.log('[cancellationEmail] merchant notified', { orderId, to: merchantEmail });
    } catch (e) {
      console.error('[cancellationEmail] merchant send failed', e?.message || e);
      errors.push(`merchant:${e.message}`);
    }
  } else {
    console.warn('[cancellationEmail] no merchant email', orderId);
    errors.push('no_merchant_email');
  }

  if (customerSent || merchantSent) {
    try {
      await db
        .collection('restaurant_orders')
        .doc(orderId)
        .update({
          cancellationNotificationEmailsSent: true,
          cancellationNotificationEmailsSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
      console.error('[cancellationEmail] failed to set notification flag', orderId, e?.message || e);
    }
  }

  return { customerSent, merchantSent, errors };
}

module.exports = {
  sendOrderCancelledEmails,
};
