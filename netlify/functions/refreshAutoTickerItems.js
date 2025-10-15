// netlify/functions/refreshAutoTickerItems.js
const { google } = require('googleapis');

const corsHeaders = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const items = Array.isArray(body.items) ? body.items : [];
    const source = (body.source || 'auto').toString();

    // Env guards
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GOOGLE_SHEET_ID not set' }) };
    }

    const rawCreds = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      : process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!rawCreds) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Google service account key env var not set' }) };
    }

    const credentials = JSON.parse(rawCreds);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const TICKER_TAB = process.env.TICKER_TAB || 'TickerFeed';

    // 1) Mark existing rows with THIS SOURCE as inactive
    const getResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TICKER_TAB}!A2:F`,
    });

    const rows = getResp.data.values || [];
    const updates = [];
    let deactivated = 0;

    rows.forEach((row, idx) => {
      // Columns: A timestamp | B message | C priority | D source | E active | F expiresOn
      const rowSource = row[3];
      const activeVal = (row[4] ?? '').toString().toUpperCase();

      // Only target our source; treat empty active as TRUE by default
      const isActive = activeVal === 'TRUE' || activeVal === '' || activeVal === 'YES';
      if (rowSource === source && isActive) {
        deactivated += 1;
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

    // 2) Append new items with specified source
    let appended = 0;
    if (items.length) {
      const now = new Date();
      const addDays = (d, n) => {
        const r = new Date(d);
        r.setDate(r.getDate() + n);
        return r;
      };
      const defaultExpiry = addDays(now, 7).toISOString();

      const asBoolString = (v) =>
        (typeof v === 'boolean' ? v : `${v}`.toLowerCase() === 'true') ? 'TRUE' : 'FALSE';

      const normalizePriority = (p) => {
        const v = (p || '').toString().toLowerCase();
        return ['low', 'medium', 'high', 'urgent'].includes(v) ? v : 'medium';
      };

      const values = items.map((item) => [
        item.timestamp || now.toISOString(),            // A: timestamp
        (item.message || '').toString(),                // B: message
        normalizePriority(item.priority),               // C: priority
        source,                                         // D: source
        asBoolString(item.active ?? true),              // E: active
        item.expiresOn || defaultExpiry,                // F: expiresOn
      ]);

      if (values.length) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TICKER_TAB}!A:F`,
          valueInputOption: 'USER_ENTERED',
          resource: { values },
        });
        appended = values.length;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, source, deactivated, appended }),
    };
  } catch (error) {
    console.error('refreshAutoTickerItems error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
