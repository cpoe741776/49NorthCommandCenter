// netlify/functions/getAIInsights.js
const { google } = require('googleapis');
const OpenAI = require('openai');

// =======================
// Config (env-overridable)
// =======================
const CFG = {
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '8000', 10), // INCREASED
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '90000', 10), // INCREASED to 90s

  GOOGLE_SCOPES: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '30000', 10),

  NEWS_QUERY:
    'mental health training government OR resilience training military OR law enforcement mental health programs OR first responder wellness',
  NEWS_MAX: parseInt(process.env.NEWS_MAX ?? '10', 10),
  NEWS_TIMEOUT_MS: parseInt(process.env.NEWS_TIMEOUT_MS ?? '15000', 10),

  AI_LIMITS: {
    PRIORITY_BIDS: 15,
    TOP_NEWS: 10,
    TOP_SYSTEMS: 20,
    WEBINARS_FOR_AI: 30,
    SURVEY_COMMENT_SNIPPET: 220,
    DISREGARDED_SAMPLE: 10
  }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

exports.handler = async (event, context) => {
  console.log('[Insights] Function start');

  try {
    // -------------------------
    // Google Sheets: Auth + Get
    // -------------------------
    const serviceAccountKey = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: CFG.GOOGLE_SCOPES
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[Insights] Fetching Sheets data...');
    
    // Fetch from main bid sheet
    const [bidsData, webinarData, systemsData] = await Promise.all([
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        ranges: [
          'Active_Bids!A2:U',      // 21 columns
          'Submitted!A2:U',         // 21 columns
          'Disregarded!A2:U',       // 21 columns (NEW)
          'Active_Admin!A2:J'       // 10 columns (NEW)
        ]
      }),
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.WEBINAR_SHEET_ID,
        ranges: ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F']
      }),
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        ranges: ['_BidSystemsSync!A2:O'] // NEW: Bid systems registry
      })
    ]);

    // -------------
    // Parse rows
    // -------------
    const activeBids = parseBids(bidsData.data.valueRanges[0]?.values || []);
    const submittedBids = parseBids(bidsData.data.valueRanges[1]?.values || []);
    const disregardedBids = parseBids(bidsData.data.valueRanges[2]?.values || []); // NEW: Full structure
    const adminEmails = parseAdminEmails(bidsData.data.valueRanges[3]?.values || []); // NEW

    const webinars = parseWebinars(webinarData.data.valueRanges[0]?.values || []);
    const surveys = parseSurveys(webinarData.data.valueRanges[1]?.values || []);
    const registrations = parseRegistrations(webinarData.data.valueRanges[2]?.values || []);

    const bidSystems = parseBidSystems(systemsData.data.valueRanges[0]?.values || []); // NEW

    console.log(
      `[Insights] Parsed — active:${activeBids.length} submitted:${submittedBids.length} disregarded:${disregardedBids.length} admin:${adminEmails.length} systems:${bidSystems.length} webinars:${webinars.length}`
    );

    // --------------------------------
    // Build derived/aggregate metrics
    // --------------------------------
    const contactLeads = extractContactLeads(surveys, registrations);
    const respondBids = activeBids.filter((b) => b.recommendation === 'Respond');
    const gatherInfoBids = activeBids.filter((b) => b.recommendation === 'Gather More Information');
    const newsArticles = await fetchRelevantNews(CFG.NEWS_QUERY, CFG.NEWS_MAX);
