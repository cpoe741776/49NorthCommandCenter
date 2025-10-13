// netlify/functions/getAIInsights.js
const { google } = require('googleapis');
const OpenAI = require('openai');

// =======================
// Config (env-overridable) - ADJUSTED FOR PRO ACCOUNT TIME-SPLICING
// =======================
const CFG = {
  // --- ADJUSTED FOR PRO ACCOUNT QUALITY/TIME ---
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o', // REVERTED: Use GPT-4o for quality
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '8000', 10), // REVERTED: Larger payload
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '45000', 10), // INCREASED: 45s max for OpenAI 

  GOOGLE_SCOPES: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '8000', 10),

  NEWS_QUERY:
    'mental health training government OR resilience training military OR law enforcement mental health programs',
  NEWS_MAX: parseInt(process.env.NEWS_MAX ?? '8', 10), // INCREASED: More news items
  NEWS_TIMEOUT_MS: parseInt(process.env.NEWS_TIMEOUT_MS ?? '5000', 10), 

  // Combined and increased AI Limits for larger payloads
  AI_LIMITS: {
    PRIORITY_BIDS: 12, // INCREASED
    TOP_NEWS: 8, // INCREASED
    TOP_SYSTEMS: 15, // INCREASED
    TOP_ORGS_PER_LIST: 15, // INCREASED
    WEBINARS_FOR_AI: 30, // INCREASED
    SURVEY_COMMENT_SNIPPET: 220, // INCREASED
    DISREGARDED_SAMPLE: 10 // INCREASED
  },

  // Set aggressive internal timeout to fit standard HTTP/proxy limits
  FUNCTION_TIMEOUT_MS: 30000, // 30 seconds max execution budget
  ENABLE_CACHING: true,
  CACHE_TTL_MS: 5 * 60 * 1000 // 5 minutes
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// NEW: Simple in-memory cache (will reset on cold starts) from File 1
const cache = new Map();

function getCacheKey(spreadsheetId, ranges) {
  return `${spreadsheetId}-${ranges.join(',')}`;
}

