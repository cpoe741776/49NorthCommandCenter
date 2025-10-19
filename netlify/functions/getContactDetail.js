// netlify/functions/getContactDetail.js
// Fetches detailed contact information including full activity history

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
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

    if (!email) {
      return ok(headers, { success: false, error: 'Email parameter required' });
    }

    console.log('[ContactDetail] Fetching details for:', email);

    // Fetch from Brevo
    const brevoContact = await fetchBrevoContactDetail(email);
    
    // Fetch webinar history
    const webinarHistory = await fetchWebinarHistory(email);
    
    // Fetch survey responses
    const surveyResponses = await fetchSurveyResponses(email);
    
    // Fetch notes
    const notes = await fetchNotesForContact(email);
    
    // Fetch follow-up tasks
    const tasks = await fetchTasksForContact(email);

    // Fetch email activity from Brevo
    const emailActivity = await fetchBrevoEmailActivity(email);

    return ok(headers, {
      success: true,
      contact: brevoContact,
      webinarHistory,
      surveyResponses,
      notes,
      tasks,
      emailActivity,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[ContactDetail] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

async function fetchBrevoContactDetail(email) {
  if (!BREVO_API_KEY) {
    return { email, name: email, exists: false };
  }

  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { email, name: email, exists: false };
      }
      throw new Error(`Brevo API error: ${res.status}`);
    }

    const data = await res.json();
    
    console.log('[ContactDetail] Brevo raw data for', email, ':', {
      email: data.email,
      attributeKeys: Object.keys(data.attributes || {}),
      FIRSTNAME: data.attributes?.FIRSTNAME,
      LASTNAME: data.attributes?.LASTNAME,
      ORGANIZATION_NAME: data.attributes?.ORGANIZATION_NAME,
      JOB_TITLE: data.attributes?.JOB_TITLE
    });
    
    return {
      email: data.email,
      name: `${data.attributes?.FIRSTNAME || ''} ${data.attributes?.LASTNAME || ''}`.trim() || data.email,
      firstName: data.attributes?.FIRSTNAME || '',
      lastName: data.attributes?.LASTNAME || '',
      organization: data.attributes?.ORGANIZATION_NAME || '',
      jobTitle: data.attributes?.JOB_TITLE || '',
      phone: data.attributes?.PHONE_MOBILE || data.attributes?.PHONE_OFFICE || data.attributes?.SMS || '',
      phoneOffice: data.attributes?.PHONE_OFFICE || '',
      phoneMobile: data.attributes?.PHONE_MOBILE || '',
      phoneExtension: data.attributes?.PHONE_EXTENSION || '',
      landline: data.attributes?.LANDLINE_NUMBER || '',
      whatsapp: data.attributes?.WHATSAPP || data.attributes?.WHATSAPP1 || '',
      linkedin: data.attributes?.LINKEDIN || '',
      city: data.attributes?.CITY || '',
      state: data.attributes?.STATE_PROVINCE || '',
      country: data.attributes?.COUNTRY_REGION || '',
      zipCode: data.attributes?.ZIP_OR_POSTAL_CODE || '',
      county: data.attributes?.COUNTY || '',
      organizationType: data.attributes?.ORGANIZATION_TYPE || '',
      organizationSize: data.attributes?.ORGANIZATION_SIZE || '',
      organizationAddress: data.attributes?.ORGANIZATION_STREET_ADDRESS || '',
      webinarId: data.attributes?.WEBINAR_ID || '',
      webinarUuid: data.attributes?.WEBINAR_UUID || '',
      webinarTopic: data.attributes?.WEBINAR_TOPIC || '',
      webinarStartTime: data.attributes?.WEBINAR_START_TIME || '',
      webinarsAttendedCount: parseInt(data.attributes?.WEBINARS_ATTENDED_COUNT || '0', 10),
      attendedWebinar: data.attributes?.ATTENDED_WEBINAR || 'No',
      surveyContact: data.attributes?.WEB_CONTACT_REQ || 'No',
      sourcedFrom: data.attributes?.SOURCED_FROM || '',
      customTag: data.attributes?.CUSTOM_TAG || '',
      areasOfInterest: data.attributes?.AREAS_OF_INTEREST || '',
      tags: data.attributes?.TAGS || [],
      lists: data.listIds || [],
      emailBlacklisted: data.emailBlacklisted || false,
      smsBlacklisted: data.smsBlacklisted || false,
      createdAt: data.createdAt,
      modifiedAt: data.modifiedAt,
      lastChanged: data.attributes?.LAST_CHANGED || data.modifiedAt,
      initialContactTime: data.attributes?.INITIAL_CONTACT_TIME || '',
      registrationTime: data.attributes?.REGISTRATION_TIME || '',
      attributes: data.attributes || {},
      exists: true
    };
  } catch (err) {
    console.error('[ContactDetail] Brevo fetch failed:', err.message);
    return { email, name: email, exists: false };
  }
}

