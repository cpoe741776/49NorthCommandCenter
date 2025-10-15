// netlify/functions/getWebinarAnalysis.js
// AI analysis focused on webinars, surveys, registrations, and hot leads

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
  const withinDays = (n) => completed.filter((w) => Math.floor((now - new Date(w.date)) / (1000 * 60 * 60 * 24)) <= n);
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

async function getWebinarAIInsights(webinarData) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: 'AI analysis unavailable (no API key configured).',
      topPriorities: [],
      contentInsights: {},
      hotLeads: []
    };
  }

  const systemPrompt = `
You are a strategic business analyst for 49 North (Mental Armor™), specializing in webinar performance and lead generation.

Analyze the webinar data and return JSON with:
- executiveSummary: Brief overview of webinar performance and lead quality
- topPriorities: Array of {title, action, urgency} for webinar strategy
- contentInsights: Object with {topPerforming, suggestions} for content strategy
- hotLeads: Array of {name, organization, score, factors} for highest-value prospects

Focus on:
- Attendance rates and trends
- Presenter performance scores
- Lead quality and contact requests
- Content topics that drive engagement
`.trim();

  const userPrompt = `
CURRENT_DATE: ${new Date().toISOString().split('T')[0]}
WEBINAR DATA:
${JSON.stringify(webinarData, null, 2)}
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
    console.error('[WebinarAI] OpenAI failed:', err.message);
    return {
      executiveSummary: 'AI analysis unavailable. Data processed below.',
      topPriorities: [],
      contentInsights: {},
      hotLeads: []
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
    
    // Fetch webinar data
    const webinarRanges = ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F'];
    
    const webinarData = await withTimeout(
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.WEBINAR_SHEET_ID,
        ranges: webinarRanges
      }),
      'webinarBatchGet',
      CFG.GOOGLE_TIMEOUT_MS
    );

    if (!webinarData) {
      return ok(headers, {
        executiveSummary: 'Unable to fetch webinar data.',
        timestamp: new Date().toISOString(),
        summary: { totalWebinars: 0, completedWebinars: 0, totalRegistrations: 0, contactRequests: 0 },
        error: 'Data fetch failed'
      });
    }

    // Parse data
    const webinars = parseWebinars(webinarData.data.valueRanges[0]?.values || []);
    const surveys = parseSurveys(webinarData.data.valueRanges[1]?.values || []);
    const registrations = parseRegistrations(webinarData.data.valueRanges[2]?.values || []);

    // Analysis
    const contactLeads = extractContactLeads(surveys, registrations);
    const webinarKPIs = computeWebinarKPIs(webinars, surveys);
    const completedWebinars = webinars.filter((w) => w.status === 'Completed').length;

    const webinarDataForAI = {
      summary: {
        totalWebinars: webinars.length,
        completedWebinars,
        totalRegistrations: registrations.length,
        totalSurveyResponses: surveys.length,
        contactRequests: contactLeads.length
      },
      webinarKPIs,
      hotLeads: contactLeads.slice(0, 10).map(lead => ({
        name: lead.name,
        organization: lead.organization,
        email: lead.email,
        score: lead.score,
        factors: lead.factors,
        comments: lead.comments?.slice(0, 100) || ''
      })),
      recentWebinars: webinars
        .filter(w => w.status === 'Completed')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(w => ({
          title: w.title,
          date: w.date,
          attendance: w.attendanceCount,
          registrations: w.registrationCount
        }))
    };

    // AI analysis
    const aiInsights = await getWebinarAIInsights(webinarDataForAI);

    return ok(headers, {
      ...aiInsights,
      timestamp: new Date().toISOString(),
      summary: webinarDataForAI.summary,
      webinarKPIs: webinarDataForAI.webinarKPIs,
      hotLeads: webinarDataForAI.hotLeads,
      recentWebinars: webinarDataForAI.recentWebinars,
      processingTime: `${Date.now() - started}ms`,
      section: 'webinars'
    });

  } catch (e) {
    console.error('[WebinarAnalysis] Error:', e?.message);
    return ok(headers, {
      executiveSummary: 'Webinar analysis unavailable due to technical issues.',
      topPriorities: [],
      contentInsights: {},
      hotLeads: [],
      timestamp: new Date().toISOString(),
      summary: { totalWebinars: 0, completedWebinars: 0, totalRegistrations: 0, contactRequests: 0 },
      error: e?.message || 'Unknown error',
      processingTime: `${Date.now() - started}ms`,
      section: 'webinars'
    });
  }
};
