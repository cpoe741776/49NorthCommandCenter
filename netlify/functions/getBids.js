// netlify/functions/getBids.js
// Stable IDs + no-304 behavior + cache-bust support
// - Active_Bids: A..U (21 cols)
// - Disregarded: A..U (21 cols)
// - Submitted:   A..U (21 cols; U = Submission Date)
// - Uses Source Email ID (col U) as primary id to avoid row-number drift

const { google } = require('googleapis');
const crypto = require('crypto');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// simple in-memory cache with TTL and ETag
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { ts: 0, etag: '', payload: null };

function makeEtag(payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  return `W/"${hash}"`;
}

// Export cache clearing function for use by other functions
function clearBidsCache() {
  cache = { ts: 0, etag: '', payload: null };
  console.log('[getBids] Cache cleared');
}

exports.clearBidsCache = clearBidsCache;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',

    // Kill browser/proxy caching (ETag revalidation causes your 304 issue)
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const qs = event.queryStringParameters || {};
    const noCache =
      qs.nocache === '1' || qs.nocache === 'true' ||
      qs.force === '1' || qs.force === 'true';

    // Serve from memory cache if fresh AND caller did not bypass
    if (!noCache && cache.payload && Date.now() - cache.ts < CACHE_TTL_MS) {
      // IMPORTANT: do NOT return 304. Always return body to keep fetch clients consistent.
      return { statusCode: 200, headers: { ...headers, ETag: cache.etag }, body: JSON.stringify(cache.payload) };
    }

    // Service account (use shared loader)
    const { loadServiceAccount } = require('./_utils/google');
    const creds = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const nonEmpty = (r) => r && r.length && r.some((c) => String(c || '').trim() !== '');

    // ---------- Active_Bids (A..U) ----------
    const activeResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:U',
    });
    const activeRows = (activeResp.data.values || []).filter(nonEmpty);
    const activeBids = activeRows.map((row, i) => toBid(row, i + 2, 'New'));

    // ---------- Disregarded (A..U) ----------
    const disResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Disregarded!A2:U',
    });
    const disRows = (disResp.data.values || []).filter(nonEmpty);
    const disregardedBids = disRows.map((row, i) => toBid(row, i + 2, 'Disregarded'));

    // ---------- Submitted (A..U) ----------
    const subResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Submitted!A2:U',
    });
    const subRows = (subResp.data.values || []).filter(nonEmpty);
    const submittedBids = subRows.map((row, i) => toSubmittedBid(row, i + 2));

    // Case-insensitive counts, trimmed
    const recKey = (s) => String(s || '').trim().toLowerCase();
    const respondCount = activeBids.filter((b) => recKey(b.recommendation) === 'respond').length;
    const gatherInfoCount = activeBids.filter((b) => recKey(b.recommendation) === 'gather more information').length;

    const payload = {
      success: true,
      activeBids,
      disregardedBids,
      submittedBids,
      summary: {
        totalActive: activeBids.length,
        respondCount,
        gatherInfoCount,
        totalDisregarded: disregardedBids.length,
        totalSubmitted: submittedBids.length,
      },
      meta: {
        noCache,
        generatedAt: new Date().toISOString(),
      },
    };

    const etag = makeEtag(payload);
    cache = { ts: Date.now(), etag, payload };

    return { statusCode: 200, headers: { ...headers, ETag: etag }, body: JSON.stringify(payload) };
  } catch (error) {
    console.error('Error fetching bids:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// ----- helpers & mappers -----
function vAt(row, i) {
  return row && row[i] != null ? row[i] : '';
}

// Active/Disregarded row -> unified bid (A..U)
function toBid(row, sheetRowNumber, fallbackStatus) {
  const sourceEmailId = String(vAt(row, 20) || '').trim(); // U
  return {
    // IMPORTANT: stable ID for frontend selections/actions
    id: sourceEmailId || String(sheetRowNumber),

    // Keep rowNumber for debugging only
    rowNumber: sheetRowNumber,

    recommendation: vAt(row, 0),      // A
    scoreDetails: vAt(row, 1),        // B
    aiReasoning: vAt(row, 2),         // C
    aiEmailSummary: vAt(row, 3),      // D
    emailDateReceived: vAt(row, 4),   // E
    emailFrom: vAt(row, 5),           // F
    keywordsCategory: vAt(row, 6),    // G
    keywordsFound: vAt(row, 7),       // H
    relevance: vAt(row, 8),           // I
    emailSubject: vAt(row, 9),        // J
    emailBody: vAt(row, 10),          // K
    url: vAt(row, 11),                // L
    dueDate: vAt(row, 12),            // M
    significantSnippet: vAt(row, 13), // N
    emailDomain: vAt(row, 14),        // O
    bidSystem: vAt(row, 15),          // P
    country: vAt(row, 16),            // Q
    entity: vAt(row, 17),             // R
    status: vAt(row, 18) || fallbackStatus, // S
    dateAdded: vAt(row, 19),          // T
    sourceEmailId: vAt(row, 20),      // U

    // Back-compat aliases
    aiSummary: vAt(row, 3),
    emailSummary: vAt(row, 3),
    subject: vAt(row, 9),
    from: vAt(row, 5),
  };
}

// Submitted row -> unified bid (A..U)
function toSubmittedBid(row, sheetRowNumber) {
  const sourceEmailId = String(vAt(row, 19) || '').trim(); // Submitted uses T for sourceEmailId
  return {
    id: sourceEmailId || String(sheetRowNumber),
    rowNumber: sheetRowNumber,

    recommendation: vAt(row, 0),        // A
    reasoning: vAt(row, 1),             // B
    emailSummary: vAt(row, 2),          // C
    emailDateReceived: vAt(row, 3),     // D
    emailFrom: vAt(row, 4),             // E
    keywordsCategory: vAt(row, 5),      // F
    keywordsFound: vAt(row, 6),         // G
    relevance: vAt(row, 7),             // H
    emailSubject: vAt(row, 8),          // I
    emailBody: vAt(row, 9),             // J
    url: vAt(row, 10),                  // K
    dueDate: vAt(row, 11),              // L
    significantSnippet: vAt(row, 12),   // M
    emailDomain: vAt(row, 13),          // N
    bidSystem: vAt(row, 14),            // O
    country: vAt(row, 15),              // P
    entity: vAt(row, 16),               // Q
    status: vAt(row, 17) || 'Submitted',// R
    dateAdded: vAt(row, 18),            // S
    sourceEmailId: vAt(row, 19),        // T
    submissionDate: vAt(row, 20),       // U

    // Back-compat aliases
    aiReasoning: vAt(row, 1),
    aiEmailSummary: vAt(row, 2),
    aiSummary: vAt(row, 2),
    subject: vAt(row, 8),
    from: vAt(row, 4),
  };
}
