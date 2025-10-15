// netlify/functions/getComprehensiveTicker.js
// Comprehensive ticker that aggregates real-time data from all sources
// Returns all metrics and data needed for the ticker display

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const CFG = {
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '8000', 10),
  SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
  BID_SYSTEMS_SHEET_ID: process.env.BID_SYSTEMS_SHEET_ID || '',
  WEBINAR_SHEET_ID: process.env.WEBINAR_SHEET_ID || '',
  SOCIAL_MEDIA_SHEET_ID: process.env.SOCIAL_MEDIA_SHEET_ID || '',
  COMPANY_DATA_SHEET_ID: process.env.COMPANY_DATA_SHEET_ID || ''
};

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

function normalizeRecommendation(rec) {
  const r = String(rec || '').toLowerCase().trim();
  if (r === 'respond') return 'respond';
  if (r.includes('gather') || r.includes('need') || r.includes('research')) return 'gather';
  return r;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function daysUntil(date) {
  if (!date) return null;
  const parsed = parseDate(date);
  if (!parsed) return null;
  const now = new Date();
  const diffTime = parsed.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isRecent(dateStr, days = 7) {
  const parsed = parseDate(dateStr);
  if (!parsed) return false;
  const now = new Date();
  const diffTime = now.getTime() - parsed.getTime();
  return diffTime <= (days * 24 * 60 * 60 * 1000);
}

async function fetchBidsData(auth) {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch all bid-related sheets
    const [activeRes, submittedRes, disregardedRes] = await Promise.all([
      withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId: CFG.SHEET_ID,
          range: 'Active_Bids!A2:Z'
        }),
        'activeBids',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId: CFG.SHEET_ID,
          range: 'Submitted!A2:Z'
        }),
        'submittedBids',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId: CFG.SHEET_ID,
          range: 'Disregarded!A2:Z'
        }),
        'disregardedBids',
        CFG.GOOGLE_TIMEOUT_MS
      )
    ]);

    const activeRows = activeRes?.data?.values || [];
    const submittedRows = submittedRes?.data?.values || [];
    const disregardedRows = disregardedRes?.data?.values || [];

    // Process active bids
    const activeBids = activeRows.map(row => ({
      subject: row[0] || '',
      entity: row[1] || '',
      bidSystem: row[2] || '',
      recommendation: normalizeRecommendation(row[3]),
      dueDate: row[4] || '',
      url: row[5] || '',
      daysUntilDue: daysUntil(row[4]),
      emailDateReceived: row[6] || '',
      dateAdded: row[7] || ''
    }));

    // Process submitted bids
    const submittedBids = submittedRows.map(row => ({
      subject: row[0] || '',
      entity: row[1] || '',
      bidSystem: row[2] || '',
      status: 'submitted',
      url: row[3] || '',
      emailDateReceived: row[4] || '',
      dateAdded: row[5] || ''
    }));

    // Process disregarded bids
    const disregardedBids = disregardedRows.map(row => ({
      subject: row[0] || '',
      entity: row[1] || '',
      bidSystem: row[2] || '',
      status: 'disregarded',
      aiReasoning: row[3] || '',
      url: row[4] || '',
      emailDateReceived: row[5] || '',
      dateAdded: row[6] || ''
    }));

    // Calculate counts
    const activeBidsCount = activeBids.filter(b => b.recommendation === 'respond').length;
    const recentDisregardedCount = disregardedBids.filter(b => isRecent(b.dateAdded || b.emailDateReceived)).length;

    // Priority bids (respond recommendations with due dates soon)
    const priorityBids = activeBids
      .filter(b => b.recommendation === 'respond' && b.daysUntilDue !== null)
      .sort((a, b) => (a.daysUntilDue || 999) - (b.daysUntilDue || 999))
      .slice(0, 5);

    return {
      activeBidsCount,
      recentDisregardedCount,
      priorityBids,
      activeBids,
      submittedBids,
      disregardedBids
    };
  } catch (err) {
    console.error('[Bids] Error:', err?.message);
    return {
      activeBidsCount: 0,
      recentDisregardedCount: 0,
      priorityBids: [],
      activeBids: [],
      submittedBids: [],
      disregardedBids: []
    };
  }
}

