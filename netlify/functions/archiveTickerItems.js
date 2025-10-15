// netlify/functions/archiveTickerItems.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TICKER_TAB = process.env.TICKER_TAB || 'TickerFeed'; // A=timestamp B=message C=priority D=source E=active F=expiresOn

function toBool(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}
function parseDate(d) {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }

  try {
    if (!SHEET_ID) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'GOOGLE_SHEET_ID not set' }) };
    }

    // creds: base64 or raw json
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Read rows (skip header explicitly)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TICKER_TAB}!A2:F`,
    });

    const rows = response.data.values || [];
    if (!rows.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, archived: 0 }) };
    }

    const now = Date.now();
    const updates = [];
    let archivedCount = 0;

    // Iterate rows; rowIndex in sheet = i + 2
    rows.forEach((row, i) => {
      const active = toBool(row[4]);      // E = active
      const expiresOnRaw = row[5];        // F = expiresOn
      const expiresOn = parseDate(expiresOnRaw);

      if (active && expiresOn && expiresOn.getTime() < now) {
        // Mark E to FALSE
        updates.push({
          range: `${TICKER_TAB}!E${i + 2}`,
          values: [['FALSE']],
        });
        archivedCount++;
      }
    });

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, archived: archivedCount }) };
  } catch (error) {
    console.error('archiveTickerItems error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Failed to archive ticker items' }) };
  }
};
