// netlify/functions/getTickerFeed.js
// Hardened ticker feed: resilient to sheet issues and ESLint clean.

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const TAB_CANDIDATES = ['Ticker', 'TickerItems']; // fallback tab names
const RANGE_A_F = (tab) => `${tab}!A2:F`; // A-F = timestamp, message, priority, source, active, expiresOn

async function readTickerRows(sheets, spreadsheetId) {
  // Try each candidate tab until one returns data
  for (const tab of TAB_CANDIDATES) {
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: RANGE_A_F(tab)
      });
      const rows = resp.data?.values || [];
      if (rows.length) {
        return { rows, tabUsed: tab };
      }
    } catch (err) {
      // Keep trying other tabs; log and continue
      console.warn(`[getTickerFeed] Could not read tab "${tab}":`, err?.message);
    }
  }
  return { rows: [], tabUsed: null };
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const headers = corsHeaders(event.headers?.origin);

  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // If env missing, return empty (200) so UI doesn't break
    if (!spreadsheetId) {
      console.warn('[getTickerFeed] GOOGLE_SHEET_ID is not set.');
      return ok(headers, { success: true, items: [], note: 'Missing GOOGLE_SHEET_ID' });
    }

    // Google auth
    let auth;
    try {
      auth = getGoogleAuth();
      await auth.authorize();
    } catch (authErr) {
      console.error('[getTickerFeed] Google auth failure:', authErr?.message);
      // Return 200 with empty items; keep UI alive
      return ok(headers, { success: true, items: [], note: 'Google auth failed' });
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // Read rows (with fallback tabs)
    const { rows, tabUsed } = await readTickerRows(sheets, spreadsheetId);

    if (!rows.length) {
      // No rows anywhere—return empty successfully
      return ok(headers, { success: true, items: [], note: 'No ticker rows found', tabUsed });
    }

    // Map rows → items (A-F = timestamp, message, priority, source, active, expiresOn)
    const nowMs = Date.now();

    const items = rows
      .map((r, idx) => {
        // Ensure indexes are safe even if row is short
        const timestamp = r[0] || '';
        const message = (r[1] || '').trim();                // Column B
        const priority = String(r[2] || 'low').toLowerCase();
        const source = r[3] || 'manual';
        const activeRaw = r[4];
        const expiresOn = r[5] || '';

        // Interpret active: default TRUE unless explicitly "FALSE"
        const active = String(activeRaw ?? 'TRUE').toUpperCase() !== 'FALSE';

        // Compute expiration ms if provided
        const expiresMs = expiresOn ? Date.parse(expiresOn) : NaN;
        const _expiresMs = Number.isFinite(expiresMs) ? expiresMs : null;

        return {
          timestamp,
          message,
          priority,
          source,
          active,
          expiresOn,
          _expiresMs,
          _rowIndex: idx + 2 // 1-based including header
        };
      })
      .filter((i) => i.active && i.message.length > 0)
      .filter((i) => !i._expiresMs || i._expiresMs > nowMs)
      .map(({ _expiresMs, _rowIndex, ...rest }) => rest); // strip helpers

    return ok(headers, { success: true, items, tabUsed });
  } catch (err) {
    // Final safety net: never 500—return empty list and a note
    console.error('[getTickerFeed] Unexpected error:', err);
    return ok(headers, {
      success: true,
      items: [],
      note: 'Unexpected error; returning empty set',
    });
  }
};
