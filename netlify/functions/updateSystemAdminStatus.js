// updateSystemAdminStatus.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID; // confirm this is the right one

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { sourceEmailId, status } = JSON.parse(event.body || '{}');
    if (!sourceEmailId) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing sourceEmailId' }) };
    }

    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Read rows in Active_Admin
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Admin!A2:J',
    });
    const rows = res.data.values || [];

    // Find row by Source Email ID in column I (index 8)
    let targetRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][8] || '') === sourceEmailId) {
        targetRowIndex = i + 2; // sheet row number
        break;
      }
    }
    if (targetRowIndex === -1) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Email not found' }) };
    }

    // Delete the row (archive-by-delete)
    const activeSheetId = await getSheetId(sheets, SHEET_ID, 'Active_Admin');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: activeSheetId, dimension: 'ROWS', startIndex: targetRowIndex - 1, endIndex: targetRowIndex },
          },
        }],
      },
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: true, statusUsed: status || null }) };
  } catch (error) {
    console.error('Error archiving admin email:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

async function getSheetId(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (metadata.data.sheets || []).find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : 0;
}
