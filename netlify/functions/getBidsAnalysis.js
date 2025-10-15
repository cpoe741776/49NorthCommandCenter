// netlify/functions/getBidsAnalysis.js
// AI analysis focused on bids data only

const { google } = require('googleapis');
const OpenAI = require('openai');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CFG = {
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '4000', 10),
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '15000', 10),
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '8000', 10),
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
    .slice(0, 15);
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

function bestDate(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(d) {
  if (!d) return null;
  return Math.floor((d - new Date()) / (1000 * 60 * 60 * 24));
}

async function getBidsAIInsights(bidsData) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: 'AI analysis unavailable (no API key configured).',
      topPriorities: [],
      bidRecommendations: [],
      riskAlerts: []
    };
  }

  const systemPrompt = `
You are a strategic business analyst for 49 North (Mental Armor™), specializing in government procurement intelligence.

Analyze the bids data and return JSON with:
- executiveSummary: Brief overview of bid pipeline health and opportunities
- topPriorities: Array of {title, action, urgency} for immediate focus
- bidRecommendations: Array of {subject, entity, recommendation, reasoning} for specific bids
- riskAlerts: Array of {issue, impact, mitigation} for potential problems

Focus on:
- High-scoring bids with "Respond" recommendations
- Upcoming deadlines (within 7 days)
- Keyword trends and market opportunities
- System performance issues
`.trim();

  const userPrompt = `
CURRENT_DATE: ${new Date().toISOString().split('T')[0]}
BIDS DATA:
${JSON.stringify(bidsData, null, 2)}
`.trim();

  try {
    const res = await Promise.race([
      openai.chat.completions.create({
        model: CFG.OPENAI_MODEL,
        temperature: CFG.OPENAI_TEMPERATURE,
        max_tokens: CFG.OPENAI_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout')), CFG.OPENAI_TIMEOUT_MS))
    ]);
    const txt = res.choices?.[0]?.message?.content || '{}';
    return JSON.parse(txt);
  } catch (err) {
    console.error('[BidsAI] OpenAI failed:', err.message);
    return {
      executiveSummary: 'AI analysis unavailable. Data processed below.',
      topPriorities: [],
      bidRecommendations: [],
      riskAlerts: []
    };
  }
}

exports.handler = async (event, context) => {
  const started = Date.now();
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    // Google auth
    const googleAuth = getGoogleAuth();
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch only bids data
    const bidRanges = ['Active_Bids!A2:U', 'Submitted!A2:U', 'Disregarded!A2:U', 'Active_Admin!A2:J'];
    
    const bidsData = await withTimeout(
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        ranges: bidRanges
      }),
      'bidsBatchGet',
      CFG.GOOGLE_TIMEOUT_MS
    );

    if (!bidsData) {
      return ok(headers, {
        executiveSummary: 'Unable to fetch bids data.',
        timestamp: new Date().toISOString(),
        summary: { activeBidsCount: 0, respondCount: 0, submittedCount: 0, disregardedCount: 0 },
        error: 'Data fetch failed'
      });
    }

    // Parse data
    const activeBids = parseBids(bidsData.data.valueRanges[0]?.values || []);
    const submittedBids = parseBids(bidsData.data.valueRanges[1]?.values || []);
    const disregardedBids = parseBids(bidsData.data.valueRanges[2]?.values || []);
    const adminEmails = parseAdminEmails(bidsData.data.valueRanges[3]?.values || []);

    // Basic analysis
    const respondBids = activeBids.filter((b) => (b.recommendation || '').trim().toLowerCase() === 'respond');
    const keywordDistribution = computeKeywordDistribution(activeBids);
    const bidSystemDistribution = countByField(activeBids, (b) => b.bidSystem, 'Unknown');
    const agencyDistribution = countByField(activeBids, (b) => b.entity, 'Unknown');
    const newAdminCount = adminEmails.filter((e) => (e.status || '').toLowerCase() === 'new').length;

    const bidsDataForAI = {
      summary: {
        activeBidsCount: activeBids.length,
        respondBidsCount: respondBids.length,
        submittedBidsCount: submittedBids.length,
        disregardedBidsCount: disregardedBids.length,
        adminEmailsCount: adminEmails.length,
        newAdminEmailsCount: newAdminCount
      },
      keywordDistribution: keywordDistribution.slice(0, 10),
      bidSystemDistribution: bidSystemDistribution.slice(0, 10),
      agencyDistribution: agencyDistribution.slice(0, 10),
      priorityBids: respondBids.slice(0, 10).map((bid) => ({
        subject: bid.emailSubject || 'No Subject',
        entity: bid.entity || 'Unknown',
        bidSystem: bid.bidSystem || 'Unknown',
        dueDate: bid.dueDate || 'Not specified',
        daysUntilDue: daysUntil(bestDate(bid.dueDate)),
        score: bid.scoreDetails,
        keywords: bid.keywordsFound,
        reasoning: bid.aiReasoning
      }))
    };

    // AI analysis
    const aiInsights = await getBidsAIInsights(bidsDataForAI);

    return ok(headers, {
      ...aiInsights,
      timestamp: new Date().toISOString(),
      summary: bidsDataForAI.summary,
      keywordDistribution: bidsDataForAI.keywordDistribution,
      bidSystemDistribution: bidsDataForAI.bidSystemDistribution,
      agencyDistribution: bidsDataForAI.agencyDistribution,
      priorityBids: bidsDataForAI.priorityBids,
      processingTime: `${Date.now() - started}ms`,
      section: 'bids'
    });

  } catch (e) {
    console.error('[BidsAnalysis] Error:', e?.message);
    return ok(headers, {
      executiveSummary: 'Bids analysis unavailable due to technical issues.',
      topPriorities: [],
      bidRecommendations: [],
      riskAlerts: [],
      timestamp: new Date().toISOString(),
      summary: { activeBidsCount: 0, respondCount: 0, submittedCount: 0, disregardedCount: 0 },
      error: e?.message || 'Unknown error',
      processingTime: `${Date.now() - started}ms`,
      section: 'bids'
    });
  }
};
