import { forwardRef, useMemo } from 'react';
import { publicUrl } from '../../utils/publicUrl';
import { formatDollarAmount } from '../../utils/merchantCurrencyFormat';
import {
  formatTaxRateLine,
  taxLabelFromCountryAndCurrency,
} from '../../utils/taxLabel';
import './InvoiceDocument.css';

function formatMoney(amount, _currencyCode) {
  return formatDollarAmount(amount);
}

/**
 * @typedef {{ description: string, quantity: number, unitPrice: number, lineTotal: number }} InvoiceLine
 * @typedef {{ name: string, lines: string[] }} InvoiceAddress
 *
 * @typedef {object} InvoiceModel
 * @property {string} invoiceNumber
 * @property {string} invoiceDateLabel
 * @property {string} orderId
 * @property {string} currencyCode
 * @property {string} [customerName]
 * @property {string} [customerEmail]
 * @property {string[]} [customerLines]
 * @property {InvoiceLine[]} items
 * @property {number} subtotal
 * @property {number} vatRate
 * @property {number} vatAmount
 * @property {'GST' | 'VAT' | 'Tax'} [taxLabel]
 * @property {string} [taxRateLine] — e.g. "GST, 10%"
 * @property {string} [country]
 * @property {number} grandTotal
 * @property {string} paymentMethodLabel
 * @property {number} paymentAmount
 * @property {string} [issuerDisclaimer]
 * @property {InvoiceAddress} store
 * @property {InvoiceAddress} seller
 * @property {string} [brandTitle]
 * @property {string} [brandSubtitle]
 */

const InvoiceDocument = forwardRef(function InvoiceDocument({ invoice }, ref) {
  const currency = invoice?.currencyCode || 'INR';
  const currencyParen = `(${currency})`;

  const taxLineLabel = useMemo(() => {
    if (invoice?.taxRateLine) return invoice.taxRateLine;
    const tl =
      invoice?.taxLabel ||
      taxLabelFromCountryAndCurrency(
        typeof invoice?.country === 'string' ? invoice.country : '',
        invoice?.currencyCode || 'INR'
      );
    return formatTaxRateLine(tl, Number(invoice?.vatRate));
  }, [
    invoice?.taxRateLine,
    invoice?.taxLabel,
    invoice?.country,
    invoice?.currencyCode,
    invoice?.vatRate,
  ]);

  const disclaimer =
    invoice?.issuerDisclaimer ||
    `Invoice issued by ${invoice?.brandTitle || 'bestby bites'} in the name and on behalf of ${invoice?.store?.name || 'the store'}.`;

  const storeLines = invoice?.store?.lines?.length
    ? invoice.store.lines
    : [];
  const sellerLines = invoice?.seller?.lines?.length ? invoice.seller.lines : [];

  return (
    <div ref={ref} className="invoice-document__sheet">
      <header className="invoice-document__header">
        <div className="invoice-document__title-block">
          <h1 className="invoice-document__title">Invoice</h1>
          <ul className="invoice-document__meta">
            <li>
              <strong>Date:</strong> {invoice?.invoiceDateLabel || '—'}
            </li>
            <li>
              <strong>Invoice No.:</strong> {invoice?.invoiceNumber || '—'}
            </li>
            <li>
              <strong>Order ID:</strong> {invoice?.orderId || '—'}
            </li>
          </ul>
        </div>
        <div className="invoice-document__logo-wrap">
          <img
            src={publicUrl('cusomerlogo.png')}
            alt="bestby bites"
            className="invoice-document__logo"
            width={140}
            height={72}
          />
        </div>
      </header>

      <hr className="invoice-document__rule" />

      {(invoice?.customerName ||
        invoice?.customerEmail ||
        (invoice?.customerLines?.length ?? 0) > 0) && (
        <div className="invoice-document__customer">
          {invoice?.customerName ? (
            <div className="invoice-document__customer-name">{invoice.customerName}</div>
          ) : null}
          {invoice?.customerEmail ? <div>{invoice.customerEmail}</div> : null}
          {invoice?.customerLines?.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      <table className="invoice-document__table">
        <thead>
          <tr>
            <th className="invoice-document__col-desc">Description</th>
            <th className="invoice-document__col-qty">Quantity</th>
            <th className="invoice-document__col-price">Price</th>
            <th className="invoice-document__col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {(invoice?.items || []).map((row, idx) => (
            <tr key={`${row.description}-${idx}`}>
              <td className="invoice-document__col-desc">{row.description}</td>
              <td className="invoice-document__col-qty">{row.quantity}</td>
              <td className="invoice-document__col-price">
                {formatMoney(row.unitPrice, currency)} {currencyParen}
              </td>
              <td className="invoice-document__col-total">
                {formatMoney(row.lineTotal, currency)} {currencyParen}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-document__summary">
        <div className="invoice-document__summary-row">
          <span>Subtotal</span>
          <span className="invoice-document__summary-val">
            {formatMoney(invoice?.subtotal ?? 0, currency)} {currencyParen}
          </span>
        </div>
        <div className="invoice-document__summary-row">
          <span>{taxLineLabel}</span>
          <span className="invoice-document__summary-val">
            {formatMoney(invoice?.vatAmount ?? 0, currency)} {currencyParen}
          </span>
        </div>
        <div className="invoice-document__summary-row invoice-document__summary-row--total">
          <span>Total</span>
          <span className="invoice-document__summary-val">
            {formatMoney(invoice?.grandTotal ?? 0, currency)} {currencyParen}
          </span>
        </div>
      </div>

      <p className="invoice-document__disclaimer">{disclaimer}</p>

      <section className="invoice-document__payment">
        <h2 className="invoice-document__payment-title">This invoice has been paid with:</h2>
        <div className="invoice-document__payment-row">
          <span>{invoice?.paymentMethodLabel || '—'}</span>
          <span className="invoice-document__summary-val">
            {formatMoney(invoice?.paymentAmount ?? invoice?.grandTotal ?? 0, currency)}{' '}
            {currencyParen}
          </span>
        </div>
      </section>

      <hr className="invoice-document__rule invoice-document__rule--footer" />

      <footer className="invoice-document__footer-cols">
        <div className="invoice-document__footer-col">
          <h3>Store</h3>
          {invoice?.store?.name ? <p>{invoice.store.name}</p> : null}
          {storeLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="invoice-document__footer-col">
          <h3>Seller</h3>
          {invoice?.seller?.name ? <p>{invoice.seller.name}</p> : null}
          {sellerLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </footer>
    </div>
  );
});

InvoiceDocument.displayName = 'InvoiceDocument';

export default InvoiceDocument;