function getCached(key) {
  if (!CFG.ENABLE_CACHING) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CFG.CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  if (!CFG.ENABLE_CACHING) return;
  cache.set(key, { data, timestamp: Date.now() });

  // Cleanup old entries (keep max 10)
  if (cache.size > 10) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

// NEW: Timeout wrapper function from File 1
const withTimeout = async (promise, label, ms) => {
  const controller = new AbortController();
  const t = setTimeout(() => {
    console.warn(`[Insights] Timeout for ${label} after ${ms}ms`);
    controller.abort();
  }, ms);
  try {
    const result = await promise;
    clearTimeout(t);
    return result;
  } catch (error) {
    clearTimeout(t);
    if (error.name === 'AbortError' || String(error).includes('aborted')) {
      console.warn(`[Insights] ${label} was aborted due to timeout`);
      return null; // Return null instead of throwing
    }
    throw error;
  }
};

// =======================
// MAIN HANDLER
// =======================
exports.handler = async (event, context) => {
  const startTime = Date.now();
  console.log('[Insights] Function start');

  // Set aggressive timeout timer 
  const timeoutTimer = setTimeout(() => {
    // This timer is a safety net but the CRITICAL_TIME_EXCEEDED check below is the real enforcer.
    console.warn('[Insights] Approaching hard timeout limit. This should trigger CRITICAL_TIME_EXCEEDED if the handler is blocked.');
  }, CFG.FUNCTION_TIMEOUT_MS);

  // Define aggregatedData early so it's available for the CRITICAL_TIME_EXCEEDED catch block
  let activeBids = [], submittedBids = [], disregardedBids = [], webinars = [], surveys = [], registrations = [], bidSystems = [], socialPosts = [];
  let aggregatedData = null;

  try {
    // -------------------------
    // Google Sheets: Auth + Get
    // -------------------------
    let serviceAccountKey;
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
        serviceAccountKey = JSON.parse(
          Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
        );
      } else {
        serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      }
    } catch (parseError) {
      console.error('[Insights] Failed to parse service account key:', parseError);
      throw new Error('Invalid service account credentials');
    }

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: CFG.GOOGLE_SCOPES
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[Insights] Fetching Sheets data...');

    // Define all data ranges (from File 2 - richer data sources)
    const bidRanges = ['Active_Bids!A2:U', 'Submitted!A2:U', 'Disregarded!A2:U', 'Active_Admin!A2:J'];
    const webinarRanges = ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F'];
    const systemsRanges = ['_BidSystemsSync!A2:O'];
    const socialRanges = ['MainPostData!A2:R'];

    // Define cache keys
    const bidsCacheKey = getCacheKey(process.env.GOOGLE_SHEET_ID, bidRanges);
    const webinarCacheKey = getCacheKey(process.env.WEBINAR_SHEET_ID, webinarRanges);
    const systemsCacheKey = getCacheKey(process.env.GOOGLE_SHEET_ID, systemsRanges);
    const socialCacheKey = getCacheKey(process.env.SOCIAL_MEDIA_SHEET_ID, socialRanges);

    // Check cache first
    let bidsData = getCached(bidsCacheKey);
    let webinarData = getCached(webinarCacheKey);
    let systemsData = getCached(systemsCacheKey);
    let socialData = getCached(socialCacheKey);

    // Fetch promises for non-cached data
    const fetchPromises = [];

    // ... (All fetch promises remain the same as above) ...

    if (!bidsData) {
      fetchPromises.push(
        withTimeout(
          sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.GOOGLE_SHEET_ID, ranges: bidRanges }),
          'bidsBatchGet',
          CFG.GOOGLE_TIMEOUT_MS
        ).then(data => { if (data) { setCache(bidsCacheKey, data); bidsData = data; } return data; })
      );
    } else { console.log('[Insights] Using cached bids data'); }

    if (!webinarData) {
      fetchPromises.push(
        withTimeout(
          sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.WEBINAR_SHEET_ID, ranges: webinarRanges }),
          'webinarBatchGet',
          CFG.GOOGLE_TIMEOUT_MS
        ).then(data => { if (data) { setCache(webinarCacheKey, data); webinarData = data; } return data; })
      );
    } else { console.log('[Insights] Using cached webinar data'); }

    if (!systemsData) {
      fetchPromises.push(
        withTimeout(
          sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.GOOGLE_SHEET_ID, ranges: systemsRanges }),
          'systemsBatchGet',
          CFG.GOOGLE_TIMEOUT_MS
        ).then(data => { if (data) { setCache(systemsCacheKey, data); systemsData = data; } return data; })
      );
    } else { console.log('[Insights] Using cached systems data'); }

    if (!socialData && process.env.SOCIAL_MEDIA_SHEET_ID) {
      fetchPromises.push(
        withTimeout(
          sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID, ranges: socialRanges }),
          'socialBatchGet',
          CFG.GOOGLE_TIMEOUT_MS
        ).then(data => { if (data) { setCache(socialCacheKey, data); socialData = data; } return data; })
      );
    } else { console.log('[Insights] Using cached social/skipping social data'); }
    
    // Wait for all fetches
    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);
    }

    // Handle missing *critical* data (bids or webinars)
    if (!bidsData || !webinarData) {
      console.error('[Insights] Failed to fetch required data');
      clearTimeout(timeoutTimer);
      return {
        statusCode: 503,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ error: 'Unable to fetch critical data from Google Sheets', details: 'Service temporarily unavailable' })
      };
    }

    console.log('[Insights] Data fetched successfully');

    // Parse sheets data (using File 2's comprehensive parsers)
    activeBids = parseBids(bidsData.data.valueRanges[0]?.values || []);
    submittedBids = parseBids(bidsData.data.valueRanges[1]?.values || []);
    disregardedBids = parseBids(bidsData.data.valueRanges[2]?.values || []);
    const adminEmails = parseAdminEmails(bidsData.data.valueRanges[3]?.values || []);
    webinars = parseWebinars(webinarData.data.valueRanges[0]?.values || []);
    surveys = parseSurveys(webinarData.data.valueRanges[1]?.values || []);
    registrations = parseRegistrations(webinarData.data.valueRanges[2]?.values || []);
    bidSystems = parseBidSystems(systemsData?.data.valueRanges[0]?.values || []);
    socialPosts = parseSocialPosts(socialData?.data.valueRanges[0]?.values || []);

    // --------------------------------
    // Build derived/aggregate metrics (must run BEFORE AI call)
    // --------------------------------
    const contactLeads = extractContactLeads(surveys, registrations);
    const respondBids = activeBids.filter((b) => b.recommendation === 'Respond');
    const newsArticles = await withTimeout(
      fetchRelevantNews(CFG.NEWS_QUERY, CFG.NEWS_MAX),
      'newsRSS',
      CFG.NEWS_TIMEOUT_MS
    ) || [];
    
    const bidUrgency = computeBidUrgencyBuckets(activeBids);
    const bidSystemDistribution = countByField(activeBids, (b) => b.bidSystem, 'Unknown');
    const agencyDistribution = countByField(activeBids, (b) => b.entity, 'Unknown');
    const keywordDistribution = computeKeywordDistribution(activeBids);
    const scoreDistribution = computeScoreDistribution(activeBids);

    const adminBySystem = countByField(adminEmails, (e) => e.bidSystem, 'Unknown');
    const newAdminCount = adminEmails.filter(e => e.status === 'New').length;

    const disregardedByReason = analyzeDisregardedReasons(disregardedBids);
    const revivedCandidates = findRevivalCandidates(disregardedBids);

    const { past30, past90, presenterAverages, anomalies } = computeWebinarKPIs(webinars, surveys);

    // Build Aggregated Data object - NOW AVAILABLE IN CATCH BLOCK
    aggregatedData = {
      timestamp: new Date().toISOString(),
      summary: {
        activeBidsCount: activeBids.length, respondBidsCount: respondBids.length, submittedBidsCount: submittedBids.length,
        disregardedBidsCount: disregardedBids.length, adminEmailsCount: adminEmails.length, newAdminEmailsCount: newAdminCount,
        registeredSystemsCount: bidSystems.filter(s => s.status === 'Active').length, completedWebinars: webinars.filter((w) => w.status === 'Completed').length,
        totalSurveyResponses: surveys.length, contactRequests: contactLeads.length, totalRegistrations: registrations.length,
        socialPostsTotal: socialPosts.length,
      },
      bidUrgency, bidSystemDistribution, agencyDistribution, keywordDistribution, scoreDistribution,
      systemAdmin: { bySystem: adminBySystem, newCount: newAdminCount },
      disregardedAnalysis: { byReason: disregardedByReason, revivedCandidates },
      webinarKPIs: { past30, past90, presenterAverages, anomalies },
      priorityBids: respondBids.map((bid) => ({
        recommendation: bid.recommendation, score: bid.scoreDetails, subject: bid.emailSubject || 'No Subject',
        summary: bid.aiSummary || bid.significantSnippet || bid.emailSubject || 'No summary available',
        entity: bid.entity !== 'Unknown' && bid.entity ? bid.entity : null, bidSystem: bid.bidSystem !== 'Unknown' && bid.bidSystem ? bid.bidSystem : null,
        dueDate: bid.dueDate !== 'Not specified' ? bid.dueDate : null, daysUntilDue: daysUntil(bestDate(bid.dueDate)), relevance: bid.relevance, 
        keywords: bid.keywordsFound, emailFrom: bid.emailFrom, url: bid.url
      })),
      contactLeads, newsArticles, bidSystems: bidSystems.slice(0, CFG.AI_LIMITS.TOP_SYSTEMS), socialPosts
    };
    
    // -----------------------
    // NEW AGGRESSIVE TIME CHECK BEFORE OPENAI (THE 504 KILLER)
    // -----------------------
    const elapsedBeforeAI = Date.now() - startTime;
    // If more than 20 seconds have elapsed, we are dangerously close to the HTTP proxy timeout.
    if (elapsedBeforeAI > 20000) { 
        console.warn(`[Insights] Elapsed time (${elapsedBeforeAI}ms) exceeds 20s threshold. Aborting AI to prevent 504.`);
        throw new Error('CRITICAL_TIME_EXCEEDED');
    }

    // ---------------------------------
    // Build a REDACTED payload for AI
    // ---------------------------------
    const aiPayload = buildAIPayload(aggregatedData, webinars, surveys, disregardedBids, { limits: CFG.AI_LIMITS });

    // -----------------------
    // OpenAI: robust request 
    // -----------------------
    let aiInsights;
    try {
        aiInsights = await getAIInsights(aiPayload, {
            model: CFG.OPENAI_MODEL,
            temperature: CFG.OPENAI_TEMPERATURE,
            max_tokens: CFG.OPENAI_MAX_TOKENS,
            timeoutMs: CFG.OPENAI_TIMEOUT_MS
        });
    } catch (aiErr) {
        console.error('[Insights] OpenAI failed:', aiErr.message);
        // Fallback if OpenAI call fails entirely
        aiInsights = {
            executiveSummary: 'AI analysis unavailable. Data has been processed and is displayed below.',
            topPriorities: [], bidRecommendations: [],
            contentInsights: { topPerforming: 'See webinar KPIs section', suggestions: 'Focus on high-scoring opportunities' },
            newsOpportunities: [], riskAlerts: []
        };
    }

    // Build final response
    const response = {
      ...aiInsights,
      timestamp: new Date().toISOString(),
      // Attach aggregated data
      bids: aggregatedData.bidUrgency,
      webinarKPIs: aggregatedData.webinarKPIs,
      contactLeads: aggregatedData.contactLeads.slice(0, 50),
      priorityBids: aggregatedData.priorityBids.slice(0, 25),
      newsArticles: aggregatedData.newsArticles,
      socialPosts: aggregatedData.socialPosts.slice(0, 10),
      processingTime: `${Date.now() - startTime}ms`
    };

    clearTimeout(timeoutTimer);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, // Cache for 5 minutes
      body: JSON.stringify(response)
    };

  } catch (error) {
    clearTimeout(timeoutTimer);
    console.error('[Insights] Fatal error:', error);

    if (error.message === 'CRITICAL_TIME_EXCEEDED' && aggregatedData) {
      // Use the successfully collected and aggregated data for a 200 OK fallback
      console.warn('[Insights] Returning partial data due to CRITICAL_TIME_EXCEEDED.');
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        body: JSON.stringify({
          executiveSummary: 'AI Analysis skipped due to critical time limits (20s). Basic data loaded.',
          timestamp: new Date().toISOString(),
          bids: aggregatedData.bidUrgency,
          webinarKPIs: aggregatedData.webinarKPIs,
          note: 'Full AI analysis unavailable due to time constraints'
        })
      };
    }

    // Default 500 server error
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// ==================================
// HELPER FUNCTIONS (REMAINDER)
// ==================================

