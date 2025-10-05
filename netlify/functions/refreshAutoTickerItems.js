// netlify/functions/refreshAutoTickerItems.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items = [] } = JSON.parse(event.body || '{}');

    // Service account
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Use one env var consistently for the sheet ID
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_SHEET_ID not set' }) };
    }

    // Keep tab name consistent across all functions
    const TICKER_TAB = process.env.TICKER_TAB || 'TickerFeed';

    // 1) Mark existing auto rows inactive
    const getResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TICKER_TAB}!A2:F`,
    });

    const rows = getResp.data.values || [];
    const updates = [];
    rows.forEach((row, idx) => {
      const source = row[3];         // D = source
      const active = row[4];         // E = active
      if (source === 'auto' && (active === 'TRUE' || active === true || active === '' || active == null)) {
        // set active = FALSE
        updates.push({
          range: `${TICKER_TAB}!E${idx + 2}`,
          values: [['FALSE']],
        });
      }
    });

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: { data: updates, valueInputOption: 'USER_ENTERED' },
      });
    }

    // 2) Append new auto items (A:F), active=TRUE, expiresOn=now+7 days
    if (items.length) {
      const now = new Date();
      const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
      const defaultExpiry = addDays(now, 7).toISOString();

      const values = items.map(item => [
        item.timestamp || now.toISOString(),     // A timestamp
        item.message,                            // B message
        item.priority || 'medium',               // C priority
        'auto',                                  // D source
        'TRUE',                                  // E active
        item.expiresOn || defaultExpiry,         // F expiresOn
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${TICKER_TAB}!A:F`,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
      });
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, appended: items.length }) };
  } catch (error) {
    console.error('Error refreshing ticker items:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
