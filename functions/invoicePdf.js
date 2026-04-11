/**
 * Minimal PDF invoice for email attachment (pdfkit).
 */
/* eslint-env node */
/* global module, require, Buffer */

const PDFDocument = require('pdfkit');

/**
 * @param {Record<string, unknown>} payload - from buildMerchantInvoicePayload
 * @param {string} orderId
 * @returns {Promise<Buffer>}
 */
function buildInvoicePdfBuffer(payload, orderId) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const invNo = String(payload.invoiceNumber || `INV-${orderId}`);
    const store = String(payload.store?.name || 'Store');
    const currency = String(payload.currencyCode || 'INR');
    const cust = payload.customer || {};

    doc.fillColor('#0f5132').fontSize(18).text('BestbyBites', { align: 'center' });
    doc.fontSize(14).text('Invoice / Receipt', { align: 'center' });
    doc.moveDown(1.2);
    doc.fillColor('#000000').fontSize(10);
    doc.text(`Invoice number: ${invNo}`);
    doc.text(`Order ID: ${orderId}`);
    doc.text(`Store: ${store}`);
    const custName = [cust.firstName, cust.lastName].filter(Boolean).join(' ').trim();
    if (custName || cust.email) {
      doc.text(`Customer: ${custName || cust.email || ''}`);
    }
    doc.moveDown(0.8);

    doc.fontSize(9).text('Line items', { underline: true });
    doc.moveDown(0.3);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const fmt = (n) => {
      const x = Number(n);
      return Number.isFinite(x) ? x.toFixed(2) : String(n);
    };
    items.forEach((it) => {
      const line = `${it.description || 'Item'}  ×${it.quantity || 1}  =  ${fmt(it.lineTotal)}`;
      doc.text(line, { width: 500 });
    });
    doc.moveDown(0.6);
    doc.text(`Subtotal: ${fmt(payload.subtotal)} ${currency}`);
    if (payload.vatAmount > 0) {
      doc.text(`Tax (VAT): ${fmt(payload.vatAmount)} ${currency}`);
    }
    doc.fontSize(11).text(`Total: ${fmt(payload.grandTotal)} ${currency}`, { continued: false });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#444444');
    doc.text(`Payment: ${payload.paymentMethodLabel || 'Paid'}`);
    doc.text('Pickup confirmed — thank you for using BestbyBites.', { align: 'left' });

    doc.end();
  });
}

module.exports = {
  buildInvoicePdfBuffer,
};
