// netlify/functions/getAIInsights.js
// Hardened: unified CORS/auth, strict timeouts, stable JSON shape

const { google } = require('googleapis');
const OpenAI = require('openai');
const { corsHeaders, methodGuard, ok, bad, checkAuth, safeJson } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Config ----
const CFG = {
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '6000', 10),
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '20000', 10),

  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '8000', 10),

  NEWS_QUERY:
    process.env.NEWS_QUERY ||
    'mental health training government OR resilience training military OR law enforcement mental health programs',
  NEWS_MAX: parseInt(process.env.NEWS_MAX ?? '6', 10),
  NEWS_TIMEOUT_MS: parseInt(process.env.NEWS_TIMEOUT_MS ?? '4000', 10),

  AI_LIMITS: {
    PRIORITY_BIDS: 10,
    TOP_NEWS: 6,
    TOP_SYSTEMS: 12,
    TOP_ORGS_PER_LIST: 12,
    WEBINARS_FOR_AI: 20,
    SURVEY_COMMENT_SNIPPET: 150,
    DISREGARDED_SAMPLE: 8
  },

  FUNCTION_TIMEOUT_MS: 24000, // Netlify hard limit ~26s — keep headroom
  ENABLE_CACHING: true,
  CACHE_TTL_MS: 5 * 60 * 1000
};

// ---- Utilities ----
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function withTimeoutPromise(promise, label, ms) {
  const t = setTimeout(() => console.warn(`[Timeout] ${label} exceeded ${ms}ms`), ms + 1);
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms))
    ]);
    clearTimeout(t);
    return result;
  } catch (err) {
    clearTimeout(t);
    if (err && String(err.message || '').includes('timeout')) {
      console.warn(`[Timeout] ${label} hit timeout`);
      return null; // treat as soft-fail and continue
    }
    throw err;
  }
}

function bestDate(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysBetween(d1, d2) {
  if (!d1 || !d2) return Infinity;
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}
function daysUntil(d) {
  if (!d) return null;
  return daysBetween(new Date(), d);
}
function sanitize(s) {
  return (s || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

// ---- Parsers (unchanged semantics) ----
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
function parseSocialPosts(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '',
    status: row[1] || '',
    contentType: row[2] || '',
    title: row[3] || '',
    body: row[4] || '',
    imageUrl: row[5] || '',
    videoUrl: row[6] || '',
    platforms: row[7] || '',
    scheduleDate: row[8] || '',
    publishedDate: row[9] || '',
    tags: row[17] || ''
  }));
}