// OpenAI helper (Keeps retry logic and rich system prompt)
async function getAIInsights(aiPayload, { model, temperature, max_tokens, timeoutMs }) {
  console.log('[OpenAI] Starting analysis with model:', model);

  // NOTE: This system prompt is for the detailed structure from File 2, not the simpler one in File 1.
  const systemPrompt = `
You are a strategic business analyst for 49 North (Mental Armor™), specializing in government procurement intelligence and resilience training market analysis.

CONTEXT:
49 North operates in the mental health and resilience training space, serving first responders, military, law enforcement, and government agencies. You have access to:
- Active bid opportunities from multiple procurement systems
- System administrative correspondence tracking
- Disregarded opportunities archive (for potential revival)
- Webinar engagement and survey data
- News intelligence on sector trends (last 90 days)

CRITICAL RULES:
- Bids are separate from webinars. Do NOT conflate these datasets.
- System admin emails are operational notifications, NOT bid opportunities.
- Disregarded bids may contain revival candidates if circumstances changed.
- Focus on actionable insights with owner + timeline.
- Use specific numbers and dates.
- Be concise but specific in all recommendations.

DELIVERABLE: Return valid JSON with this exact structure:
{
  "executiveSummary": "3-6 sentences covering key metrics, urgent actions, and strategic opportunities",
  "topPriorities": [
    {
      "title": "Specific action item",
      "description": "Why this matters with supporting data",
      "action": "Concrete next step with owner and timeline",
      "urgency": "high|medium|low"
    }
  ],
  "bidRecommendations": [
    {
      "subject": "Email subject line",
      "entity": "Agency name",
      "reason": "Why pursue this specific opportunity",
      "action": "Specific next step with timeline",
      "dueDate": "YYYY-MM-DD",
      "daysUntilDue": number,
      "score": "AI score"
    }
  ],
  "systemInsights": {
    "bidSystems": "Analysis of which procurement systems are most productive",
    "adminAlerts": "Any system admin issues requiring attention",
    "suggestions": "Recommendations for system optimization"
  },
  "contentInsights": {
    "topPerforming": "Best webinar themes based on attendance/engagement",
    "suggestions": "Topics aligned with bid opportunities and news trends"
  },
  "newsOpportunities": [
    {
      "headline": "News title",
      "relevance": "How this connects to our capabilities",
      "action": "Specific opportunity or outreach suggestion"
    }
  ],
  "riskAlerts": [
    {
      "issue": "Specific problem or concern",
      "impact": "Business impact",
      "mitigation": "Concrete action to address"
    }
  ],
  "revivedCandidates": [
    {
      "subject": "Previously disregarded opportunity",
      "reason": "Why reconsider now",
      "action": "Recommendation (Respond/Gather Info)"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, just the JSON object.
`.trim();

  const userPrompt = `
CURRENT_DATE: ${new Date().toISOString().split('T')[0]}

BUSINESS INTELLIGENCE DATA:
${JSON.stringify(aiPayload, null, 2)}

Analyze and provide strategic insights. Return ONLY the JSON object with no additional text.
`.trim();

  const callOnce = async () => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      console.log('[OpenAI] Request timeout triggered');
      controller.abort();
    }, timeoutMs);

    try {
      console.log('[OpenAI] Making API call...');
      const startTime = Date.now();

      const completion = await openai.chat.completions.create({
        model,
        temperature,
        max_tokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });

      const elapsed = Date.now() - startTime;
      console.log(`[OpenAI] Response received in ${elapsed}ms`);

      const txt = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(txt);
      console.log('[OpenAI] Successfully parsed JSON response');
      return parsed;

    } catch (err) {
      console.error('[OpenAI] API call failed:', err.message);
      throw err;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await callOnce();
  } catch (e1) {
    console.warn('[OpenAI] First attempt failed. Retrying in 2 seconds...');
    await sleep(2000);
    try {
      return await callOnce();
    } catch (e2) {
      console.error('[OpenAI] Second attempt failed. Returning fallback.');
      // Fallback logic remains the same as in File 2
      return {
        executiveSummary: `Analysis engine temporarily unavailable. Current snapshot: ${aiPayload.summary?.activeBidsCount || 0} active bids, ${aiPayload.summary?.respondBidsCount || 0} requiring response, ${aiPayload.contacts?.count || 0} contact leads pending.`,
        topPriorities: [
          { title: 'Review Priority Bids', description: `${aiPayload.summary?.respondBidsCount || 0} bids marked as "Respond" require immediate attention`, action: 'Review all "Respond" category bids', urgency: 'high' }
        ],
        bidRecommendations: [],
        systemInsights: { bidSystems: 'Check distribution in data section.', adminAlerts: 'Review system admin notifications', suggestions: 'Monitor bid system performance' },
        contentInsights: { topPerforming: 'Review webinar KPIs section', suggestions: 'Align content topics with procurement trends' },
        newsOpportunities: [], riskAlerts: [], revivedCandidates: []
      };
    }
  }
}

