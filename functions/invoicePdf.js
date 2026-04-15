/**
 * Minimal PDF invoice for email attachment (pdfkit).
 */
/* eslint-env node */
/* global module, require, Buffer */

const PDFDocument = require('pdfkit');
const path = require('path');
const https = require('https');

/**
 * @param {Record<string, unknown>} payload - from buildMerchantInvoicePayload
 * @param {string} orderId
 * @returns {Promise<Buffer>}
 */
function buildInvoicePdfBuffer(payload, orderId) {
  const fetchBuffer = (url) => new Promise((res) => {
    if (!url) return res(null);
    try {
      https
        .get(url, (resp) => {
          if (resp.statusCode !== 200) {
            resp.resume();
            return res(null);
          }
          const chunks = [];
          resp.on('data', (c) => chunks.push(c));
          resp.on('end', () => res(Buffer.concat(chunks)));
        })
        .on('error', () => res(null));
    } catch {
      res(null);
    }
  });

  const loadLogoBuffer = async () => {
    const originRaw = process.env.MERCHANT_APP_ORIGIN || process.env.MERCHANT_APP_PUBLIC_URL || '';
    let origin = '';
    try {
      if (originRaw) origin = new URL(String(originRaw)).origin;
    } catch {
      origin = '';
    }
    const remote = origin ? `${origin}/cusomerlogo.png` : '';
    const remoteBuf = await fetchBuffer(remote);
    if (remoteBuf) return remoteBuf;

    try {
      // eslint-disable-next-line global-require
      const fs = require('fs');
      const localPath = path.join(__dirname, 'emailAssets', 'logo-bestbbybites-merchant-dark-photoroom.png');
      return fs.readFileSync(localPath);
    } catch {
      return null;
    }
  };

  return new Promise((resolve, reject) => {
    (async () => {
      const logoBuf = await loadLogoBuffer();

      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Ensure solid white background (avoids dark viewer backgrounds on transparent PDFs).
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
      doc.fillColor('#111827');

      const invNo = String(payload.invoiceNumber || `INV-${orderId}`);
      const currency = String(payload.currencyCode || 'INR');
      const cust = payload.customer || {};
      const store = payload.store || {};
      const seller = payload.seller || {};
      const storeName = String(store.name || 'Store');

      const symbolFor = (code) => {
        const c = String(code || '').trim().toUpperCase();
        if (c === 'INR') return '₹';
        if (c === 'USD' || c === 'CAD' || c === 'AUD' || c === 'NZD' || c === 'SGD') return '$';
        if (c === 'EUR') return '€';
        if (c === 'GBP') return '£';
        return c ? `${c} ` : '';
      };

      const fmtMoney = (n) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return String(n);
        const sym = symbolFor(currency);
        return `${sym}${x.toFixed(2)}`.trim();
      };

      const invDate =
        typeof payload.invoiceDate?.toDate === 'function'
          ? payload.invoiceDate.toDate()
          : payload.invoiceDate instanceof Date
            ? payload.invoiceDate
            : null;
      const dateLabel = invDate ? invDate.toLocaleDateString('en-GB') : '—';

      // Header
      const headerTop = doc.y;
      doc
        .fillColor('#111827')
        .fontSize(26)
        .font('Helvetica-Bold')
        .text('Invoice', 48, headerTop, { align: 'left' });

      if (logoBuf) {
        try {
          doc.image(logoBuf, 430, headerTop - 2, { width: 120 });
        } catch {
          // ignore
        }
      }

      doc.moveDown(1.2);
      doc.fontSize(10).fillColor('#111827');
      doc.font('Helvetica-Bold').text('Date:', { continued: true });
      doc.font('Helvetica').text(` ${dateLabel}`);
      doc.font('Helvetica-Bold').text('Invoice No.:', { continued: true });
      doc.font('Helvetica').text(` ${invNo}`);
      doc.font('Helvetica-Bold').text('Order ID:', { continued: true });
      doc.font('Helvetica').text(` ${orderId}`);

      doc.moveDown(0.9);

      // Customer email/name line
      const custName = [cust.firstName, cust.lastName].filter(Boolean).join(' ').trim();
      const custLine = cust.email || custName;
      if (custLine) {
        doc.font('Helvetica').fontSize(10).fillColor('#111827').text(String(custLine));
        doc.moveDown(0.6);
      }

      // Table header (Description / Quantity / Price / Total)
      const tableX = 48;
      const colDesc = tableX;
      const colQty = 360;
      const colPrice = 440;
      const colTotal = 480;

      const headY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
      doc.text('Description', colDesc, headY, { width: 320 });
      doc.text('Quantity', colQty, headY, { width: 70, align: 'right' });
      doc.text('Price', colPrice, headY, { width: 60, align: 'right' });
      doc.text('Total', colTotal, headY, { width: 67, align: 'right' });
      doc.moveDown(0.35);
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(tableX, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(0.6);

      // Rows
      doc.font('Helvetica').fontSize(10).fillColor('#111827');
      const items = Array.isArray(payload.items) ? payload.items : [];
      items.forEach((it) => {
        const y = doc.y;
        const desc = String(it.description || 'Item');
        const qty = Number(it.quantity || 1);
        const unit = it.unitPrice ?? '';
        const line = it.lineTotal ?? '';

        doc.text(desc, colDesc, y, { width: 330 });
        doc.text(String(qty), colQty, y, { width: 70, align: 'right' });
        doc.text(fmtMoney(unit), colPrice, y, { width: 60, align: 'right' });
        doc.text(fmtMoney(line), colTotal, y, { width: 67, align: 'right' });
        doc.moveDown(1.1);
        doc.strokeColor('#f3f4f6').lineWidth(1).moveTo(tableX, doc.y).lineTo(547, doc.y).stroke();
        doc.moveDown(0.35);
      });

      // Summary (right aligned)
      doc.moveDown(0.5);
      const summaryLabelX = 360;
      const summaryValX = 547;
      const summaryRow = (label, value, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor('#111827');
        doc.text(label, summaryLabelX, doc.y, { width: 120, align: 'right' });
        doc.text(value, summaryValX - 90, doc.y, { width: 90, align: 'right' });
        doc.moveDown(0.55);
      };
      summaryRow('Subtotal', fmtMoney(payload.subtotal ?? 0));
      if (Number(payload.vatAmount) > 0) {
        const rate = Number(payload.vatRate) || 0;
        const label = rate ? `VAT, ${rate.toFixed(0)}%` : 'VAT';
        summaryRow(label, fmtMoney(payload.vatAmount ?? 0));
      }
      summaryRow('Total', fmtMoney(payload.grandTotal ?? 0), true);

      // Disclaimer
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(
        String(payload.issuerDisclaimer || `Invoice issued by bestby bites in the name and on behalf of ${storeName}.`),
        { width: 499 }
      );

      // Payment section
      doc.moveDown(0.9);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('This invoice has been paid with:');
      doc.moveDown(0.4);
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(0.45);
      doc.font('Helvetica').fontSize(10).fillColor('#111827');
      doc.text(String(payload.paymentMethodLabel || 'Paid'), 48, doc.y, { width: 300, align: 'center' });
      doc.text(fmtMoney(payload.paymentAmount ?? payload.grandTotal ?? 0), 48, doc.y, { width: 499, align: 'right' });

      // Footer columns
      doc.moveDown(1.3);
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(0.8);
      const leftX = 48;
      const rightX = 310;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Store', leftX, doc.y);
      doc.text('Seller', rightX, doc.y);
      doc.moveDown(0.55);
      doc.font('Helvetica').fontSize(9).fillColor('#374151');
      doc.text(storeName, leftX, doc.y, { width: 240 });
      doc.text(String(seller.name || 'bestby bites'), rightX, doc.y, { width: 240 });
      const storeLines = Array.isArray(store.lines) ? store.lines : [];
      const sellerLines = Array.isArray(seller.lines) ? seller.lines : [];
      const maxLines = Math.max(storeLines.length, sellerLines.length);
      for (let i = 0; i < maxLines; i += 1) {
        doc.moveDown(0.25);
        if (storeLines[i]) doc.text(String(storeLines[i]), leftX, doc.y, { width: 240 });
        if (sellerLines[i]) doc.text(String(sellerLines[i]), rightX, doc.y, { width: 240 });
      }

      doc.end();
    })().catch(reject);
  });
}

module.exports = {
  buildInvoicePdfBuffer,
};