async function fetchWebinarData(auth) {
  try {
    if (!CFG.WEBINAR_SHEET_ID) {
      return {
        upcomingWebinars: [],
        upcomingWebinarRegistrations: 0,
        recentWebinarRegistrations: 0,
        surveyContactsToContact: []
      };
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch webinar-related sheets
    const [webinarsRes, registrationsRes, surveyRes] = await Promise.all([
      withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId: CFG.WEBINAR_SHEET_ID,
          range: 'Webinars!A2:Z'
        }),
        'webinars',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId: CFG.WEBINAR_SHEET_ID,
          range: 'Registrations!A2:Z'
        }),
        'registrations',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId: CFG.WEBINAR_SHEET_ID,
          range: 'Survey_Responses!A2:Z'
        }),
        'surveyResponses',
        CFG.GOOGLE_TIMEOUT_MS
      )
    ]);

    const webinarRows = webinarsRes?.data?.values || [];
    const registrationRows = registrationsRes?.data?.values || [];
    const surveyRows = surveyRes?.data?.values || [];

    // Process webinars
    const webinars = webinarRows.map(row => ({
      title: row[0] || '',
      startTime: row[1] || '',
      registrationUrl: row[2] || '',
      daysUntil: daysUntil(row[1])
    }));

    // Upcoming webinars (next 30 days)
    const upcomingWebinars = webinars
      .filter(w => w.daysUntil !== null && w.daysUntil >= 0 && w.daysUntil <= 30)
      .sort((a, b) => (a.daysUntil || 999) - (b.daysUntil || 999));

    // Process registrations
    const registrations = registrationRows.map(row => ({
      webinarTitle: row[0] || '',
      name: row[1] || '',
      email: row[2] || '',
      registrationDate: row[3] || ''
    }));

    // Upcoming webinar registrations
    const upcomingWebinarRegistrations = registrations.filter(r => 
      upcomingWebinars.some(w => w.title === r.webinarTitle)
    ).length;

    // Recent registrations (last 7 days)
    const recentWebinarRegistrations = registrations.filter(r => 
      isRecent(r.registrationDate)
    ).length;

    // Survey contacts to contact (Column J = "Yes")
    const surveyContactsToContact = surveyRows
      .filter(row => String(row[9] || '').toLowerCase().trim() === 'yes')
      .map(row => ({
        name: row[0] || '',
        email: row[1] || '',
        webinarTitle: row[2] || '',
        responseDate: row[3] || ''
      }));

    return {
      upcomingWebinars,
      upcomingWebinarRegistrations,
      recentWebinarRegistrations,
      surveyContactsToContact
    };
  } catch (err) {
    console.error('[Webinars] Error:', err?.message);
    return {
      upcomingWebinars: [],
      upcomingWebinarRegistrations: 0,
      recentWebinarRegistrations: 0,
      surveyContactsToContact: []
    };
  }
}

async function fetchSocialMediaData(auth) {
  try {
    if (!CFG.SOCIAL_MEDIA_SHEET_ID) {
      return {
        recentSocialPosts: [],
        scheduledSocialCount: 0,
        socialThisWeek: 0,
        socialThisMonth: 0
      };
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: CFG.SOCIAL_MEDIA_SHEET_ID,
        range: 'MainPostData!A2:Z'
      }),
      'socialMedia',
      CFG.GOOGLE_TIMEOUT_MS
    );

    const rows = res?.data?.values || [];
    
    const posts = rows.map(row => ({
      title: row[0] || '',
      text: row[1] || '',
      platform: row[2] || '',
      url: row[3] || '',
      permalink: row[4] || '',
      publishedAt: row[5] || '',
      scheduledFor: row[6] || '',
      status: row[7] || ''
    }));

    // Recent published posts (last 7 days)
    const recentSocialPosts = posts.filter(p => 
      p.status === 'published' && isRecent(p.publishedAt)
    );

    // Scheduled posts
    const scheduledSocialCount = posts.filter(p => 
      p.status === 'scheduled' && p.scheduledFor
    ).length;

    // Posts this week
    const socialThisWeek = posts.filter(p => 
      p.status === 'published' && isRecent(p.publishedAt, 7)
    ).length;

    // Posts this month
    const socialThisMonth = posts.filter(p => 
      p.status === 'published' && isRecent(p.publishedAt, 30)
    ).length;

    return {
      recentSocialPosts,
      scheduledSocialCount,
      socialThisWeek,
      socialThisMonth
    };
  } catch (err) {
    console.error('[Social] Error:', err?.message);
    return {
      recentSocialPosts: [],
      scheduledSocialCount: 0,
      socialThisWeek: 0,
      socialThisMonth: 0
    };
  }
}