// ==================
// Parsers (From File 2)
// ==================
function parseBids(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    recommendation: row[0] || '', scoreDetails: row[1] || '', aiReasoning: row[2] || '', aiSummary: row[3] || '',
    emailDateReceived: row[4] || '', emailFrom: row[5] || '', keywordsCategory: row[6] || '', keywordsFound: row[7] || '',
    relevance: row[8] || '', emailSubject: row[9] || '', emailBody: row[10] || '', url: row[11] || '',
    dueDate: row[12] || '', significantSnippet: row[13] || '', emailDomain: row[14] || '', bidSystem: row[15] || '',
    country: row[16] || '', entity: row[17] || '', status: row[18] || '', dateAdded: row[19] || '', sourceEmailId: row[20] || ''
  }));
}

function parseAdminEmails(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    recommendation: row[0] || '', emailDateReceived: row[1] || '', emailFrom: row[2] || '', emailSubject: row[3] || '',
    emailBody: row[4] || '', bidSystem: row[5] || '', emailDomain: row[6] || '', dateAdded: row[7] || '',
    sourceEmailId: row[8] || '', status: row[9] || ''
  }));
}

function parseBidSystems(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    systemId: row[0] || '', systemName: row[1] || '', category: row[2] || '', status: row[3] || '',
    websiteUrl: row[4] || '', loginUrl: row[5] || '', username: row[6] || '', geographicCoverage: row[13] || ''
  }));
}

