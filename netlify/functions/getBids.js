// netlify/functions/getBids.js
// Header alignment audit + tiny resilience tweaks
// - Active_Bids: A..U (21 cols)
// - Disregarded: A..U (21 cols)
// - Submitted:   A..V (22 cols; V = Submission Date)
// - Provides back-compat aliases so UI renders consistently across tabs
//
// IMPORTANT CHANGE (Never break again):
// - Bid "id" is now Source Email ID (stable), NOT sheet row number.
// - Row number is still available as sheetRowNumber (debug only).

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
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const ifNoneMatch = event.headers?.['if-none-match'] || event.headers?.['If-None-Match'];
    const forceNoCache = event.queryStringParameters?.nocache === '1';


    // Serve from cache if fresh and ETag matches
if (!forceNoCache && cache.payload && Date.now() - cache.ts < CACHE_TTL_MS) {
  if (ifNoneMatch && ifNoneMatch === cache.etag) {
    return { statusCode: 304, headers: { ...headers, ETag: cache.etag } };
  }
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

    // ---------- Submitted (A..U; U = Submission Date) ----------
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

function stableIdFromSourceEmailId(sourceEmailId, sheetRowNumber) {
  const sid = String(sourceEmailId || '').trim();
  if (sid) return sid;

  // Fallback (should be rare): stable-ish ID based on row number, so UI still works.
  // Better than breaking, but ideally Source Email ID is always populated.
  return `ROW-${sheetRowNumber}`;
}

// Active/Disregarded row -> unified bid (A..U)
function toBid(row, sheetRowNumber, fallbackStatus) {
  const sourceEmailId = vAt(row, 20); // U
  return {
    // ✅ stable ID used by UI / selection / status updates
    id: stableIdFromSourceEmailId(sourceEmailId, sheetRowNumber),

    // debug only (helps you diagnose row-level issues without using as identifier)
    sheetRowNumber,

    recommendation: vAt(row, 0),      // A
    scoreDetails: vAt(row, 1),        // B

    // Mapping is strictly alphabetical A=0, B=1, C=2, D=3, etc.
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
    sourceEmailId: sourceEmailId,     // U

    // Back-compat aliases
    aiSummary: vAt(row, 3),
    emailSummary: vAt(row, 3),
    subject: vAt(row, 9),
    from: vAt(row, 5),
  };
}

// Submitted row -> unified bid (A..U)
function toSubmittedBid(row, sheetRowNumber) {
  const sourceEmailId = vAt(row, 19); // T
  return {
    // ✅ stable ID used by UI / selection (even though submitted doesn’t move often)
    id: stableIdFromSourceEmailId(sourceEmailId, sheetRowNumber),

    // debug only
    sheetRowNumber,

    recommendation: vAt(row, 0),        // A
    reasoning: vAt(row, 1),             // B - Reasoning (non-AI)
    emailSummary: vAt(row, 2),          // C - Email Summary (non-AI)
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
    sourceEmailId: sourceEmailId,       // T
    submissionDate: vAt(row, 20),       // U

    // Back-compat aliases so BidCard/Modal resolve gracefully
    aiReasoning: vAt(row, 1),
    aiEmailSummary: vAt(row, 2),
    aiSummary: vAt(row, 2),
    subject: vAt(row, 8),
    from: vAt(row, 4),
  };
}