console.log('[Insights] News articles fetched:', newsArticles.length);
if (newsArticles.length > 0) {
  console.log('[Insights] Sample news:', newsArticles[0].title);
}

    const bidUrgency = computeBidUrgencyBuckets(activeBids);
    const bidSystemDistribution = countByField(activeBids, (b) => b.bidSystem, 'Unknown');
    const agencyDistribution = countByField(activeBids, (b) => b.entity, 'Unknown');
    const keywordDistribution = computeKeywordDistribution(activeBids);
    const scoreDistribution = computeScoreDistribution(activeBids);

    // NEW: System admin metrics
    const adminBySystem = countByField(adminEmails, (e) => e.bidSystem, 'Unknown');
    const newAdminCount = adminEmails.filter(e => e.status === 'New').length;

    // NEW: Disregarded analysis
    const disregardedByReason = analyzeDisregardedReasons(disregardedBids);
    const revivedCandidates = findRevivalCandidates(disregardedBids);

    const { past30, past90, presenterAverages, anomalies } = computeWebinarKPIs(webinars, surveys);

    const recentCompleted = [...webinars]
      .filter((w) => w.status === 'Completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastWebinar = recentCompleted[0] || null;

    const newBidsLast7 = activeBids.filter((b) => {
      const addedDate = bestDate(b.dateAdded);
      return daysBetween(addedDate, new Date()) <= 7;
    }).length;

    const aggregatedData = {
      timestamp: new Date().toISOString(),
      summary: {
        activeBidsCount: activeBids.length,
        respondBidsCount: respondBids.length,
        gatherInfoBidsCount: gatherInfoBids.length,
        submittedBidsCount: submittedBids.length,
        disregardedBidsCount: disregardedBids.length,
        adminEmailsCount: adminEmails.length,
        newAdminEmailsCount: newAdminCount,
        registeredSystemsCount: bidSystems.filter(s => s.status === 'Active').length,

        completedWebinars: webinars.filter((w) => w.status === 'Completed').length,
        upcomingWebinars: webinars.filter((w) => w.status === 'Upcoming').length,
        totalSurveyResponses: surveys.length,
        contactRequests: contactLeads.length,
        totalRegistrations: registrations.length
      },

      bidUrgency,
      bidSystemDistribution,
      agencyDistribution,
      keywordDistribution,
      scoreDistribution,

      systemAdmin: {
        bySystem: adminBySystem,
        newCount: newAdminCount,
        topSystems: adminBySystem.slice(0, 5)
      },

      disregardedAnalysis: {
        byReason: disregardedByReason,
        revivedCandidates: revivedCandidates.slice(0, 5)
      },

      webinarKPIs: {
        past30,
        past90,
        presenterAverages,
        anomalies
      },

      priorityBids: respondBids.map((bid) => ({
  recommendation: bid.recommendation,
  score: bid.scoreDetails,
  subject: bid.emailSubject || 'No Subject',
  summary: bid.aiSummary || bid.significantSnippet || bid.emailSubject || 'No summary available',
  entity: bid.entity !== 'Unknown' && bid.entity ? bid.entity : null,
  bidSystem: bid.bidSystem !== 'Unknown' && bid.bidSystem ? bid.bidSystem : null,
  dueDate: bid.dueDate !== 'Not specified' ? bid.dueDate : null,
  daysUntilDue: daysUntil(bestDate(bid.dueDate)),
  relevance: bid.relevance,
  keywords: bid.keywordsFound,
  emailFrom: bid.emailFrom,
  url: bid.url
})),

      contactLeads,
      newsArticles,
      bidSystems: bidSystems.slice(0, CFG.AI_LIMITS.TOP_SYSTEMS),

      recentActivity: {
        lastWebinar,
        recentContactRequests: contactLeads.slice(0, 5),
        newBidsLast7,
        newAdminLast7: adminEmails.filter(e => {
          const added = bestDate(e.dateAdded);
          return daysBetween(added, new Date()) <= 7;
        }).length
      }
    };

    // ---------------------------------
    // Build a REDACTED payload for AI
    // ---------------------------------
    const aiPayload = buildAIPayload(aggregatedData, webinars, surveys, disregardedBids, {
      limits: CFG.AI_LIMITS
    });

    // -----------------------
    // OpenAI: robust request
    // -----------------------
    const insights = await getAIInsights(aiPayload, {
      model: CFG.OPENAI_MODEL,
      temperature: CFG.OPENAI_TEMPERATURE,
      max_tokens: CFG.OPENAI_MAX_TOKENS,
      timeoutMs: CFG.OPENAI_TIMEOUT_MS
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        success: true,
        insights,
        contactLeads: contactLeads.slice(0, 25),
        priorityBids: aggregatedData.priorityBids.slice(0, 25),
        newsArticles,
        aggregatedData: {
          summary: aggregatedData.summary,
          bidUrgency: aggregatedData.bidUrgency,
          bidSystemDistribution: aggregatedData.bidSystemDistribution.slice(0, 10),
          agencyDistribution: aggregatedData.agencyDistribution.slice(0, 10),
          keywordDistribution: aggregatedData.keywordDistribution,
          scoreDistribution: aggregatedData.scoreDistribution,
          systemAdmin: aggregatedData.systemAdmin,
          disregardedAnalysis: aggregatedData.disregardedAnalysis,
          webinarKPIs: aggregatedData.webinarKPIs
        },
        generatedAt: new Date().toISOString()
      })
    };
  } catch (err) {
    console.error('[Insights] Fatal error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: err?.message || 'Unknown error',
        stack: err?.stack
      })
    };
  }
};