function parseWebinars(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    id: row[0] || '', title: row[1] || '', date: row[2] || '', time: row[3] || '', status: row[6] || '',
    registrationCount: parseInt(row[8] || '0', 10) || 0, attendanceCount: parseInt(row[9] || '0', 10) || 0
  }));
}

function parseSurveys(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '', email: row[1] || '', webinarId: row[2] || '', relevance: row[3] || '',
    rhonda: row[4] || '', chris: row[5] || '', guest: row[6] || '', sharing: row[7] || '',
    attending: row[8] || '', contactRequest: row[9] || '', comments: row[10] || ''
  }));
}

function parseRegistrations(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '', webinarId: row[1] || '', name: row[2] || '', email: row[3] || '',
    organization: row[4] || '', phone: row[5] || ''
  }));
}

function parseSocialPosts(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '', status: row[1] || '', contentType: row[2] || '', title: row[3] || '',
    body: row[4] || '', platforms: row[7] || '', publishedDate: row[9] || ''
  }));
}

// ==================
// Analysis Functions (From File 2)
// ==================
function computeKeywordDistribution(bids) {
  const keywords = new Map();
  bids.forEach(bid => {
    const kws = (bid.keywordsFound || '').split(',').map(k => k.trim()).filter(Boolean);
    kws.forEach(kw => { keywords.set(kw, (keywords.get(kw) || 0) + 1); });
  });
  return Array.from(keywords.entries()).map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count).slice(0, 20);
}