function computeKeywordDistribution(bids) {
  const keywords = new Map();
  bids.forEach((bid) => {
    const kws = (bid.keywordsFound || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    kws.forEach((kw) => keywords.set(kw, (keywords.get(kw) || 0) + 1));
  });
  return Array.from(keywords.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}
function computeScoreDistribution(bids) {
  const buckets = { '0-5': 0, '6-8': 0, '9-14': 0, '15-20': 0 };
  bids.forEach((bid) => {
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
  disregarded.forEach((bid) => {
    const reasoning = bid.aiReasoning || '';
    if (reasoning.includes('no relevant keywords'))
      reasons.set('No Keywords', (reasons.get('No Keywords') || 0) + 1);
    else if (reasoning.includes('marketing') || reasoning.includes('promotional'))
      reasons.set('Marketing Noise', (reasons.get('Marketing Noise') || 0) + 1);
    else if (reasoning.includes('lacks'))
      reasons.set('Missing Procurement Signals', (reasons.get('Missing Procurement Signals') || 0) + 1);
    else reasons.set('Other', (reasons.get('Other') || 0) + 1);
  });
  return Array.from(reasons.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
function findRevivalCandidates(disregarded) {
  return disregarded
    .filter((bid) => {
      const score = parseFloat(bid.scoreDetails) || 0;
      const hasKeywords = (bid.keywordsFound || '').trim().length > 0;
      const hasEntity = bid.entity && bid.entity !== 'Unknown';
      return score >= 5 && hasKeywords && hasEntity;
    })
    .sort((a, b) => parseFloat(b.scoreDetails) - parseFloat(a.scoreDetails))
    .slice(0, 10)
    .map((bid) => ({
      subject: bid.emailSubject,
      score: bid.scoreDetails,
      keywords: bid.keywordsFound,
      entity: bid.entity,
      reasoning: bid.aiReasoning
    }));
}

async function fetchRelevantNews(query, limit) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await withTimeoutPromise(fetch(url), 'newsFetch', CFG.NEWS_TIMEOUT_MS);
    if (!res) return [];
    if (!res.ok) return [];
    const xml = await res.text();

    const items = [];
    const regexes = [
      /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
      /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g
    ];

    for (let rx of regexes) {
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

    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
    const seen = new Map();
    for (const it of items) {
      const key = (it.link || it.title).trim();
      const ts = Date.parse(it.pubDate || '') || 0;
      if (ts > 0 && ts < cutoff) continue;
      const prev = seen.get(key);
      if (!prev || ts > (Date.parse(prev.pubDate || '') || 0)) {
        seen.set(key, it);
      }
    }
    return Array.from(seen.values())
      .sort((a, b) => Date.parse(b.pubDate || '') - Date.parse(a.pubDate || ''))
      .slice(0, limit);
  } catch (e) {
    console.error('[News] Fetch error:', e?.message);
    return [];
  }
}

function computeBidUrgencyBuckets(bids) {
  const buckets = { '0-3': 0, '4-7': 0, '8-14': 0, '15+': 0, pastDue: 0, undated: 0 };
  bids.forEach((b) => {
    const due = bestDate(b.dueDate);
    if (!due || Number.isNaN(due.getTime())) {
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
function computeWebinarKPIs(webinars, surveys) {
  const completed = webinars.filter((w) => w.status === 'Completed').sort((a, b) => new Date(a.date) - new Date(b.date));
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
function getTopDomainsFromEmails(emails) {
  const counts = {};
  (emails || []).forEach((e) => {
    const domain = (e || '').split('@')[1]?.toLowerCase();
    if (!domain) return;
    if (/(gmail|yahoo|hotmail|outlook)\./i.test(domain)) return;
    counts[domain] = (counts[domain] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}

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

  const disregardedSample = disregardedBids.slice(0, limits.DISREGARDED_SAMPLE).map((bid) => ({
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
    webinars: { kpis: aggregatedData.webinarKPIs, recent: recentWebinarsForAI },
    contacts: {
      leadsSample: redactedLeads.slice(0, 50),
      count: aggregatedData.contactLeads.length,
      topDomains: getTopDomainsFromEmails(aggregatedData.contactLeads.map((l) => l.email)).slice(0, 15)
    },
    news: aggregatedData.newsArticles.slice(0, limits.TOP_NEWS),
    bidSystems: aggregatedData.bidSystems.map((s) => ({
      name: s.systemName,
      category: s.category,
      status: s.status,
      coverage: s.geographicCoverage
    }))
  };
}

// ---- OpenAI call (JSON only) ----
async function getAIInsights(aiPayload, { model, temperature, max_tokens, timeoutMs }) {
  // If OPENAI key is missing, return a structured "AI unavailable" block immediately
  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: 'AI analysis unavailable (no API key configured). Data processed below.',
      topPriorities: [],
      bidRecommendations: [],
      systemInsights: {
        bidSystems: 'See data distributions.',
        adminAlerts: 'Review system admin notifications.',
        suggestions: 'Monitor system performance and address any login or sync issues.'
      },
      contentInsights: { topPerforming: 'See webinar KPIs.', suggestions: 'Align topics with procurement trends.' },
      newsOpportunities: [],
      riskAlerts: [],
      revivedCandidates: []
    };
  }

  const systemPrompt = `
You are a strategic business analyst for 49 North (Mental Armor™), specializing in government procurement intelligence and resilience training market analysis.

CRITICAL RULES:
- Bids are separate from webinars; do NOT conflate datasets.
- System admin emails are notifications, NOT bid opportunities.
- Disregarded bids may contain revival candidates if conditions changed.
- Return only valid JSON matching the required schema. No markdown.

Return JSON with keys:
executiveSummary, topPriorities[], bidRecommendations[], systemInsights, contentInsights, newsOpportunities[], riskAlerts[], revivedCandidates[].
`.trim();

  const userPrompt = `
CURRENT_DATE: ${new Date().toISOString().split('T')[0]}
BUSINESS INTELLIGENCE DATA:
${JSON.stringify(aiPayload, null, 2)}
`.trim();

  const once = async () => {
    const res = await Promise.race([
      openai.chat.completions.create({
        model,
        temperature,
        max_tokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout')), timeoutMs))
    ]);
    const txt = res.choices?.[0]?.message?.content || '{}';
    return JSON.parse(txt);
  };

  try {
    return await once();
  } catch (e1) {
    await sleep(1200);
    try {
      return await once();
    } catch (e2) {
      return {
        executiveSummary:
          'AI analysis unavailable. Data processed without strategic summary.',
        topPriorities: [],
        bidRecommendations: [],
        systemInsights: {
          bidSystems: 'See data distributions.',
          adminAlerts: 'Review system admin notifications.',
          suggestions: 'Monitor system performance and address any login or sync issues.'
        },
        contentInsights: {
          topPerforming: 'See webinar KPIs.',
          suggestions: 'Align topics with procurement trends.'
        },
        newsOpportunities: [],
        riskAlerts: [],
        revivedCandidates: []
      };
    }
  }
}

// ---- Handler ----
exports.handler = async (event, context) => {
  const started = Date.now();
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'POST', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    // Optional POST filters (ignored by default)
    if (event.httpMethod === 'POST' && event.body) {
      const [, err] = safeJson(event.body); // ESLint-safe destructuring
      if (err) return bad(headers, 'Invalid JSON body');
    }

    // Google auth
    let auth;
    try {
      auth = getGoogleAuth();
      await auth.authorize();
    } catch (authErr) {
      console.error('[Insights] Google auth failure:', authErr?.message);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Google authentication failed' })
      };
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch ranges (batch) with timeouts
    const bidRanges = ['Active_Bids!A2:U', 'Submitted!A2:U', 'Disregarded!A2:U', 'Active_Admin!A2:J'];
    const webinarRanges = ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F'];
    const systemsRanges = ['_BidSystemsSync!A2:O'];
    const socialRanges = ['MainPostData!A2:R'];

    const [bidsData, webinarData, systemsData, socialData] = await Promise.all([
      withTimeoutPromise(
        sheets.spreadsheets.values.batchGet({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          ranges: bidRanges
        }),
        'bidsBatchGet',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeoutPromise(
        sheets.spreadsheets.values.batchGet({
          spreadsheetId: process.env.WEBINAR_SHEET_ID,
          ranges: webinarRanges
        }),
        'webinarBatchGet',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeoutPromise(
        sheets.spreadsheets.values.batchGet({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          ranges: systemsRanges
        }),
        'systemsBatchGet',
        CFG.GOOGLE_TIMEOUT_MS
      ),
      withTimeoutPromise(
        sheets.spreadsheets.values.batchGet({
          spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
          ranges: socialRanges
        }),
        'socialBatchGet',
        CFG.GOOGLE_TIMEOUT_MS
      )
    ]);

    if (!bidsData || !webinarData) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'Unable to fetch critical data',
          details: 'Service temporarily unavailable',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Parse
    const activeBids = parseBids(bidsData.data.valueRanges[0]?.values || []);
    const submittedBids = parseBids(bidsData.data.valueRanges[1]?.values || []);
    const disregardedBids = parseBids(bidsData.data.valueRanges[2]?.values || []);
    const adminEmails = parseAdminEmails(bidsData.data.valueRanges[3]?.values || []);
    const webinars = parseWebinars(webinarData.data.valueRanges[0]?.values || []);
    const surveys = parseSurveys(webinarData.data.valueRanges[1]?.values || []);
    const registrations = parseRegistrations(webinarData.data.valueRanges[2]?.values || []);
    const bidSystems = parseBidSystems(systemsData?.data.valueRanges[0]?.values || []);
    const socialPosts = parseSocialPosts(socialData?.data.valueRanges[0]?.values || []);

    // Aggregations
    const contactLeads = extractContactLeads(surveys, registrations);
    const respondBids = activeBids.filter((b) => (b.recommendation || '').toLowerCase() === 'respond');
    const newsArticles = (await fetchRelevantNews(CFG.NEWS_QUERY, CFG.NEWS_MAX)) || [];
    const bidUrgency = computeBidUrgencyBuckets(activeBids);
    const bidSystemDistribution = countByField(activeBids, (b) => b.bidSystem, 'Unknown');
    const agencyDistribution = countByField(activeBids, (b) => b.entity, 'Unknown');
    const keywordDistribution = computeKeywordDistribution(activeBids);
    const scoreDistribution = computeScoreDistribution(activeBids);
    const adminBySystem = countByField(adminEmails, (e) => e.bidSystem, 'Unknown');
    const newAdminCount = adminEmails.filter((e) => (e.status || '').toLowerCase() === 'new').length;
    const disregardedByReason = analyzeDisregardedReasons(disregardedBids);
    const revivedCandidates = findRevivalCandidates(disregardedBids);
    const webinarKPIs = computeWebinarKPIs(webinars, surveys);

    const aggregatedData = {
      timestamp: new Date().toISOString(),
      summary: {
        activeBidsCount: activeBids.length,
        respondBidsCount: respondBids.length,
        submittedBidsCount: submittedBids.length,
        disregardedBidsCount: disregardedBids.length,
        adminEmailsCount: adminEmails.length,
        newAdminEmailsCount: newAdminCount,
        registeredSystemsCount: bidSystems.filter((s) => s.status === 'Active').length,
        completedWebinars: webinars.filter((w) => w.status === 'Completed').length,
        totalSurveyResponses: surveys.length,
        contactRequests: contactLeads.length,
        totalRegistrations: registrations.length,
        socialPostsTotal: socialPosts.length,
        socialPostsPublished: socialPosts.filter((p) => p.status === 'Published').length,
        socialPostsDrafts: socialPosts.filter((p) => p.status === 'Draft').length
      },
      bidUrgency,
      bidSystemDistribution,
      agencyDistribution,
      keywordDistribution,
      scoreDistribution,
      systemAdmin: { bySystem: adminBySystem, newCount: newAdminCount },
      disregardedAnalysis: { byReason: disregardedByReason, revivedCandidates },
      webinarKPIs,
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
      socialPosts
    };

    // Early time check
    if (Date.now() - started > 15000) {
      console.warn('[Insights] Time nearly exceeded; skipping AI.');
      return ok(headers, {
        executiveSummary: 'AI Analysis skipped due to time constraints. Basic data loaded successfully.',
        timestamp: new Date().toISOString(),
        summary: aggregatedData.summary,
        bids: aggregatedData.bidUrgency,
        webinarKPIs: aggregatedData.webinarKPIs,
        priorityBids: aggregatedData.priorityBids,
        contactLeads: aggregatedData.contactLeads,
        newsArticles: aggregatedData.newsArticles,
        socialPosts: aggregatedData.socialPosts,
        note: 'Full AI analysis unavailable due to time constraints',
        processingTime: `${Date.now() - started}ms`
      });
    }

    // Build AI payload + call
    const aiPayload = buildAIPayload(aggregatedData, webinars, surveys, disregardedBids, { limits: CFG.AI_LIMITS });
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
      aiInsights = {
        executiveSummary: 'AI analysis unavailable. Data has been processed and is displayed below.',
        topPriorities: [],
        bidRecommendations: [],
        systemInsights: {
          bidSystems: 'See distributions in data section.',
          adminAlerts: 'Review system admin notifications',
          suggestions: 'Monitor bid system performance'
        },
        contentInsights: { topPerforming: 'See webinar KPIs section', suggestions: 'Align with procurement trends' },
        newsOpportunities: [],
        riskAlerts: [],
        revivedCandidates: []
      };
    }

    return ok(headers, {
      executiveSummary: aiInsights.executiveSummary || 'AI analysis unavailable.',
      topPriorities: aiInsights.topPriorities || [],
      bidRecommendations: aiInsights.bidRecommendations || [],
      systemInsights: aiInsights.systemInsights,
      contentInsights: aiInsights.contentInsights,
      newsOpportunities: aiInsights.newsOpportunities,
      riskAlerts: aiInsights.riskAlerts,
      revivedCandidates: aiInsights.revivedCandidates,
      timestamp: new Date().toISOString(),
      summary: aggregatedData.summary,
      bids: aggregatedData.bidUrgency,
      webinarKPIs: aggregatedData.webinarKPIs,
      contactLeads: aggregatedData.contactLeads.slice(0, 50),
      priorityBids: aggregatedData.priorityBids.slice(0, 25),
      newsArticles: aggregatedData.newsArticles,
      socialPosts: aggregatedData.socialPosts.slice(0, 10),
      processingTime: `${Date.now() - started}ms`
    });
  } catch (e) {
    console.error('[Insights] Fatal error:', e);
    const payload = {
      error: 'Service temporarily unavailable',
      message: e?.message || 'Unknown error',
      stack: process.env.NODE_ENV !== 'production' ? e?.stack : undefined,
      timestamp: new Date().toISOString()
    };
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(payload)
    };
  }
}; // closes exports.handler

// ---- Contact leads (unchanged semantics) ----
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