// ==================
// OpenAI helper
// ==================
async function getAIInsights(aiPayload, { model, temperature, max_tokens, timeoutMs }) {
  console.log('[OpenAI] Starting analysis with model:', model);
  console.log('[OpenAI] Payload summary:', {
    activeBids: aiPayload.bids?.priority?.length || 0,
    contactLeads: aiPayload.contacts?.count || 0,
    newsArticles: aiPayload.news?.length || 0,
    webinars: aiPayload.webinars?.recent?.length || 0
  });

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
      console.log('[OpenAI] Response length:', txt.length, 'chars');
      
      const parsed = JSON.parse(txt);
      console.log('[OpenAI] Successfully parsed JSON response');
      return parsed;
      
    } catch (err) {
      console.error('[OpenAI] API call failed:', {
        message: err.message,
        code: err.code,
        type: err.type,
        status: err.status
      });
      throw err;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await callOnce();
  } catch (e1) {
    console.warn('[OpenAI] First attempt failed:', e1.message);
    console.log('[OpenAI] Retrying in 2 seconds...');
    await sleep(2000);
    
    try {
      return await callOnce();
    } catch (e2) {
      console.error('[OpenAI] Second attempt failed:', e2.message);
      console.error('[OpenAI] Full error:', e2);
      
      // Return more helpful fallback
      return {
        executiveSummary:
          `Analysis engine temporarily unavailable. Current snapshot: ${aiPayload.summary?.activeBidsCount || 0} active bids, ${aiPayload.summary?.respondBidsCount || 0} requiring response, ${aiPayload.contacts?.count || 0} contact leads pending. Review priority bids with due dates in next 7 days. Check system admin alerts for any urgent notifications.`,
        topPriorities: [
          {
            title: 'Review Priority Bids',
            description: `${aiPayload.summary?.respondBidsCount || 0} bids marked as "Respond" require immediate attention`,
            action: 'Navigate to Bid Operations and review all "Respond" category bids',
            urgency: 'high'
          }
        ],
        bidRecommendations: [],
        systemInsights: {
          bidSystems: `${aiPayload.summary?.registeredSystemsCount || 0} active bid systems registered. Check distribution in data section.`,
          adminAlerts: aiPayload.summary?.newAdminEmailsCount > 0 
            ? `${aiPayload.summary.newAdminEmailsCount} new system admin notifications require review`
            : 'No pending system admin alerts',
          suggestions: 'Monitor bid system performance metrics in aggregated data section'
        },
        contentInsights: {
          topPerforming: 'Review webinar KPIs section for attendance trends',
          suggestions: 'Align content topics with procurement trends visible in bid keywords'
        },
        newsOpportunities: [],
        riskAlerts: [],
        revivedCandidates: []
      };
    }
  }
}

// ==================
// NEW: Enhanced parsers
// ==================
function parseBids(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    recommendation: row[0] || '',
    scoreDetails: row[1] || '',
    aiReasoning: row[2] || '',
    aiSummary: row[3] || '',
    emailDateReceived: row[4] || '',
    emailFrom: row[5] || '',
    keywordsCategory: row[6] || '',
    keywordsFound: row[7] || '',
    relevance: row[8] || '',
    emailSubject: row[9] || '',
    emailBody: row[10] || '',
    url: row[11] || '',
    dueDate: row[12] || '',
    significantSnippet: row[13] || '',
    emailDomain: row[14] || '',
    bidSystem: row[15] || '',
    country: row[16] || '',
    entity: row[17] || '',
    status: row[18] || '',
    dateAdded: row[19] || '',
    sourceEmailId: row[20] || ''
  }));
}

function parseAdminEmails(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    recommendation: row[0] || '',
    emailDateReceived: row[1] || '',
    emailFrom: row[2] || '',
    emailSubject: row[3] || '',
    emailBody: row[4] || '',
    bidSystem: row[5] || '',
    emailDomain: row[6] || '',
    dateAdded: row[7] || '',
    sourceEmailId: row[8] || '',
    status: row[9] || ''
  }));
}