function computeScoreDistribution(bids) {
  const buckets = { '0-5': 0, '6-8': 0, '9-14': 0, '15-20': 0 };
  bids.forEach(bid => {
    const score = parseFloat(bid.scoreDetails) || 0;
    if (score <= 5) buckets['0-5']++;
    else if (score <= 8) buckets['6-8']++;
    else if (score <= 14) buckets['9-14']++;
    else buckets['15-20']++;
  });
  return buckets;
}

function analyzeDisregardedReasons(disregarded) {
  const reasons = new Map();
  disregarded.forEach(bid => {
    const reasoning = bid.aiReasoning || '';
    if (reasoning.includes('no relevant keywords')) { reasons.set('No Keywords', (reasons.get('No Keywords') || 0) + 1); }
    else if (reasoning.includes('marketing') || reasoning.includes('promotional')) { reasons.set('Marketing Noise', (reasons.get('Marketing Noise') || 0) + 1); }
    else if (reasoning.includes('lacks')) { reasons.set('Missing Procurement Signals', (reasons.get('Missing Procurement Signals') || 0) + 1); }
    else { reasons.set('Other', (reasons.get('Other') || 0) + 1); }
  });
  return Array.from(reasons.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

function findRevivalCandidates(disregarded) {
  return disregarded
    .filter(bid => {
      const score = parseFloat(bid.scoreDetails) || 0;
      const hasKeywords = (bid.keywordsFound || '').trim().length > 0;
      const hasEntity = bid.entity && bid.entity !== 'Unknown';
      return score >= 5 && hasKeywords && hasEntity;
    })
    .sort((a, b) => parseFloat(b.scoreDetails) - parseFloat(a.scoreDetails))
    .slice(0, 10)
    .map(bid => ({ subject: bid.emailSubject, score: bid.scoreDetails, keywords: bid.keywordsFound, entity: bid.entity, reasoning: bid.aiReasoning }));
}

async function fetchRelevantNews(query, limit) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CFG.NEWS_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = [];
    const regexes = [
      /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
      /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g
    ];

    for (const rx of regexes) {
      let m;
      while ((m = rx.exec(xml)) && items.length < limit * 2) {
        items.push({ title: sanitize(m[1]), link: sanitize(m[2]), pubDate: sanitize(m[3]), source: 'Google News' });
      }
      if (items.length) break;
    }

    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 90);
    const sixtyDaysAgoMs = sixtyDaysAgo.getTime();
    const seen = new Map();

    for (const it of items) {
      const key = (it.link || it.title).trim();
      const ts = Date.parse(it.pubDate || '') || 0;
      if (ts > 0 && ts < sixtyDaysAgoMs) continue;
      const prev = seen.get(key);
      if (!prev || ts > (Date.parse(prev.pubDate || '') || 0)) { seen.set(key, it); }
    }

    return Array.from(seen.values()).sort((a, b) => Date.parse(b.pubDate || '') - Date.parse(a.pubDate || '')).slice(0, limit);
  } catch (e) {
    console.error('[News] Fetch error:', e?.message);
    return [];
  }
}

