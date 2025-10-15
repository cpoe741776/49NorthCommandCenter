const MAX_UPLOAD_BYTES =
  Number.parseInt(process.env.MAX_UPLOAD_BYTES || '', 10) || 5 * 1024 * 1024;

const ALLOWED_MIME = Array.from(
  new Set(
    (process.env.ALLOWED_UPLOAD_MIME || 'application/pdf,image/png,image/jpeg')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  )
);

module.exports = { MAX_UPLOAD_BYTES, ALLOWED_MIME };
