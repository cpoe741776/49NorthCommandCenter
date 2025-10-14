// netlify/functions/getTickerFeed.js
// Reads ticker rows from Google Sheets (Ticker!A2:F) and returns normalized items.
// Columns: A timestamp | B message | C priority | D source | E active | F expiresOn

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

// ---- Config ----
const CFG = {
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '7000', 10),
  SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
  RANGE: process.env.TICKER_RANGE || 'Ticker!A2:F',
  DEFAULT_LIMIT: 200
};

// ---- Utils ----


async function withTimeout(promise, label, ms) {
  const timer = setTimeout(() => console.warn(`[Timeout] ${label} > ${ms}ms`), ms + 1);
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms))
    ]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if ((err?.message || '').includes('timeout')) {
      console.warn(`[Timeout] ${label} hit timeout`);
      return null;
    }
    throw err;
  }
}

function toBool(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'active';
}

function normalizePriority(p) {
  const s = String(p || '').trim().toLowerCase();
  if (s === 'high' || s === 'urgent' || s === 'critical') return 'high';
  if (s === 'medium' || s === 'med' || s === 'normal') return 'medium';
  if (s === 'low' || s === 'info') return 'low';
  return 'low';
}

function parseDate(d) {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function notExpired(expiresOn) {
  if (!expiresOn) return true;
  const dt = parseDate(expiresOn);
  if (!dt) return true;
  return dt.getTime() >= Date.now();
}

function parseRows(rows) {
  if (!rows || !rows.length) return [];
  // A timestamp | B message | C priority | D source | E active | F expiresOn
  const items = rows
    .map((r) => {
      const message = (r[1] || '').toString().trim();     // col B
      const priority = normalizePriority(r[2]);           // col C
      const source = (r[3] || '').toString().trim();      // col D
      const active = toBool(r[4]);                         // col E
      const expiresOn = (r[5] || '').toString().trim();   // col F

      return { message, priority, source, active, expiresOn };
    })
    .filter((i) => i.message.length > 0)
    .filter((i) => i.active)
    .filter((i) => notExpired(i.expiresOn));

  // De-duplicate on message
  const seen = new Map();
  for (const it of items) {
    if (!seen.has(it.message)) seen.set(it.message, it);
  }
  return Array.from(seen.values());
}

// ---- Handler ----
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  // If you want this endpoint open to unauthenticated users, comment out the next block.
  if (!checkAuth(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    if (!CFG.SHEET_ID) {
      return ok(headers, {
        success: true,
        items: [],
        note: 'GOOGLE_SHEET_ID is not set.'
      });
    }

    // Optional limit param
    const url = new URL(event.rawUrl || `http://local${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const limitParam = parseInt(url.searchParams.get('limit') || `${CFG.DEFAULT_LIMIT}`, 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : CFG.DEFAULT_LIMIT;

    // Auth
    let auth;
    try {
      auth = getGoogleAuth();
      await auth.authorize();
    } catch (err) {
      console.error('[getTickerFeed] Google auth failure:', err?.message);
      return ok(headers, {
        success: true,
        items: [],
        note: 'Google authentication failed (check service account sharing).'
      });
    }

    const sheets = google.sheets({ version: 'v4', auth });

    const res = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: CFG.SHEET_ID,
        range: CFG.RANGE
      }),
      'tickerBatchGet',
      CFG.GOOGLE_TIMEOUT_MS
    );

    if (!res) {
      return ok(headers, {
        success: true,
        items: [],
        note: 'Timed out reading ticker sheet.'
      });
    }

    const rows = res.data?.values || [];
    const items = parseRows(rows).slice(0, limit);

    return ok(headers, {
      success: true,
      count: items.length,
      items
    });
  } catch (e) {
    // Hardened: never 500 for expected sheet issues—still return a body clients can use
    console.error('[getTickerFeed] Fatal error:', e?.message || e);
    return ok(headers, {
      success: true,
      items: [],
      note: 'Unexpected error while loading ticker items.'
    });
  }
};