function extractContactLeads(surveys, registrations) {
  const leads = new Map();
  const regByEmail = new Map();
  registrations.forEach((r) => { const email = (r.email || '').toLowerCase().trim(); if (email) regByEmail.set(email, r); });

  surveys.forEach((survey) => {
    const email = (survey.email || '').toLowerCase().trim();
    if (!email) return;

    const val = String(survey.contactRequest || '');
    const wantsContact = val.toLowerCase().includes('yes');
    const wantsReminder = val.includes('🟢 Drop me a reminder in 3 months');

    if (wantsContact || wantsReminder) {
      if (!leads.has(email)) {
        const reg = regByEmail.get(email);
        leads.set(email, {
          email: survey.email, name: reg?.name || 'Unknown', organization: reg?.organization || 'Unknown',
          phone: reg?.phone || '', score: 0, factors: [], comments: survey.comments || '', lastActivity: survey.timestamp
        });
      }
      const lead = leads.get(email);
      if (wantsContact) { lead.score += 50; lead.factors.push('Requested Contact'); }
      if (wantsReminder) { lead.score += 30; lead.factors.push('Wants 3-Month Reminder'); }
    }
  });

  const counts = new Map();
  registrations.forEach((r) => { const email = (r.email || '').toLowerCase().trim(); if (email) counts.set(email, (counts.get(email) || 0) + 1); });

  leads.forEach((lead, email) => {
    const c = counts.get(email) || 0;
    if (c >= 2) { lead.score += 30 * (c - 1); lead.factors.push(`${c} Webinars Attended`); }
    if ((lead.comments || '').trim().length > 10) { lead.score += 20; lead.factors.push('Left Detailed Comments'); }
  });

  return Array.from(leads.values()).sort((a, b) => b.score - a.score);
}

function computeBidUrgencyBuckets(bids) {
  const buckets = { '0-3': 0, '4-7': 0, '8-14': 0, '15+': 0, pastDue: 0, undated: 0 };
  bids.forEach((b) => {
    const due = bestDate(b.dueDate);
    if (!due || isNaN(due.getTime())) { buckets.undated++; return; }
    const d = daysUntil(due);
    if (d < 0) buckets.pastDue++;
    else if (d <= 3) buckets['0-3']++;
    else if (d <= 7) buckets['4-7']++;
    else if (d <= 14) buckets['8-14']++;
    else buckets['15+']++;
  });
  return buckets;
}

