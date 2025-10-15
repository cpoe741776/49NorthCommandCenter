// netlify/functions/getDashboardData.js
// Fetch minimal counts/KPIs for dashboard, fast & cache-friendly.

const { google } = require('googleapis');
const crypto = require('crypto');

// ---------- Config ----------
const CFG = {
  SCOPES: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  TIMEOUT_MS: 8000,
  CACHE_TTL_MS: 5 * 60 * 1000,
};

// ---------- CORS ----------
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
  };
}

// ---------- Tiny cache (with ETag) ----------
const cache = new Map();
const makeCacheKey = (ids, ranges) => `${ids.join('|')}::${ranges.join('|')}`;
const getCached = (k) => {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CFG.CACHE_TTL_MS) { cache.delete(k); return null; }
  return e;
};
const setCached = (k, entry) => cache.set(k, { ...entry, ts: Date.now() });

function makeEtag(payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  return `W/"${hash}"`;
}

// ---------- Soft-timeout helper ----------
async function withTimeout(promise, label, ms) {
  let timeout;
  try {
    const race = Promise.race([
      promise,
      new Promise((_, rej) => (timeout = setTimeout(() => rej(new Error(`${label} timeout`)), ms))),
    ]);
    const res = await race;
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    console.warn(`[getDashboardData] ${label} -> ${e.message}`);
    return null; // soft-fail
  }
}

// ---------- Parsers (minimal fields only) ----------
const parseBids = (rows = []) => rows.map((r) => ({ recommendation: r[0] || '' }));
const parseAdmin = (rows = []) => rows.map((r) => ({ status: r[9] || '' })); // col J
const parseWebinars = (rows = []) => rows.map((r) => ({ status: r[6] || '' })); // col G
const parseSocial = (rows = []) => rows.map((r) => ({ status: r[1] || '' })); // col B

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const ifNoneMatch = event.headers?.['if-none-match'] || event.headers?.['If-None-Match'];

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    // --- Credentials ---
    const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      : process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const svc = JSON.parse(keyRaw);

    const auth = new google.auth.JWT({
      email: svc.client_email,
      key: svc.private_key,
      scopes: CFG.SCOPES,
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // --- Sheet IDs ---
    const BID_SHEET = process.env.GOOGLE_SHEET_ID;
    const WEB_SHEET = process.env.WEBINAR_SHEET_ID;
    const SOC_SHEET = process.env.SOCIAL_MEDIA_SHEET_ID;

    if (!BID_SHEET || !WEB_SHEET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'GOOGLE_SHEET_ID and WEBINAR_SHEET_ID are required' }),
      };
    }

    // --- Ranges ---
    const bidRanges = ['Active_Bids!A2:U', 'Submitted!A2:U', 'Disregarded!A2:U', 'Active_Admin!A2:J'];
    const webinarRanges = ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F'];
    const socialRanges = ['MainPostData!A2:R'];

    // --- Cache ---
    const cacheKey = makeCacheKey(
      [BID_SHEET, WEB_SHEET, SOC_SHEET || ''],
      [...bidRanges, ...webinarRanges, ...(SOC_SHEET ? socialRanges : [])]
    );
    const bypass = !!(event.queryStringParameters && event.queryStringParameters.t);
    if (!bypass) {
      const hit = getCached(cacheKey);
      if (hit) {
        if (ifNoneMatch && ifNoneMatch === hit.etag) {
          return { statusCode: 304, headers: { ...headers, ETag: hit.etag } };
        }
        return { statusCode: 200, headers: { ...headers, ETag: hit.etag }, body: JSON.stringify(hit.payload) };
      }
    }

    // --- Fetch in parallel with soft timeouts ---
    const [bidsRes, webinarRes, socialRes] = await Promise.all([
      withTimeout(
        sheets.spreadsheets.values.batchGet({ spreadsheetId: BID_SHEET, ranges: bidRanges }),
        'bidsBatchGet',
        CFG.TIMEOUT_MS
      ),
      withTimeout(
        sheets.spreadsheets.values.batchGet({ spreadsheetId: WEB_SHEET, ranges: webinarRanges }),
        'webinarBatchGet',
        CFG.TIMEOUT_MS
      ),
      SOC_SHEET
        ? withTimeout(
            sheets.spreadsheets.values.batchGet({ spreadsheetId: SOC_SHEET, ranges: socialRanges }),
            'socialBatchGet',
            CFG.TIMEOUT_MS
          )
        : Promise.resolve(null),
    ]);

    if (!bidsRes || !webinarRes) {
      // Critical sheets failed; return a safe empty payload.
      const payload = { success: true, summary: {
        adminEmailsCount: 0, newAdminEmailsCount: 0,
        activeBidsCount: 0, respondCount: 0, gatherInfoCount: 0,
        completedWebinars: 0, totalWebinars: 0,
        socialPostsTotal: 0, socialPostsPublished: 0, socialPostsDrafts: 0,
      }};
      return { statusCode: 200, headers, body: JSON.stringify(payload) };
    }

    // --- Parse just what we need ---
    const activeBids = parseBids(bidsRes?.data?.valueRanges?.[0]?.values || []);
    const adminEmails = parseAdmin(bidsRes?.data?.valueRanges?.[3]?.values || []);
    const webinars = parseWebinars(webinarRes?.data?.valueRanges?.[0]?.values || []);

    const socialPosts = SOC_SHEET
      ? parseSocial(socialRes?.data?.valueRanges?.[0]?.values || [])
      : [];

    // --- Aggregate KPIs ---
    const respondCount = activeBids.filter(b => b.recommendation === 'Respond').length;
    const gatherInfoCount = activeBids.filter(b => b.recommendation === 'Gather More Information').length;

    const summary = {
      adminEmailsCount: adminEmails.length,
      newAdminEmailsCount: adminEmails.filter(e => e.status === 'New').length,

      activeBidsCount: activeBids.length,
      respondCount,
      gatherInfoCount,

      completedWebinars: webinars.filter(w => w.status === 'Completed').length,
      totalWebinars: webinars.length,

      socialPostsTotal: socialPosts.length,
      socialPostsPublished: socialPosts.filter(p => p.status === 'Published').length,
      socialPostsDrafts: socialPosts.filter(p => p.status === 'Draft').length,
    };

    const responsePayload = { success: true, summary };
    const etag = makeEtag(responsePayload);
    setCached(cacheKey, { etag, payload: responsePayload });

    return { statusCode: 200, headers: { ...headers, ETag: etag }, body: JSON.stringify(responsePayload) };
  } catch (error) {
    console.error('[getDashboardData] Error:', error?.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