async function fetchWebinarHistory(email) {
  if (!WEBINAR_SHEET_ID) return [];

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch registrations
    const regRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Registrations!A2:F'
    });

    const registrations = (regRes.data.values || [])
      .filter(row => (row[3] || '').toLowerCase() === email.toLowerCase())
      .map(row => ({
        timestamp: row[0] || '',
        webinarId: row[1] || '',
        name: row[2] || '',
        email: row[3] || '',
        organization: row[4] || '',
        phone: row[5] || '',
        type: 'registration'
      }));

    // Fetch attendance
    const attRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Attendance!A2:G'
    });

    const attendance = (attRes.data.values || [])
      .filter(row => (row[2] || '').toLowerCase() === email.toLowerCase())
      .map(row => ({
        webinarId: row[0] || '',
        participantName: row[1] || '',
        participantEmail: row[2] || '',
        joinTime: row[3] || '',
        leaveTime: row[4] || '',
        duration: row[5] || '',
        attended: row[6] || 'Yes',
        type: 'attendance'
      }));

    // Fetch webinar details to get titles
    const webRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Webinars!A2:L'
    });

    const webinars = (webRes.data.values || []).reduce((acc, row) => {
      acc[row[0]] = { id: row[0], title: row[1], date: row[2], time: row[3] };
      return acc;
    }, {});

    // Combine and enrich
    const history = [];
    
    registrations.forEach(reg => {
      const webinar = webinars[reg.webinarId] || {};
      const attended = attendance.find(a => a.webinarId === reg.webinarId);
      
      history.push({
        webinarId: reg.webinarId,
        webinarTitle: webinar.title || 'Unknown Webinar',
        webinarDate: webinar.date || '',
        webinarTime: webinar.time || '',
        registered: true,
        attended: !!attended,
        registrationDate: reg.timestamp,
        joinTime: attended?.joinTime || null,
        duration: attended?.duration || null
      });
    });

    return history.sort((a, b) => new Date(b.webinarDate) - new Date(a.webinarDate));
  } catch (err) {
    console.error('[ContactDetail] Webinar history failed:', err.message);
    return [];
  }
}

async function fetchSurveyResponses(email) {
  if (!WEBINAR_SHEET_ID) return [];

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Survey_Responses!A2:Z'
    });

    const rows = (res.data.values || [])
      .filter(row => (row[1] || '').toLowerCase() === email.toLowerCase());

    return rows.map(row => ({
      timestamp: row[0] || '',
      email: row[1] || '',
      webinarId: row[2] || '',
      relevance: row[3] || '',
      presenters: row[4] || '',
      recommend: row[5] || '',
      relevantTo: row[6] || '',
      challenges: row[7] || '',
      additionalTopics: row[8] || '',
      contactMe: row[9] || 'No'
    }));
  } catch (err) {
    console.error('[ContactDetail] Survey fetch failed:', err.message);
    return [];
  }
}

async function fetchNotesForContact(email) {
  if (!CRM_SHEET_ID) return [];

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CRM_SHEET_ID,
      range: 'ContactNotes!A2:F'
    });

    const rows = (res.data.values || [])
      .filter(row => (row[1] || '').toLowerCase() === email.toLowerCase());

    return rows.map(row => ({
      timestamp: row[0] || '',
      email: row[1] || '',
      noteType: row[2] || '',
      note: row[3] || '',
      createdBy: row[4] || '',
      followUpDate: row[5] || ''
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (err) {
    console.error('[ContactDetail] Notes fetch failed:', err.message);
    return [];
  }
}

async function fetchTasksForContact(email) {
  if (!CRM_SHEET_ID) return [];

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CRM_SHEET_ID,
      range: 'FollowUpTasks!A2:G'
    });

    const rows = (res.data.values || [])
      .filter(row => (row[1] || '').toLowerCase() === email.toLowerCase());

    return rows.map(row => ({
      taskId: row[0] || '',
      email: row[1] || '',
      contactName: row[2] || '',
      task: row[3] || '',
      dueDate: row[4] || '',
      status: row[5] || 'Open',
      createdDate: row[6] || ''
    })).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  } catch (err) {
    console.error('[ContactDetail] Tasks fetch failed:', err.message);
    return [];
  }
}

async function fetchBrevoEmailActivity(email) {
  // Note: Brevo's campaign stats API is complex and requires campaign IDs
  // For MVP, we'll return placeholder. Can enhance later with actual API calls.
  return [];
}

