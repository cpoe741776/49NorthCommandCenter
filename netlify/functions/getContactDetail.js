// netlify/functions/getContactDetail.js
// Fetches detailed contact information including full activity history.
// Perf: WEBINAR_SHEET (4 tabs) and CRM_SHEET (2 tabs) each fetched with a
// single batchGet and both run in parallel — was 6 sequential API calls.

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, fetchWithTimeout } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const CRM_SHEET_ID = process.env.CRM_SHEET_ID;
const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const email = url.searchParams.get('email');
    if (!email) return ok(headers, { success: false, error: 'Email parameter required' });

    console.log('[ContactDetail] Fetching details for:', email);

    // ── All three data sources in parallel ──────────────────────────────────
    const [brevoContact, sheetData] = await Promise.all([
      fetchBrevoContactDetail(email),
      fetchAllSheetData(email),
    ]);

    return ok(headers, {
      success: true,
      contact: brevoContact,
      webinarHistory: sheetData.webinarHistory,
      surveyResponses: sheetData.surveyResponses,
      notes: sheetData.notes,
      tasks: sheetData.tasks,
      emailActivity: [], // placeholder — Brevo campaign stats require campaign IDs
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[ContactDetail] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

// ── Brevo direct contact lookup (already a single endpoint call) ─────────────
async function fetchBrevoContactDetail(email) {
  if (!BREVO_API_KEY) return { email, name: email, exists: false };

  try {
    const res = await fetchWithTimeout(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      { headers: { accept: 'application/json', 'api-key': BREVO_API_KEY } },
      8000
    );

    if (!res.ok) {
      if (res.status === 404) return { email, name: email, exists: false };
      throw new Error(`Brevo API error: ${res.status}`);
    }

    const data = await res.json();
    const a = data.attributes || {};

    return {
      email: data.email,
      name: `${a.FIRSTNAME || ''} ${a.LASTNAME || ''}`.trim() || data.email,
      firstName: a.FIRSTNAME || '',
      lastName: a.LASTNAME || '',
      organization: a.ORGANIZATION_NAME || '',
      jobTitle: a.JOB_TITLE || '',
      phone: a.PHONE_MOBILE || a.PHONE_OFFICE || a.SMS || '',
      phoneOffice: a.PHONE_OFFICE || '',
      phoneMobile: a.PHONE_MOBILE || '',
      phoneExtension: a.PHONE_EXTENSION || '',
      landline: a.LANDLINE_NUMBER || '',
      whatsapp: a.WHATSAPP || a.WHATSAPP1 || '',
      linkedin: a.LINKEDIN || '',
      city: a.CITY || '',
      state: a.STATE_PROVINCE || '',
      country: a.COUNTRY_REGION || '',
      zipCode: a.ZIP_OR_POSTAL_CODE || '',
      county: a.COUNTY || '',
      organizationType: a.ORGANIZATION_TYPE || '',
      organizationSize: a.ORGANIZATION_SIZE || '',
      organizationAddress: a.ORGANIZATION_STREET_ADDRESS || '',
      webinarId: a.WEBINAR_ID || '',
      webinarUuid: a.WEBINAR_UUID || '',
      webinarTopic: a.WEBINAR_TOPIC || '',
      webinarStartTime: a.WEBINAR_START_TIME || '',
      webinarsAttendedCount: parseInt(a.WEBINARS_ATTENDED_COUNT || '0', 10),
      attendedWebinar: a.ATTENDED_WEBINAR || 'No',
      surveyContact: a.WEB_CONTACT_REQ || 'No',
      sourcedFrom: a.SOURCED_FROM || '',
      customTag: a.CUSTOM_TAG || '',
      areasOfInterest: a.AREAS_OF_INTEREST || '',
      notes: a.NOTES || '',
      tags: a.TAGS || [],
      lists: data.listIds || [],
      emailBlacklisted: data.emailBlacklisted || false,
      smsBlacklisted: data.smsBlacklisted || false,
      createdAt: data.createdAt,
      modifiedAt: data.modifiedAt,
      lastChanged: a.LAST_CHANGED || data.modifiedAt,
      initialContactTime: a.INITIAL_CONTACT_TIME || '',
      registrationTime: a.REGISTRATION_TIME || '',
      attributes: a,
      exists: true,
    };
  } catch (err) {
    console.error('[ContactDetail] Brevo fetch failed:', err.message);
    return { email, name: email, exists: false };
  }
}

// ── All Google Sheet data in two parallel batchGets ──────────────────────────
async function fetchAllSheetData(email) {
  const credentials = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const lc = email.toLowerCase();

  const [webinarResult, crmResult] = await Promise.all([
    WEBINAR_SHEET_ID
      ? sheets.spreadsheets.values.batchGet({
          spreadsheetId: WEBINAR_SHEET_ID,
          ranges: [
            'Registrations!A2:F',
            'Attendance!A2:G',
            'Webinars!A2:L',
            'Survey_Responses!A2:Z',
          ],
        }).catch(err => { console.warn('[ContactDetail] Webinar batchGet failed:', err.message); return null; })
      : Promise.resolve(null),

    CRM_SHEET_ID
      ? sheets.spreadsheets.values.batchGet({
          spreadsheetId: CRM_SHEET_ID,
          ranges: ['ContactNotes!A2:F', 'FollowUpTasks!A2:G'],
        }).catch(err => { console.warn('[ContactDetail] CRM batchGet failed:', err.message); return null; })
      : Promise.resolve(null),
  ]);

  return {
    ...parseWebinarSheetData(webinarResult, lc),
    ...parseCrmSheetData(crmResult, lc),
  };
}

function parseWebinarSheetData(batchRes, emailLc) {
  if (!batchRes) return { webinarHistory: [], surveyResponses: [] };

  const [regRows, attRows, webRows, surveyRows] = batchRes.data.valueRanges.map(
    r => r.values || []
  );

  // Build webinar lookup by ID
  const webinarMap = webRows.reduce((acc, row) => {
    if (row[0]) acc[row[0]] = { id: row[0], title: row[1] || '', date: row[2] || '', time: row[3] || '' };
    return acc;
  }, {});

  // Attendance lookup by webinarId for this contact
  const attendedIds = new Set(
    attRows
      .filter(r => (r[2] || '').toLowerCase() === emailLc)
      .map(r => r[0])
  );
  const attendanceByWebinar = attRows
    .filter(r => (r[2] || '').toLowerCase() === emailLc)
    .reduce((acc, r) => {
      acc[r[0]] = { joinTime: r[3] || '', leaveTime: r[4] || '', duration: r[5] || '' };
      return acc;
    }, {});

  const webinarHistory = regRows
    .filter(r => (r[3] || '').toLowerCase() === emailLc)
    .map(r => {
      const wid = r[1] || '';
      const webinar = webinarMap[wid] || {};
      const att = attendanceByWebinar[wid];
      return {
        webinarId: wid,
        webinarTitle: webinar.title || 'Unknown Webinar',
        webinarDate: webinar.date || '',
        webinarTime: webinar.time || '',
        registered: true,
        attended: attendedIds.has(wid),
        registrationDate: r[0] || '',
        joinTime: att?.joinTime || null,
        duration: att?.duration || null,
      };
    })
    .sort((a, b) => new Date(b.webinarDate) - new Date(a.webinarDate));

  const surveyResponses = surveyRows
    .filter(r => (r[1] || '').toLowerCase() === emailLc)
    .map(r => ({
      timestamp: r[0] || '',
      email: r[1] || '',
      webinarId: r[2] || '',
      relevance: r[3] || '',
      presenters: r[4] || '',
      recommend: r[5] || '',
      relevantTo: r[6] || '',
      challenges: r[7] || '',
      additionalTopics: r[8] || '',
      contactMe: r[9] || 'No',
    }));

  return { webinarHistory, surveyResponses };
}

function parseCrmSheetData(batchRes, emailLc) {
  if (!batchRes) return { notes: [], tasks: [] };

  const [noteRows, taskRows] = batchRes.data.valueRanges.map(r => r.values || []);

  const notes = noteRows
    .filter(r => (r[1] || '').toLowerCase() === emailLc)
    .map(r => ({
      timestamp: r[0] || '',
      email: r[1] || '',
      noteType: r[2] || '',
      note: r[3] || '',
      createdBy: r[4] || '',
      followUpDate: r[5] || '',
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const tasks = taskRows
    .filter(r => (r[1] || '').toLowerCase() === emailLc)
    .map(r => ({
      taskId: r[0] || '',
      email: r[1] || '',
      contactName: r[2] || '',
      task: r[3] || '',
      dueDate: r[4] || '',
      status: r[5] || 'Open',
      createdDate: r[6] || '',
    }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return { notes, tasks };
}