async function fetchBidSystemsData(auth) {
  try {
    if (!CFG.BID_SYSTEMS_SHEET_ID) {
      return {
        activeBidSystemsCount: 0,
        recentBidSystemChanges: []
      };
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: CFG.BID_SYSTEMS_SHEET_ID,
        range: 'Active_Admin!A2:Z'
      }),
      'bidSystems',
      CFG.GOOGLE_TIMEOUT_MS
    );

    const rows = res?.data?.values || [];
    
    const systems = rows.map(row => ({
      name: row[0] || '',
      status: row[1] || '',
      dateAdded: row[2] || '',
      dateModified: row[3] || ''
    }));

    // Active systems
    const activeBidSystemsCount = systems.filter(s => 
      s.status.toLowerCase() === 'active'
    ).length;

    // Recent changes (last 7 days)
    const recentBidSystemChanges = systems
      .filter(s => isRecent(s.dateAdded) || isRecent(s.dateModified))
      .map(s => ({
        name: s.name,
        action: isRecent(s.dateAdded) ? 'added' : 'modified'
      }));

    return {
      activeBidSystemsCount,
      recentBidSystemChanges
    };
  } catch (err) {
    console.error('[BidSystems] Error:', err?.message);
    return {
      activeBidSystemsCount: 0,
      recentBidSystemChanges: []
    };
  }
}

async function fetchNewsData() {
  try {
    // Fetch news from our news analysis function
    const res = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/getNewsAnalysis`, {
      headers: {
        'X-App-Token': process.env.APP_TOKEN || 'dev-token'
      }
    });

    if (!res.ok) {
      console.warn('[News] Failed to fetch news data:', res.status);
      return { newsArticles: [] };
    }

    const data = await res.json();
    return {
      newsArticles: data.articles || []
    };
  } catch (err) {
    console.error('[News] Error:', err?.message);
    return { newsArticles: [] };
  }
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('[ComprehensiveTicker] Starting handler...');

  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) {
    console.log('[ComprehensiveTicker] Authentication failed');
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

    // Authenticate with Google
    let auth;
    try {
      auth = getGoogleAuth();
      await auth.authorize();
    } catch (err) {
      console.error('[ComprehensiveTicker] Google auth failure:', err?.message);
      return ok(headers, { success: true, items: [], note: 'Google authentication failed.' });
    }

    // Fetch all data in parallel
    console.log('[ComprehensiveTicker] Fetching data from all sources...');
    const [bidsData, webinarData, socialData, bidSystemsData, newsData] = await Promise.all([
      fetchBidsData(auth),
      fetchWebinarData(auth),
      fetchSocialMediaData(auth),
      fetchBidSystemsData(auth),
      fetchNewsData()
    ]);

    console.log('[ComprehensiveTicker] Data fetched:', {
      bids: bidsData.activeBidsCount,
      webinars: webinarData.upcomingWebinars?.length || 0,
      social: socialData.recentSocialPosts?.length || 0,
      systems: bidSystemsData.activeBidSystemsCount,
      news: newsData.newsArticles?.length || 0
    });

    // Combine all data
    const comprehensiveData = {
      ...bidsData,
      ...webinarData,
      ...socialData,
      ...bidSystemsData,
      ...newsData,
      timestamp: new Date().toISOString()
    };

    return ok(headers, {
      success: true,
      data: comprehensiveData,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('[ComprehensiveTicker] Fatal error:', e?.message || e);
    return ok(headers, { 
      success: true, 
      items: [], 
      note: 'Unexpected error while loading comprehensive ticker data.' 
    });
  }
};
