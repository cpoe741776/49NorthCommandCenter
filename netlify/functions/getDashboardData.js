// netlify/functions/getDashboardData.js
// Responsibility: Fetch ALL sheets data and return ONLY simple counts/KPIs (Analog Data).
// This runs fast to populate the dashboard cards immediately and correctly.
const { google } = require('googleapis');

// =======================
// Config & Setup
// =======================
const CFG = {
  GOOGLE_SCOPES: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  GOOGLE_TIMEOUT_MS: 8000,
  CACHE_TTL_MS: 5 * 60 * 1000 
};

// Simple in-memory cache (will reset on cold starts)
const cache = new Map();
function getCacheKey(spreadsheetId, ranges) { return `${spreadsheetId}-${ranges.join(',')}`; }
function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CFG.CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { cache.set(key, { data, timestamp: Date.now() }); } 

const withTimeout = async (promise, label, ms) => {
  const controller = new AbortController();
  const t = setTimeout(() => { console.warn(`[DashboardData] Timeout for ${label} after ${ms}ms`); controller.abort(); }, ms);
  try {
    const result = await promise;
    clearTimeout(t);
    return result;
  } catch (error) {
    clearTimeout(t);
    return null; 
  }
};

// =======================
// MAIN HANDLER
// =======================
exports.handler = async (event, context) => {
  try {
    let serviceAccountKey;
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
        serviceAccountKey = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'));
      } else {
        serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      }
    } catch (parseError) { throw new Error('Invalid service account credentials'); }

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: CFG.GOOGLE_SCOPES
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Define all data ranges
    const bidRanges = ['Active_Bids!A2:U', 'Submitted!A2:U', 'Disregarded!A2:U', 'Active_Admin!A2:J'];
    const webinarRanges = ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F'];
    const socialRanges = ['MainPostData!A2:R'];

    const cacheKey = getCacheKey(process.env.GOOGLE_SHEET_ID, bidRanges.concat(webinarRanges, socialRanges)); 
    
    // Check Backend Cache
    const bypassBackendCache = event.queryStringParameters && event.queryStringParameters.t;
    let cachedResponse = bypassBackendCache ? null : getCached(cacheKey);

    if (cachedResponse) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }, body: JSON.stringify(cachedResponse) };
    }

    // Fetch all sheets
    const [bidsRes, webinarRes, socialRes] = await Promise.all([
      withTimeout(sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.GOOGLE_SHEET_ID, ranges: bidRanges }), 'bidsBatchGet', CFG.GOOGLE_TIMEOUT_MS),
      withTimeout(sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.WEBINAR_SHEET_ID, ranges: webinarRanges }), 'webinarBatchGet', CFG.GOOGLE_TIMEOUT_MS),
      withTimeout(sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID, ranges: socialRanges }), 'socialBatchGet', CFG.GOOGLE_TIMEOUT_MS),
    ]);
    
    if (!bidsRes || !webinarRes) throw new Error('Failed to fetch critical sheet data.');

    // Parse Data (only fields needed for counts)
    const activeBids = parseBids(bidsRes?.data.valueRanges[0]?.values || []);
    const adminEmails = parseAdminEmails(bidsRes?.data.valueRanges[3]?.values || []); 
    const webinars = parseWebinars(webinarRes?.data.valueRanges[0]?.values || []);
    const socialPosts = parseSocialPosts(socialRes?.data.valueRanges[0]?.values || []);

    // --------------------------------
    // Aggregate Counts (FIXES ADMIN COUNT ISSUE)
    // --------------------------------
    const respondBids = activeBids.filter(b => b.recommendation === 'Respond').length;
    const gatherInfoBids = activeBids.filter(b => b.recommendation === 'Gather More Information').length;

    const finalSummary = {
      // FIX: Admin count is now accurately derived from the parsed rows array length
      adminEmailsCount: adminEmails.length, 
      newAdminEmailsCount: adminEmails.filter(e => e.status === 'New').length,
      
      activeBidsCount: activeBids.length,
      respondCount: respondBids,
      gatherInfoCount: gatherInfoBids,
      
      completedWebinars: webinars.filter(w => w.status === 'Completed').length,
      totalWebinars: webinars.length,
      
      socialPostsTotal: socialPosts.length,
      socialPostsPublished: socialPosts.filter(p => p.status === 'Published').length,
      socialPostsDrafts: socialPosts.filter(p => p.status === 'Draft').length,
    };
    
    const responsePayload = { summary: finalSummary, success: true };
    setCache(cacheKey, responsePayload);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify(responsePayload)
    };

  } catch (error) {
    console.error('[DashboardData] Error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

// --- UTILITY FUNCTIONS (Copied from getAIInsights.js for self-containment) ---

// Minimal Bids Parser (only need recommendation for the card counts)
function parseBids(rows) { 
  if (!rows) return [];
  return rows.map((row) => ({ 
    recommendation: row[0] || '', // Needed for respond/gather counts
  })); 
}

// Admin Emails Parser (Needs status and sourceEmailId if used elsewhere, but mainly status)
function parseAdminEmails(rows) { 
  if (!rows) return [];
  return rows.map((row) => ({ 
    status: row[9] || '', // Status is column J (index 9)
    // We only need status to filter for 'New', and the length for the total count.
  })); 
}

// Webinars Parser
function parseWebinars(rows) { 
  if (!rows) return [];
  return rows.map((row) => ({ 
    status: row[6] || '', 
  })); 
}

// Social Posts Parser
function parseSocialPosts(rows) { 
  if (!rows) return [];
  return rows.map((row) => ({ 
    status: row[1] || '', 
  })); 
}