/**
 * Invoice PDF helpers. Callers should use `await import('./invoicePdf')` so this file
 * is not in the Accounting (or app) initial graph. `downloadInvoiceAsPdf` then loads
 * html2pdf.js (and html2canvas/jspdf) only inside that function.
 */

/**
 * Temporarily forces A4 layout on the invoice node so html2canvas captures
 * full-width A4 even when the sheet is styled narrower for mobile preview.
 * @param {HTMLElement} element
 */
function lockInvoiceSheetForCapture(element) {
  const prevCssText = element.style.cssText;
  element.style.cssText = `${prevCssText ? `${prevCssText}; ` : ''}width: 210mm; max-width: 210mm; min-width: 210mm; min-height: 297mm; box-sizing: border-box;`;
  return () => {
    element.style.cssText = prevCssText;
  };
}

function waitNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Renders a DOM element to A4 PDF (uses html2canvas + jsPDF under the hood).
 * @param {HTMLElement} element
 * @param {string} [filenameBase]
 * @returns {Promise<void>}
 */
export async function downloadInvoiceAsPdf(element, filenameBase = 'invoice') {
  if (!element) return;

  const mod = await import('html2pdf.js');
  const html2pdf = mod.default;

  const restore = lockInvoiceSheetForCapture(element);
  await waitNextPaint();

  const safeName = String(filenameBase).replace(/[^a-zA-Z0-9-_]+/g, '_');
  const opt = {
    margin: [8, 8, 8, 8],
    filename: `${safeName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    const worker = html2pdf().set(opt).from(element);
    const result = worker.save();
    if (result && typeof result.then === 'function') await result;
  } finally {
    restore();
  }
}
