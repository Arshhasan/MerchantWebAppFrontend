/* eslint-env node */
/* global module, require, Buffer, __dirname, process */

const fs = require('fs');
const path = require('path');

const LOGO_FILE = 'best-by-bites-final-logo-white.png';

/**
 * @param {string} [contentId]
 */
function buildInlineLogo(contentId = 'email-logo') {
  try {
    const logoPath = path.join(__dirname, 'emailAssets', LOGO_FILE);
    const buf = fs.readFileSync(logoPath);
    return {
      logoSrc: `cid:${contentId}`,
      attachments: [
        {
          content: buf.toString('base64'),
          filename: 'logo.png',
          type: 'image/png',
          disposition: 'inline',
          content_id: contentId,
        },
      ],
    };
  } catch {
    return null;
  }
}

module.exports = {
  buildInlineLogo,
  LOGO_FILE,
};