function countByField(list, getter, emptyLabel = 'Unknown') {
  const map = new Map();
  list.forEach((item) => {
    const raw = getter(item);
    const key = raw || emptyLabel;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function computeWebinarKPIs(webinars, surveys) {
  const completed = webinars.filter((w) => w.status === 'Completed');
  completed.sort((a, b) => new Date(a.date) - new Date(b.date));

  const now = new Date();
  const withinDays = (n) => completed.filter((w) => daysBetween(new Date(w.date), now) <= n);

  const last30 = withinDays(30);
  const last90 = withinDays(90);

  const kpi = (arr) => {
    const totalAttendance = arr.reduce((s, w) => s + (w.attendanceCount || 0), 0);
    const totalRegs = arr.reduce((s, w) => s + (w.registrationCount || 0), 0);
    return {
      count: arr.length, totalAttendance, totalRegistrations: totalRegs,
      avgAttendance: arr.length ? Math.round(totalAttendance / arr.length) : 0,
      attendanceRate: totalRegs ? Math.round((totalAttendance / totalRegs) * 100) : 0
    };
  };

  const presenterAverages = computePresenterAverages(surveys);

  const allTotal = completed.reduce((s, w) => s + (w.attendanceCount || 0), 0);
  const allMean = completed.length ? allTotal / completed.length : 0;
  const anomalies = completed
    .filter((w) => Math.abs((w.attendanceCount || 0) - allMean) >= Math.max(10, allMean * 0.5))
    .slice(-5)
    .map((w) => ({
      id: w.id, title: w.title, date: w.date, attendance: w.attendanceCount,
      deviationFromMean: Math.round((w.attendanceCount || 0) - allMean)
    }));

  return { past30: kpi(last30), past90: kpi(last90), presenterAverages, anomalies };
}

function computePresenterAverages(surveys) {
  const avg = (field) => {
    const vals = surveys.map((s) => { const m = String(s[field] || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; }).filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return vals.length ? Number(mean.toFixed(2)) : null;
  };
  return { rhonda: avg('rhonda'), chris: avg('chris'), guest: avg('guest') };
}

// ==================
// AI payload builder (From File 2)
// ==================
function buildAIPayload(aggregatedData, webinars, surveys, disregardedBids, { limits }) {
  const redactedLeads = aggregatedData.contactLeads.slice(0, 100).map((lead) => ({
    organization: lead.organization || 'Unknown',
    domain: (lead.email || '').split('@')[1] || '',
    score: lead.score,
    factors: lead.factors,
    lastActivity: lead.lastActivity,
    commentSnippet: (lead.comments || '').slice(0, limits.SURVEY_COMMENT_SNIPPET)
  }));

  const recentWebinarsForAI = [...webinars]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limits.WEBINARS_FOR_AI)
    .map((w) => ({
      id: w.id, title: w.title, date: w.date, status: w.status, registrationCount: w.registrationCount, attendanceCount: w.attendanceCount
    }));

  const disregardedSample = disregardedBids.slice(0, limits.DISREGARDED_SAMPLE).map(bid => ({
    subject: bid.emailSubject, score: bid.scoreDetails, keywords: bid.keywordsFound, entity: bid.entity, reasoning: (bid.aiReasoning || '').slice(0, 200)
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: aggregatedData.summary,
    bids: {
      urgency: aggregatedData.bidUrgency,
      systemDistribution: aggregatedData.bidSystemDistribution.slice(0, 15),
      agencyDistribution: aggregatedData.agencyDistribution.slice(0, 15),
      keywordDistribution: aggregatedData.keywordDistribution.slice(0, 15),
      scoreDistribution: aggregatedData.scoreDistribution,
      priority: aggregatedData.priorityBids
        .sort((a, b) => (a.daysUntilDue ?? 9999) - (b.daysUntilDue ?? 9999))
        .slice(0, limits.PRIORITY_BIDS)
    },
    systemAdmin: aggregatedData.systemAdmin,
    disregarded: {
      totalCount: aggregatedData.summary.disregardedBidsCount,
      reasonsDistribution: aggregatedData.disregardedAnalysis.byReason,
      revivedCandidates: aggregatedData.disregardedAnalysis.revivedCandidates,
      sampleForAnalysis: disregardedSample
    },
    webinars: { kpis: aggregatedData.webinarKPIs, recent: recentWebinarsForAI },
    contacts: {
      leadsSample: redactedLeads.slice(0, 50),
      count: aggregatedData.contactLeads.length,
      topDomains: getTopDomainsFromEmails(aggregatedData.contactLeads.map((l) => l.email)).slice(0, 15)
    },
    news: aggregatedData.newsArticles.slice(0, limits.TOP_NEWS),
    bidSystems: aggregatedData.bidSystems.map(s => ({ name: s.systemName, category: s.category, status: s.status, coverage: s.geographicCoverage }))
  };
}

// ==================
// Utilities (From File 2)
// ==================
function bestDate(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(d1, d2) {
  if (!d1 || !d2) return Infinity;
  const ms = d2 - d1;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
function daysUntil(d) {
  if (!d) return null;
  return daysBetween(new Date(), d);
}
function sanitize(s) {
  return (s || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}
function getTopDomainsFromEmails(emails) {
  const counts = {};
  (emails || []).forEach((e) => {
    const domain = (e || '').split('@')[1]?.toLowerCase();
    if (!domain) return;
    if (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook'))
      return;
    counts[domain] = (counts[domain] || 0) + 1;
  });
  return Object.entries(counts).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count);
}