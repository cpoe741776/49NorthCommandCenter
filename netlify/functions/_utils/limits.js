// netlify/functions/_utils/limits.js
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || '', 10) || (5 * 1024 * 1024); // 5MB
const ALLOWED_MIME = (process.env.ALLOWED_UPLOAD_MIME || 'application/pdf,image/png,image/jpeg')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

module.exports = { MAX_UPLOAD_BYTES, ALLOWED_MIME };
