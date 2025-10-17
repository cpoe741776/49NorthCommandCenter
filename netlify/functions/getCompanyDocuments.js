// netlify/functions/getCompanyDocuments.js
const { getGoogleAuth, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, ok, serverErr } = require('./_utils/http');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID; // Sheet with "CompanyDocuments" tab (A:H)

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
    await auth.getClient(); // Use getClient() instead of deprecated authorize()
    const sheets = sheetsClient(auth);

    // CompanyDocuments tab A:H (8 columns):
    // A Document ID | B Category | C Document Name | D File Type | E Upload Date
    // F Drive File ID | G File Size | H Notes
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'CompanyDocuments!A2:H', // Start at row 2 to skip header
    });

    const rows = res.data.values || [];

    const documents = rows.map((r, i) => {
      const rowNumber = i + 2; // Row 2 is first data row

      const documentId = r[0] || '';
      const category = r[1] || 'Other';
      const documentName = r[2] || '';
      const fileType = r[3] || 'application/octet-stream';
      const uploadDate = r[4] || '';
      const driveFileId = r[5] || '';
      const fileSize = r[6] || '';
      const notes = r[7] || '';

      return {
        id: rowNumber,       // used by deleteDocument to delete the row
        documentId,          // Document ID from column A
        driveFileId,         // Drive File ID from column F
        documentName,        // Document Name from column C
        fileType,            // File Type from column D
        fileSize,            // File Size from column G
        uploadDate,          // Upload Date from column E (as-is from sheet)
        notes,               // Notes from column H
        category,            // Category from column B
        driveLink: driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : '',
        _raw: r              // Keep raw for debugging
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
