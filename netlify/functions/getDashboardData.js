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

function normalizeRec(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  // unify common variants
  if (s === 'respond' || s === 'response' || s === 'recommended: respond') return 'respond';
  if (
    s === 'gather more information' ||
    s === 'gather info' ||
    s === 'need info' ||
    s === 'needs info' ||
    s === 'need more info' ||
    s === 'research'
  ) return 'gather';
  return s;
}
const parseAdmin = (rows = []) => rows.map((r) => ({ status: r[9] || '' })); // col J
const parseWebinars = (rows = []) => rows.map((r) => ({ status: r[6] || '' })); // col G
const parseSocial = (rows = []) => rows.map((r) => ({ status: r[1] || '' })); // col B

// Parse survey data for hot leads
const parseSurveys = (rows = []) => rows.map((r) => ({
  timestamp: r[0] || '',
  email: r[1] || '',
  webinarId: r[2] || '',
  contactRequest: r[9] || ''
}));

const parseRegistrations = (rows = []) => rows.map((r) => ({
  timestamp: r[0] || '',
  webinarId: r[1] || '',
  email: r[3] || ''
}));

// Count hot leads from survey responses
function countHotLeads(surveys, registrations) {
  const leads = new Set();
  const regCountByEmail = new Map();
  
  // Count registrations per email
  registrations.forEach((r) => {
    const email = (r.email || '').toLowerCase().trim();
    if (email) regCountByEmail.set(email, (regCountByEmail.get(email) || 0) + 1);
  });

  const normalizeText = (input) => {
    const s = String(input || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['']/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/\s+/g, ' ').trim();
  };

  surveys.forEach((survey) => {
    const email = (survey.email || '').toLowerCase().trim();
    if (!email) return;

    const valRaw = String(survey.contactRequest || '').trim();
    const norm = normalizeText(valRaw);

    const OPT_REMINDER = normalizeText('🟢 Drop me a reminder in 3 months or so');
    const OPT_MEETING = normalizeText("🟢 🌟 Let's schedule a meeting within the next week");
    const OPT_NO = normalizeText('🔴 No, thank you');

    const isReminderExact = norm === OPT_REMINDER;
    const isMeetingExact = norm === OPT_MEETING;
    const isNoExact = norm === OPT_NO;

    const wantsReminder = isReminderExact || /reminder|3 month/.test(norm);
    const wantsContact = isMeetingExact || (!isNoExact && /(schedule|meeting|contact)/.test(norm));
    const multipleWebinars = (regCountByEmail.get(email) || 0) >= 2;

    if (wantsContact || wantsReminder || multipleWebinars) {
      leads.add(email);
    }
  });

  return leads.size;
}

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
    // --- Use shared Google auth helper ---
    const { getGoogleAuth } = require('./_utils/google');
    const googleAuth = getGoogleAuth();
    const auth = await googleAuth.getClient();
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
        hotLeadsCount: 0,
      }};
      return { statusCode: 200, headers, body: JSON.stringify(payload) };
    }

    // --- Parse just what we need ---
    const activeBids = parseBids(bidsRes?.data?.valueRanges?.[0]?.values || []);
    const adminEmails = parseAdmin(bidsRes?.data?.valueRanges?.[3]?.values || []);
    const webinars = parseWebinars(webinarRes?.data?.valueRanges?.[0]?.values || []);
    const surveys = parseSurveys(webinarRes?.data?.valueRanges?.[1]?.values || []);
    const registrations = parseRegistrations(webinarRes?.data?.valueRanges?.[2]?.values || []);

    const socialPosts = SOC_SHEET
      ? parseSocial(socialRes?.data?.valueRanges?.[0]?.values || [])
      : [];

    // --- Aggregate KPIs (normalized) ---
    const respondCount = activeBids.filter(b => normalizeRec(b.recommendation) === 'respond').length;
    const gatherInfoCount = activeBids.filter(b => normalizeRec(b.recommendation) === 'gather').length;
    const hotLeadsCount = countHotLeads(surveys, registrations);

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
      
      hotLeadsCount: hotLeadsCount,
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
