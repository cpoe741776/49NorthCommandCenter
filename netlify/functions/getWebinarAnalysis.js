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
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '3000', 10),
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '20000', 10),
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

function parseAttendance(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '',
    webinarId: row[1] || '',
    name: row[2] || '',
    email: row[3] || '',
    organization: row[4] || '',
    joinTime: row[5] || '',
    leaveTime: row[6] || '',
    duration: row[7] || '',
    registrationSource: row[8] || '',
    surveyCompleted: row[9] || '',
    notes: row[10] || '',
    status: row[11] || '',
    extra: row[12] || ''
  }));
}

function extractContactLeads(surveys, registrations, attendance) {
  const leads = new Map();
  const regByEmail = new Map();
  const attendanceByEmail = new Map();
  
  // Map registrations by email
  registrations.forEach((r) => {
    const email = (r.email || '').toLowerCase().trim();
    if (email) {
      if (!regByEmail.has(email)) {
        regByEmail.set(email, []);
      }
      regByEmail.get(email).push(r);
    }
  });

  // Map attendance by email
  attendance.forEach((a) => {
    const email = (a.email || '').toLowerCase().trim();
    if (email) {
      if (!attendanceByEmail.has(email)) {
        attendanceByEmail.set(email, []);
      }
      attendanceByEmail.get(email).push(a);
    }
  });

  const normalizeText = (input) => {
    const s = String(input || '')
      .toLowerCase()
      .normalize('NFKD') // split accents
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/['']/g, "'") // unify quotes
      .replace(/\s+/g, ' ') // collapse spaces
      .trim();
    // Remove leading emojis and decorative symbols while keeping words
    return s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/\s+/g, ' ').trim();
  };

  surveys.forEach((survey) => {
    const email = (survey.email || '').toLowerCase().trim();
    if (!email) return;

    const valRaw = String(survey.contactRequest || '').trim();
    const norm = normalizeText(valRaw);

    // Exact dropdown options (normalized)
    const OPT_REMINDER = normalizeText('🟢 Drop me a reminder in 3 months or so');
    const OPT_MEETING = normalizeText("🟢 🌟 Let's schedule a meeting within the next week");
    const OPT_NO = normalizeText('🔴 No, thank you');

    // Determine intent by exact-match first; fallback to robust contains
    const isReminderExact = norm === OPT_REMINDER;
    const isMeetingExact = norm === OPT_MEETING;
    const isNoExact = norm === OPT_NO;

    const wantsReminder = isReminderExact || /reminder|3 month/.test(norm);
    const wantsContact = isMeetingExact || (!isNoExact && /(schedule|meeting|contact)/.test(norm));

    if (wantsContact || wantsReminder) {
      if (!leads.has(email)) {
        const regs = regByEmail.get(email) || [];
        const firstReg = regs[0];
        leads.set(email, {
          email: survey.email,
          name: firstReg?.name || 'Unknown',
          organization: firstReg?.organization || 'Unknown',
          phone: firstReg?.phone || '',
          score: 0,
          factors: [],
          comments: survey.comments || '',
          lastActivity: survey.timestamp
        });
      }
      const lead = leads.get(email);
      if (wantsContact) {
        lead.score += 100; // Increased from 50 - highest priority!
        lead.factors.push('Requested Contact');
      }
      if (wantsReminder) {
        lead.score += 30;
        lead.factors.push('Wants 3-Month Reminder');
      }
    }
  });

  // Add points for webinar attendance (not just registrations)
  leads.forEach((lead, email) => {
    const attendances = attendanceByEmail.get(email) || [];
    const uniqueWebinarIds = new Set(attendances.map(a => a.webinarId));
    const attendanceCount = uniqueWebinarIds.size;
    
    if (attendanceCount >= 2) {
      lead.score += 30 * (attendanceCount - 1);
      lead.factors.push(`${attendanceCount} Webinars Attended`);
    } else if (attendanceCount === 1) {
      lead.score += 10;
      lead.factors.push('Attended Webinar');
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
- executiveSummary: Brief overview of webinar performance, upcoming webinars with recent activity, and lead quality
- topPriorities: Array of {title, action, urgency} for webinar strategy
- contentInsights: Object with {topPerforming, suggestions} for content strategy
- hotLeads: Array of {name, organization, score, factors} for highest-value prospects

IMPORTANT: Pay special attention to:
- UPCOMING WEBINARS: Mention upcoming webinars by title, date, current registration count, and recent registrations (last 24-48 hours)
- RECENT REGISTRATIONS: Highlight webinars that have received new registrations recently (especially in the last 24-48 hours)
- Attendance rates and trends from completed webinars
- Presenter performance scores
- Lead quality and contact requests
- Content topics that drive engagement
- Attendance data patterns

When an upcoming webinar has recent registrations, highlight this prominently as it indicates growing interest.
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
    
    // Fetch webinar data - ALL 4 TABS: Webinars, Survey_Responses, Registrations, Attendance
    const webinarRanges = ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F', 'Attendance!A2:M'];
    
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

    // Parse data - ALL 4 TABS
    const webinars = parseWebinars(webinarData.data.valueRanges[0]?.values || []);
    const surveys = parseSurveys(webinarData.data.valueRanges[1]?.values || []);
    const registrations = parseRegistrations(webinarData.data.valueRanges[2]?.values || []);
    const attendance = parseAttendance(webinarData.data.valueRanges[3]?.values || []);

    // Analysis
    const contactLeads = extractContactLeads(surveys, registrations, attendance);
    const webinarKPIs = computeWebinarKPIs(webinars, surveys);
    const completedWebinars = webinars.filter((w) => w.status === 'Completed').length;

    // Calculate recent registrations (last 24-48 hours)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentRegistrations = registrations.filter(r => {
      if (!r.timestamp) return false;
      const regDate = new Date(r.timestamp);
      return regDate >= yesterday;
    });

    // Group recent registrations by webinar
    const recentRegsByWebinar = new Map();
    recentRegistrations.forEach(r => {
      const webinarId = r.webinarId;
      if (!recentRegsByWebinar.has(webinarId)) {
        recentRegsByWebinar.set(webinarId, []);
      }
      recentRegsByWebinar.get(webinarId).push(r);
    });

    // Get upcoming webinars with registration details
    const upcomingWebinars = webinars
      .filter(w => w.status === 'Upcoming' || w.status === 'Scheduled')
      .map(w => ({
        id: w.id,
        title: w.title,
        date: w.date,
        time: w.time,
        registrationCount: w.registrationCount,
        recentRegistrationsCount: recentRegsByWebinar.get(w.id)?.length || 0,
        recentRegistrations: recentRegsByWebinar.get(w.id)?.slice(0, 5).map(r => ({
          name: r.name,
          organization: r.organization,
          email: r.email,
          timestamp: r.timestamp
        })) || []
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const webinarDataForAI = {
      summary: {
        totalWebinars: webinars.length,
        completedWebinars,
        upcomingWebinars: upcomingWebinars.length,
        totalRegistrations: registrations.length,
        recentRegistrations24h: recentRegistrations.length,
        totalSurveyResponses: surveys.length,
        totalAttendance: attendance.length,
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
        })),
      upcomingWebinars: upcomingWebinars.slice(0, 10), // Include top 10 upcoming webinars
      attendanceInsights: {
        totalAttendees: attendance.length,
        recentAttendees: attendance.filter(a => {
          if (!a.timestamp) return false;
          const attDate = new Date(a.timestamp);
          return attDate >= yesterday;
        }).length
      }
    };

    // AI analysis
    const aiInsights = await getWebinarAIInsights(webinarDataForAI);

    // Fallback if AI times out or fails
    const finalInsights = aiInsights || {
      executiveSummary: 'AI analysis timed out. Basic metrics shown below.',
      topPriorities: [],
      webinarRecommendations: [
        { title: 'Review webinar metrics', action: 'Check registration and attendance rates', reasoning: 'AI analysis unavailable' }
      ],
      hotLeads: []
    };

    // Normalize executiveSummary to a plain string (in case AI returned an object)
    let executiveSummaryText = '';
    const exec = finalInsights.executiveSummary;
    if (typeof exec === 'string') {
      executiveSummaryText = exec;
    } else if (exec && typeof exec === 'object') {
      const parts = [];
      if (typeof exec.overview === 'string') parts.push(exec.overview);
      if (typeof exec.leadQuality === 'string') parts.push(exec.leadQuality);
      if (typeof exec.summary === 'string') parts.push(exec.summary);
      executiveSummaryText = parts.join(' ').trim() || 'Insights available; expand details below.';
    } else {
      executiveSummaryText = 'Insights available; expand details below.';
    }

    return ok(headers, {
      ...finalInsights,
      executiveSummary: executiveSummaryText,
      timestamp: new Date().toISOString(),
      summary: webinarDataForAI.summary,
      webinarKPIs: webinarDataForAI.webinarKPIs,
      hotLeads: webinarDataForAI.hotLeads,
      recentWebinars: webinarDataForAI.recentWebinars,
      upcomingWebinars: webinarDataForAI.upcomingWebinars,
      attendanceInsights: webinarDataForAI.attendanceInsights,
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
