// netlify/functions/getTickerFeed.js
// Consistent JSON shape + CORS + optional shared-secret auth

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, serverErr, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// Adjust tab name if yours differs:
const TAB_NAME = process.env.TICKER_TAB_NAME || 'TickerFeed';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  // Allow GET and preflight
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  // Optional shared-secret: if APP_INBOUND_TOKEN is set, require X-App-Token
  if (!checkAuth(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
  }

  // Basic env validation
  if (!SHEET_ID) {
    console.error('[TickerFeed] Missing GOOGLE_SHEET_ID');
    return serverErr(headers, 'Missing configuration');
  }

  try {
    // Google auth + Sheets client (this uses `google`, satisfying ESLint)
    const auth = getGoogleAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Expect columns (A..H):
    // A: createdAt | B: message | C: category | D: source | E: link | F: recommendation | G: urgency | H: status
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A2:H`
    });

    const rows = resp.data.values || [];
    const items = rows.map((r) => ({
      createdAt: r[0] || '',
      message: r[1] || '',
      category: r[2] || '',
      source: r[3] || '',
      link: r[4] || '',
      recommendation: r[5] || '',
      urgency: r[6] || '',
      status: r[7] || '' // e.g. '', 'Archived'
    }));

    return ok(headers, { success: true, items });
  } catch (error) {
    console.error('[TickerFeed] Error:', error?.message || error);
    return serverErr(headers);
  }
};
