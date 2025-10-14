// netlify/functions/getTickerFeed.js
const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const auth = getGoogleAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // A-F = timestamp, message, priority, source, active, expiresOn
    const range = 'Ticker!A2:F';
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range
    });

    const nowMs = Date.now();
    const rows = resp.data.values || [];

    const items = rows
      .map((r) => {
        const expiresMs = r[5] ? Date.parse(r[5]) : NaN;
        const active = String(r[4] ?? 'TRUE').toUpperCase() !== 'FALSE';

        return {
          timestamp: r[0] || '',
          message: (r[1] || '').trim(),                      // B (message)
          priority: String(r[2] || 'low').toLowerCase(),     // C
          source: r[3] || 'manual',                          // D
          active,
          expiresOn: r[5] || '',
          _expiresMs: Number.isFinite(expiresMs) ? expiresMs : null // used in filter below
        };
      })
      .filter((i) => i.active && i.message.length > 0)
      .filter((i) => !i._expiresMs || i._expiresMs > nowMs)
      .map(({ _expiresMs, ...rest }) => rest); // strip helper

    return ok(headers, { success: true, items });
  } catch (err) {
    console.error('[getTickerFeed] Error:', err?.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to load ticker feed' }) };
  }
};