function parseBidSystems(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    systemId: row[0] || '',
    systemName: row[1] || '',
    category: row[2] || '',
    status: row[3] || '',
    websiteUrl: row[4] || '',
    loginUrl: row[5] || '',
    username: row[6] || '',
    geographicCoverage: row[13] || ''
  }));
}

function parseWebinars(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    id: row[0] || '',
    title: row[1] || '',
    date: row[2] || '',
    time: row[3] || '',
    status: row[6] || '',
    registrationCount: parseInt(row[8] || '0', 10) || 0,
    attendanceCount: parseInt(row[9] || '0', 10) || 0
  }));
}

function parseSurveys(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '',
    email: row[1] || '',
    webinarId: row[2] || '',
    relevance: row[3] || '',
    rhonda: row[4] || '',
    chris: row[5] || '',
    guest: row[6] || '',
    sharing: row[7] || '',
    attending: row[8] || '',
    contactRequest: row[9] || '',
    comments: row[10] || ''
  }));
}

function parseRegistrations(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '',
    webinarId: row[1] || '',
    name: row[2] || '',
    email: row[3] || '',
    organization: row[4] || '',
    phone: row[5] || ''
  }));
}

// ==================
// NEW: Analysis functions
// ==================
function computeKeywordDistribution(bids) {
  const keywords = new Map();
  bids.forEach(bid => {
    const kws = (bid.keywordsFound || '').split(',').map(k => k.trim()).filter(Boolean);
    kws.forEach(kw => {
      keywords.set(kw, (keywords.get(kw) || 0) + 1);
    });
  });
  return Array.from(keywords.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
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
    if (reasoning.includes('no relevant keywords')) {
      reasons.set('No Keywords', (reasons.get('No Keywords') || 0) + 1);
    } else if (reasoning.includes('marketing') || reasoning.includes('promotional')) {
      reasons.set('Marketing Noise', (reasons.get('Marketing Noise') || 0) + 1);
    } else if (reasoning.includes('lacks')) {
      reasons.set('Missing Procurement Signals', (reasons.get('Missing Procurement Signals') || 0) + 1);
    } else {
      reasons.set('Other', (reasons.get('Other') || 0) + 1);
    }
  });
  return Array.from(reasons.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
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
    .map(bid => ({
      subject: bid.emailSubject,
      score: bid.scoreDetails,
      keywords: bid.keywordsFound,
      entity: bid.entity,
      reasoning: bid.aiReasoning
    }));
}

// ==================
// Keep existing functions
// ==================
async function fetchRelevantNews(query, limit) {
  console.log('[News] Starting fetch with query:', query);
  console.log('[News] Limit:', limit);
  
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    console.log('[News] URL:', url);
    
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CFG.NEWS_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);

    if (!res.ok) {
      console.log(`[News] HTTP ${res.status}`);
      return [];
    }
    
    const xml = await res.text();
    console.log('[News] XML response length:', xml.length, 'characters');
    
    const items = [];
    const regexes = [
      /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
      /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g
    ];
    
    for (const rx of regexes) {
      let m;
      while ((m = rx.exec(xml)) && items.length < limit * 2) {
        items.push({
          title: sanitize(m[1]),
          link: sanitize(m[2]),
          pubDate: sanitize(m[3]),
          source: 'Google News'
        });
      }
      if (items.length) break;
    }
    
    console.log('[News] Parsed', items.length, 'total items from XML');
    
    // Filter to last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 90);
    const sixtyDaysAgoMs = sixtyDaysAgo.getTime();
    
    console.log('[News] Filtering for articles after:', sixtyDaysAgo.toISOString());
    
    const seen = new Map();
    let filtered = 0;
    
    for (const it of items) {
      const key = (it.link || it.title).trim();
      const ts = Date.parse(it.pubDate || '') || 0;
      
      // Skip articles older than 60 days
      if (ts > 0 && ts < sixtyDaysAgoMs) {
        filtered++;
        continue;
      }
      
      const prev = seen.get(key);
      if (!prev || ts > (Date.parse(prev.pubDate || '') || 0)) {
        seen.set(key, it);
      }
    }
    
    console.log('[News] Filtered out', filtered, 'articles older than 60 days');
    
    const deduped = Array.from(seen.values())
      .sort((a, b) => Date.parse(b.pubDate || '') - Date.parse(a.pubDate || ''))
      .slice(0, limit);
    
    console.log(`[News] Returning ${deduped.length} articles from last 60 days`);
    
    if (deduped.length > 0) {
      console.log('[News] Sample article:', {
        title: deduped[0].title.substring(0, 80),
        pubDate: deduped[0].pubDate,
        daysAgo: Math.floor((Date.now() - Date.parse(deduped[0].pubDate)) / (1000 * 60 * 60 * 24))
      });
    }
    
    return deduped;
  } catch (e) {
    console.error('[News] Fetch error:', e?.message);
    console.error('[News] Full error:', e);
    return [];
  }
}

