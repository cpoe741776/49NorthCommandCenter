// netlify/functions/uploadDocument.js
const { Readable } = require('stream');
const { getGoogleAuth, driveClient, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');
const { MAX_UPLOAD_BYTES, ALLOWED_MIME } = require('./_utils/limits');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID;           // optional: where you log uploads
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;         // target Drive folder

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON');

  const { filename, mimeType, base64, sheetRowMeta } = body || {};
  if (!filename || !mimeType || !base64) return bad(headers, 'Missing filename, mimeType, or base64');
  if (!ALLOWED_MIME.includes(mimeType)) return bad(headers, 'Disallowed file type');

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_UPLOAD_BYTES) return bad(headers, 'File too large');

  // sanitize filename
  const safeName = filename.replace(/[^\w.\-() ]/g, '_').slice(0, 120);

  try {
    const auth = getGoogleAuth();
    await auth.authorize();
    const drive = driveClient(auth);

    const createRes = await drive.files.create({
      requestBody: { name: safeName, parents: FOLDER_ID ? [FOLDER_ID] : undefined, mimeType },
      media: { mimeType, body: Readable.from(bytes) },
      fields: 'id, name, mimeType, webViewLink, webContentLink'
    });

    const file = createRes.data;

    // Optional: log to Sheets
    if (SHEET_ID && sheetRowMeta) {
      try {
        const sheets = sheetsClient(auth);
        const values = [[
          new Date().toISOString(),
          file.id, file.name, file.mimeType,
          file.webViewLink || '', file.webContentLink || '',
          JSON.stringify(sheetRowMeta)
        ]];
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Uploads!A:G',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values }
        });
      } catch (logErr) {
        console.warn('uploadDocument: sheet log failed:', logErr.message);
      }
    }

    return ok(headers, { success: true, file });
  } catch (e) {
    console.error('uploadDocument error:', e);
    return serverErr(headers);
  }
};
