// netlify/functions/getCompanyDocuments.js
const { getGoogleAuth, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, ok, serverErr } = require('./_utils/http');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID; // Sheet with "Uploads" tab (A:G)

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  // Support GET and OPTIONS
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    if (!SHEET_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'COMPANY_DATA_SHEET_ID not set' })
      };
    }

    const auth = getGoogleAuth();
    await auth.authorize();
    const sheets = sheetsClient(auth);

    // Expecting Uploads!A:G matching uploadDocument.js appends:
    // A uploadedAt | B driveFileId | C filename | D mimeType
    // E webViewLink | F webContentLink | G meta JSON
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Uploads!A:G',
    });

    const rows = res.data.values || [];

    // Detect header row (look for "uploaded" in A1); if present, slice it off
    const hasHeader = rows[0] && /uploaded/i.test(String(rows[0][0] || ''));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const documents = dataRows.map((r, i) => {
      // Compute 1-based sheet row number for deletion:
      // if header exists, first data row is row 2; else row 1
      const rowNumber = (hasHeader ? 2 : 1) + i;

      const uploadedAt = r[0] || '';
      const driveFileId = r[1] || '';
      const documentName = r[2] || '';
      const mimeType = r[3] || '';
      const webViewLink = r[4] || '';
      const webContentLink = r[5] || '';
      let meta = {};
      try { meta = JSON.parse(r[6] || '{}'); } catch { meta = {}; }

      return {
        id: rowNumber, // used by deleteDocument to delete the row
        driveFileId,   // used by deleteDocument to delete the Drive file (optional)
        documentName,
        fileType: mimeType || 'application/octet-stream',
        fileSize: meta.sizeReadable || '',
        uploadDate: uploadedAt ? new Date(uploadedAt).toLocaleDateString() : '',
        notes: meta.notes || '',
        category: meta.category || 'Other',
        driveLink: webViewLink || webContentLink || '',
        // optional raw fields for debugging/auditing:
        _uploadedAtRaw: uploadedAt || '',
      };
    });

    // Group by category for the UI
    const grouped = documents.reduce((acc, doc) => {
      const key = doc.category || 'Other';
      (acc[key] ||= []).push(doc);
      return acc;
    }, {});

    return ok(headers, { success: true, grouped, flat: documents });
  } catch (e) {
    console.error('getCompanyDocuments error:', e);
    return serverErr(headers, 'Failed to load company documents');
  }
};