function extractContactLeads(surveys, registrations) {
  const leads = new Map();
  const regByEmail = new Map();
  registrations.forEach((r) => {
    const email = (r.email || '').toLowerCase().trim();
    if (email) regByEmail.set(email, r);
  });

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
          email: survey.email,
          name: reg?.name || 'Unknown',
          organization: reg?.organization || 'Unknown',
          phone: reg?.phone || '',
          score: 0,
          factors: [],
          comments: survey.comments || '',
          lastActivity: survey.timestamp
        });
      }
      const lead = leads.get(email);
      if (wantsContact) {
        lead.score += 50;
        lead.factors.push('Requested Contact');
      }
      if (wantsReminder) {
        lead.score += 30;
        lead.factors.push('Wants 3-Month Reminder');
      }
    }
  });

  const counts = new Map();
  registrations.forEach((r) => {
    const email = (r.email || '').toLowerCase().trim();
    if (email) counts.set(email, (counts.get(email) || 0) + 1);
  });

  leads.forEach((lead, email) => {
    const c = counts.get(email) || 0;
    if (c >= 2) {
      lead.score += 30 * (c - 1);
      lead.factors.push(`${c} Webinars Attended`);
    }
    if ((lead.comments || '').trim().length > 10) {
      lead.score += 20;
      lead.factors.push('Left Detailed Comments');
    }
  });

  return Array.from(leads.values()).sort((a, b) => b.score - a.score);
}

function computeBidUrgencyBuckets(bids) {
  const buckets = { '0-3': 0, '4-7': 0, '8-14': 0, '15+': 0, pastDue: 0, undated: 0 };
  bids.forEach((b) => {
    const due = bestDate(b.dueDate);
    if (!due || isNaN(due.getTime())) {
      buckets.undated++;
      return;
    }
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
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
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
      count: arr.length,
      totalAttendance,
      totalRegistrations: totalRegs,
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
      id: w.id,
      title: w.title,
      date: w.date,
      attendance: w.attendanceCount,
      deviationFromMean: Math.round((w.attendanceCount || 0) - allMean)
    }));

  return { past30: kpi(last30), past90: kpi(last90), presenterAverages, anomalies };
}

function computePresenterAverages(surveys) {
  const avg = (field) => {
    const vals = surveys
      .map((s) => {
        const m = String(s[field] || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return vals.length ? Number(mean.toFixed(2)) : null;
  };
  return { rhonda: avg('rhonda'), chris: avg('chris'), guest: avg('guest') };
}

// ==================
// AI payload builder
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
      id: w.id,
      title: w.title,
      date: w.date,
      status: w.status,
      registrationCount: w.registrationCount,
      attendanceCount: w.attendanceCount
    }));

  const disregardedSample = disregardedBids.slice(0, limits.DISREGARDED_SAMPLE).map(bid => ({
    subject: bid.emailSubject,
    score: bid.scoreDetails,
    keywords: bid.keywordsFound,
    entity: bid.entity,
    reasoning: (bid.aiReasoning || '').slice(0, 200)
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

    webinars: {
      kpis: aggregatedData.webinarKPIs,
      recent: recentWebinarsForAI
    },

    contacts: {
      leadsSample: redactedLeads.slice(0, 50),
      count: aggregatedData.contactLeads.length,
      topDomains: getTopDomainsFromEmails(aggregatedData.contactLeads.map((l) => l.email)).slice(0, 15)
    },

    news: aggregatedData.newsArticles.slice(0, limits.TOP_NEWS),

    bidSystems: aggregatedData.bidSystems.map(s => ({
      name: s.systemName,
      category: s.category,
      status: s.status,
      coverage: s.geographicCoverage
    }))
  };
}

// ==================
// Utilities
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
  return Object.entries(counts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}