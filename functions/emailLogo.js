/* eslint-env node */
/* global module, require, __dirname */

const fs = require('fs');
const path = require('path');

const LOGO_FILE = 'logowhite.png';

/**
 * @param {string} [contentId]
 */
function buildInlineLogo(contentId = 'email-logo') {
  try {
    const candidatePaths = [
      path.join(__dirname, '..', 'public', LOGO_FILE),
      path.join(__dirname, 'emailAssets', LOGO_FILE),
    ];
    const logoPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!logoPath) return null;
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
