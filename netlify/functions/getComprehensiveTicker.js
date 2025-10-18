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
    console.log('[Bids] Starting bid data fetch...');
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch all bid-related sheets
    console.log('[Bids] Fetching from main sheet:', CFG.SHEET_ID);
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
    
    console.log('[Bids] Raw data counts:', {
      active: activeRows.length,
      submitted: submittedRows.length,
      disregarded: disregardedRows.length
    });

    // Process active bids - CORRECTED COLUMN MAPPINGS
    const activeBids = activeRows.map(row => ({
      recommendation: normalizeRecommendation(row[0]), // A = Recommendation
      scoreDetails: row[1] || '', // B = Score Details
      aiReasoning: row[2] || '', // C = AI Reasoning
      emailSummary: row[3] || '', // D = AI Email Summary
      emailDateReceived: row[4] || '', // E = Email Date Received
      emailFrom: row[5] || '', // F = Email From
      keywordsCategory: row[6] || '', // G = Keywords Category
      keywordsFound: row[7] || '', // H = Keywords Found
      relevance: row[8] || '', // I = Relevance
      subject: row[9] || '', // J = Email Subject (was wrong!)
      emailBody: row[10] || '', // K = Email Body
      url: row[11] || '', // L = URL
      dueDate: row[12] || '', // M = Due Date
      significantSnippet: row[13] || '', // N = Significant Snippet
      emailDomain: row[14] || '', // O = Email Domain
      bidSystem: row[15] || '', // P = Bid System
      country: row[16] || '', // Q = Country
      entity: row[17] || '', // R = Entity/Agency
      status: row[18] || '', // S = Status
      dateAdded: row[19] || '', // T = Date Added
      sourceEmailId: row[20] || '', // U = Source Email ID
      daysUntilDue: daysUntil(row[12]) // Calculate from Due Date
    }));

    // Process submitted bids - CORRECTED COLUMN MAPPINGS
    const submittedBids = submittedRows.map(row => ({
      recommendation: normalizeRecommendation(row[0]), // A = Recommendation
      reasoning: row[1] || '', // B = Reasoning
      emailSummary: row[2] || '', // C = Email Summary
      emailDateReceived: row[3] || '', // D = Email Date Received
      emailFrom: row[4] || '', // E = Email From
      keywordsCategory: row[5] || '', // F = Keywords Category
      keywordsFound: row[6] || '', // G = Keywords Found
      relevance: row[7] || '', // H = Relevance
      subject: row[8] || '', // I = Email Subject
      emailBody: row[9] || '', // J = Email Body
      url: row[10] || '', // K = URL
      dueDate: row[11] || '', // L = Due Date
      significantSnippet: row[12] || '', // M = Significant Snippet
      emailDomain: row[13] || '', // N = Email Domain
      bidSystem: row[14] || '', // O = Bid System
      country: row[15] || '', // P = Country
      entity: row[16] || '', // Q = Entity/Agency
      status: row[17] || '', // R = Status
      dateAdded: row[18] || '', // S = Date Added
      sourceEmailId: row[19] || '', // T = Source Email ID
      submissionDate: row[20] || '' // U = Submission Date
    }));

    // Process disregarded bids - CORRECTED COLUMN MAPPINGS
    const disregardedBids = disregardedRows.map(row => ({
      recommendation: normalizeRecommendation(row[0]), // A = Recommendation
      scoreDetails: row[1] || '', // B = Score Details
      aiReasoning: row[2] || '', // C = AI Reasoning
      emailSummary: row[3] || '', // D = AI Email Summary
      emailDateReceived: row[4] || '', // E = Email Date Received
      emailFrom: row[5] || '', // F = Email From
      keywordsCategory: row[6] || '', // G = Keywords Category
      keywordsFound: row[7] || '', // H = Keywords Found
      relevance: row[8] || '', // I = Relevance
      subject: row[9] || '', // J = Email Subject
      emailBody: row[10] || '', // K = Email Body
      url: row[11] || '', // L = URL
      dueDate: row[12] || '', // M = Due Date
      significantSnippet: row[13] || '', // N = Significant Snippet
      emailDomain: row[14] || '', // O = Email Domain
      bidSystem: row[15] || '', // P = Bid System
      country: row[16] || '', // Q = Country
      entity: row[17] || '', // R = Entity/Agency
      status: row[18] || '', // S = Status
      dateAdded: row[19] || '', // T = Date Added
      sourceEmailId: row[20] || '' // U = Source Email ID
    }));

    // Calculate counts - Debug the filtering
    console.log('[Bids] Active bids sample:', activeBids.slice(0, 3).map(b => ({ 
      recommendation: b.recommendation, 
      subject: b.subject?.substring(0, 50) 
    })));
    
    const respondBids = activeBids.filter(b => b.recommendation === 'respond');
    console.log('[Bids] Respond bids count:', respondBids.length);
    
    const activeBidsCount = respondBids.length;
    
    // Debug disregarded bids
    console.log('[Bids] Disregarded bids sample:', disregardedBids.slice(0, 3).map(b => ({
      dateAdded: b.dateAdded,
      emailDateReceived: b.emailDateReceived,
      subject: b.subject?.substring(0, 50)
    })));
    
    const recentDisregardedCount = disregardedBids.filter(b => isRecent(b.dateAdded || b.emailDateReceived)).length;
    console.log('[Bids] Recent disregarded count:', recentDisregardedCount);

    // Priority bids (respond recommendations with due dates soon)
    const priorityBids = activeBids
      .filter(b => b.recommendation === 'respond' && b.daysUntilDue !== null)
      .sort((a, b) => (a.daysUntilDue || 999) - (b.daysUntilDue || 999))
      .slice(0, 5);
      
    console.log('[Bids] Priority bids:', priorityBids.length);

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
      console.log('[Webinars] WEBINAR_SHEET_ID not set, skipping');
      return {
        upcomingWebinars: [],
        upcomingWebinarRegistrations: 0,
        recentWebinarRegistrations: 0,
        surveyContactsToContact: []
      };
    }

    console.log('[Webinars] Starting webinar data fetch from:', CFG.WEBINAR_SHEET_ID);
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

    // Process webinars - CORRECTED COLUMN MAPPINGS
    const webinars = webinarRows.map(row => ({
      webinarId: row[0] || '', // A = Webinar ID
      title: row[1] || '', // B = Title
      date: row[2] || '', // C = Date
      time: row[3] || '', // D = Time
      platformLink: row[4] || '', // E = Platform Link
      registrationUrl: row[5] || '', // F = Registration Form URL
      status: row[6] || '', // G = Status
      capacity: row[7] || '', // H = Capacity
      registrationCount: row[8] || '', // I = Registration Count
      attendanceCount: row[9] || '', // J = Attendance Count
      surveyLink: row[10] || '', // K = Survey Link
      createdDate: row[11] || '', // L = Created Date
      startTime: `${row[2]} ${row[3]}`, // Combine date and time
      daysUntil: daysUntil(row[2]) // Calculate from date
    }));

    // Upcoming webinars (next 30 days)
    const upcomingWebinars = webinars
      .filter(w => w.daysUntil !== null && w.daysUntil >= 0 && w.daysUntil <= 30)
      .sort((a, b) => (a.daysUntil || 999) - (b.daysUntil || 999));

    // Process registrations - CORRECTED COLUMN MAPPINGS
    const registrations = registrationRows.map(row => ({
      timestamp: row[0] || '', // A = Timestamp
      webinarId: row[1] || '', // B = Webinar ID
      name: row[2] || '', // C = Name
      email: row[3] || '', // D = Email
      organization: row[4] || '', // E = Organization
      phone: row[5] || '', // F = Phone
      registrationDate: row[0] || '' // Use timestamp as registration date
    }));

    // Upcoming webinar registrations
    const upcomingWebinarRegistrations = registrations.filter(r => 
      upcomingWebinars.some(w => w.webinarId === r.webinarId)
    ).length;

    // Recent registrations (last 7 days)
    const recentWebinarRegistrations = registrations.filter(r => 
      isRecent(r.registrationDate)
    ).length;

    // Survey contacts to contact (Column J = "Yes") - CORRECTED COLUMN MAPPINGS
    const surveyContactsToContact = surveyRows
      .filter(row => String(row[9] || '').toLowerCase().trim() === 'yes') // J = Contact request
      .map(row => ({
        timestamp: row[0] || '', // A = Timestamp
        email: row[1] || '', // B = Email Address
        webinarId: row[2] || '', // C = Webinar ID
        relevance: row[3] || '', // D = Relevance
        presenterRhonda: row[4] || '', // E = Presenter Rhonda
        presenterChris: row[5] || '', // F = Presenter Chris
        presenterGuest: row[6] || '', // G = Presenter Guest
        sharing: row[7] || '', // H = Sharing
        attending: row[8] || '', // I = Attending
        contactRequest: row[9] || '', // J = Contact Request (Yes/No)
        comments: row[10] || '', // K = Comments
        name: row[1] || '', // Use email as name fallback
        responseDate: row[0] || '' // Use timestamp as response date
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
      console.log('[Social] SOCIAL_MEDIA_SHEET_ID not set, skipping');
      return {
        recentSocialPosts: [],
        scheduledSocialCount: 0,
        socialThisWeek: 0,
        socialThisMonth: 0
      };
    }

    console.log('[Social] Starting social media data fetch from:', CFG.SOCIAL_MEDIA_SHEET_ID);
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
      timestamp: row[0] || '', // A = timestamp
      status: row[1] || '', // B = status
      contentType: row[2] || '', // C = contentType
      title: row[3] || '', // D = title
      body: row[4] || '', // E = body
      imageUrl: row[5] || '', // F = imageUrl
      videoUrl: row[6] || '', // G = videoUrl
      platforms: row[7] || '', // H = platforms
      scheduleDate: row[8] || '', // I = scheduleDate
      publishedDate: row[9] || '', // J = publishedDate
      postPermalink: row[10] || '', // K = postPermalink
      facebookPostId: row[11] || '', // L = facebookPostId
      linkedInPostId: row[12] || '', // M = linkedInPostId
      wordPressPostId: row[13] || '', // N = wordPressPostId
      brevoEmailId: row[14] || '', // O = brevoEmailId
      analytics: row[15] || '', // P = analytics
      createdBy: row[16] || '', // Q = createdBy
      tags: row[17] || '', // R = tags
      url: row[10] || '', // Use postPermalink as url
      permalink: row[10] || '', // Use postPermalink as permalink
      text: row[4] || '', // Use body as text
      platform: row[7] || '', // Use platforms as platform
      publishedAt: row[9] || '', // Use publishedDate as publishedAt
      scheduledFor: row[8] || '' // Use scheduleDate as scheduledFor
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
    console.log('[BidSystems] Using main sheet Active_Admin tab for bid systems data');
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Use the main sheet's Active_Admin tab instead of separate sheet
    const res = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: CFG.SHEET_ID, // Use main sheet
        range: 'Active_Admin!A2:Z'
      }),
      'bidSystems',
      CFG.GOOGLE_TIMEOUT_MS
    );

    const rows = res?.data?.values || [];
    
    if (rows.length === 0) {
      console.log('[BidSystems] No data found in Active_Admin tab');
      return {
        activeBidSystemsCount: 0,
        recentBidSystemChanges: []
      };
    }
    
    console.log('[BidSystems] Found data in Active_Admin tab, rows:', rows.length);
    
    const systems = rows.map(row => ({
      recommendation: row[0] || '', // A = Recommendation
      emailDateReceived: row[1] || '', // B = Email Date Received
      emailFrom: row[2] || '', // C = Email From
      emailSubject: row[3] || '', // D = Email Subject
      emailBody: row[4] || '', // E = Email Body
      bidSystem: row[5] || '', // F = Bid System
      emailDomain: row[6] || '', // G = Email Domain
      dateAdded: row[7] || '', // H = Date Added
      sourceEmailId: row[8] || '', // I = Source Email ID
      status: row[9] || '', // J = Status
      name: row[5] || '', // Use Bid System as name
      dateModified: row[7] || '' // Use Date Added as dateModified
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

async function fetchReminderData(auth) {
  try {
    if (!CFG.SOCIAL_MEDIA_SHEET_ID) {
      console.log('[Reminders] SOCIAL_MEDIA_SHEET_ID not set, skipping');
      return { overdueWebinarEmails: 0, missingSocialPosts: [], pendingReminders: [] };
    }

    console.log('[Reminders] Fetching reminder data...');
    const res = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/getReminders`, {
      headers: {
        'X-App-Token': process.env.APP_TOKEN || 'dev-token'
      }
    });

    if (!res.ok) {
      console.warn('[Reminders] Failed to fetch:', res.status);
      return { overdueWebinarEmails: 0, missingSocialPosts: [], pendingReminders: [] };
    }

    const data = await res.json();
    console.log('[Reminders] Fetched:', data.summary);
    
    return {
      overdueWebinarEmails: data.summary?.overdueWebinarEmails || 0,
      missingSocialPosts: data.summary?.missingSocialPosts || [],
      pendingReminders: [
        ...(data.webinarReminders || []).flatMap(wr => 
          Object.entries(wr.reminders).filter(([_, r]) => r.status === 'pending' || r.status === 'overdue')
        ),
        ...Object.entries(data.weeklyReminders || {})
          .filter(([key, val]) => key !== 'currentWeek' && val.overdue)
          .map(([day]) => ({ type: 'social', day }))
      ]
    };
  } catch (err) {
    console.error('[Reminders] Error:', err?.message);
    return { overdueWebinarEmails: 0, missingSocialPosts: [], pendingReminders: [] };
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
      console.log('[ComprehensiveTicker] Attempting Google authentication...');
      auth = getGoogleAuth();
      const client = await auth.getClient(); // Use getClient() instead of authorize()
      console.log('[ComprehensiveTicker] Google auth successful');
    } catch (err) {
      console.error('[ComprehensiveTicker] Google auth failure:', err?.message);
      console.error('[ComprehensiveTicker] Auth error details:', err);
      return ok(headers, { success: true, items: [], note: 'Google authentication failed.' });
    }

    // Fetch all data in parallel (including reminders)
    console.log('[ComprehensiveTicker] Fetching data from all sources...');
    const [bidsData, webinarData, socialData, bidSystemsData, newsData, reminderData] = await Promise.all([
      fetchBidsData(auth),
      fetchWebinarData(auth),
      fetchSocialMediaData(auth),
      fetchBidSystemsData(auth),
      fetchNewsData(),
      fetchReminderData(auth)
    ]);

    console.log('[ComprehensiveTicker] Data fetched:', {
      bids: bidsData.activeBidsCount,
      webinars: webinarData.upcomingWebinars?.length || 0,
      social: socialData.recentSocialPosts?.length || 0,
      systems: bidSystemsData.activeBidSystemsCount,
      news: newsData.newsArticles?.length || 0
    });
    
    // Debug each data source
    console.log('[ComprehensiveTicker] Detailed data:', {
      bidsData: {
        activeBidsCount: bidsData.activeBidsCount,
        recentDisregardedCount: bidsData.recentDisregardedCount,
        priorityBidsCount: bidsData.priorityBids?.length || 0
      },
      webinarData: {
        upcomingWebinars: webinarData.upcomingWebinars?.length || 0,
        registrations: webinarData.upcomingWebinarRegistrations || 0
      },
      socialData: {
        recentPosts: socialData.recentSocialPosts?.length || 0,
        scheduled: socialData.scheduledSocialCount || 0
      },
      bidSystemsData: {
        activeCount: bidSystemsData.activeBidSystemsCount || 0,
        recentChanges: bidSystemsData.recentBidSystemChanges?.length || 0
      }
    });

    // Combine all data
    const comprehensiveData = {
      ...bidsData,
      ...webinarData,
      ...socialData,
      ...bidSystemsData,
      ...newsData,
      ...reminderData,
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
