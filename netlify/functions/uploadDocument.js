// netlify/functions/uploadDocument.js
const { Readable } = require('stream');
const { getGoogleAuth, driveClient, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');
const { MAX_UPLOAD_BYTES, ALLOWED_MIME } = require('./_utils/limits');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID;     // optional: where you log uploads
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;   // Drive folder to upload into

// minimal mime guesser (no external deps)
const guessMime = (name = '') => {
  const ext = name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/octet-stream';
  }
};

const prettySize = (bytes) => {
  if (bytes == null) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = Number(bytes);
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  // Handle CORS + method guard
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  // Optional auth (matches your frontend with X-App-Token if you’ve set it up)
  if (!checkAuth(event)) return unauth(headers);

  // Parse body (supports both the new and old payload shapes)
  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON');

  // Accept either: { filename, mimeType, base64, sheetRowMeta }
  // or legacy UI:   { fileName, fileData, category, notes }
  const filename = body.filename || body.fileName;
  const base64   = body.base64   || body.fileData;
  const mimeType = body.mimeType || guessMime(filename);
  const sheetRowMeta = body.sheetRowMeta || {
    category: body.category || '',
    notes: body.notes || '',
  };

  if (!filename || !base64) return bad(headers, 'Missing filename or base64 file data');

  // Validate type/size
  if (!ALLOWED_MIME.includes(mimeType)) {
    return bad(headers, `Disallowed file type: ${mimeType}`);
  }

  // body.base64 should be pure base64 (your UI uses FileReader and splits on ',')
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return bad(headers, `File too large (max ${prettySize(MAX_UPLOAD_BYTES)})`);
  }

  // sanitize filename for Drive
  const safeName = String(filename).replace(/[^\w.\-() ]/g, '_').slice(0, 120);

  try {
    const auth = getGoogleAuth();
    await auth.authorize();
    const drive = driveClient(auth);

    // Upload to Drive
    const createRes = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: FOLDER_ID ? [FOLDER_ID] : undefined,
        mimeType,
      },
      media: { mimeType, body: Readable.from(bytes) },
      fields: 'id, name, mimeType, webViewLink, webContentLink',
    });

    const file = createRes.data;
    const uploadedAt = new Date().toISOString();
    const sizeReadable = prettySize(bytes.length);

    // Optional: log to Sheets (Uploads!A:G)
    if (SHEET_ID) {
      try {
        const sheets = sheetsClient(auth);
        const values = [[
          uploadedAt,                     // A: timestamp
          file.id,                        // B: driveFileId
          file.name,                      // C: filename
          file.mimeType || mimeType,      // D: mime
          file.webViewLink || '',         // E: webViewLink
          file.webContentLink || '',      // F: webContentLink
          JSON.stringify({
            ...sheetRowMeta,
            size: bytes.length,
            sizeReadable,
          }),                             // G: meta JSON
        ]];

        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Uploads!A:G',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
      } catch (logErr) {
        // Non-fatal
        console.warn('uploadDocument: sheet log failed:', logErr.message);
      }
    }

    // Return a UI-friendly payload
    return ok(headers, {
      success: true,
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || mimeType,
        webViewLink: file.webViewLink || '',
        webContentLink: file.webContentLink || '',
        sizeBytes: bytes.length,
        sizeReadable,
        uploadedAt,
        category: sheetRowMeta.category || undefined,
        notes: sheetRowMeta.notes || undefined,
      },
    });
  } catch (e) {
    console.error('uploadDocument error:', e);
    return serverErr(headers);
  }
};
