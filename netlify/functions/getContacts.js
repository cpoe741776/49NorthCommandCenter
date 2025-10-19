// netlify/functions/getContacts.js
// Fetches unified contact list from Brevo + enriches with Google Sheets data

const fetch = require('node-fetch');
const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const CRM_SHEET_ID = process.env.CRM_SHEET_ID;
const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;

// In-memory cache (5 minute TTL)
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    // Parse query params
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const filter = url.searchParams.get('filter') || ''; // 'hot-leads', 'webinar-attendees', etc.
    const search = url.searchParams.get('search') || '';

    // Check cache (only for unfiltered requests)
    const nowMs = Date.now();
    if (!filter && !search && cache && (nowMs - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Contacts] Returning cached data');
      return ok(headers, { ...cache, cached: true });
    }

    console.log('[Contacts] Fetching fresh data...');

    // Fetch contacts from Brevo
    const brevoContacts = await fetchBrevoContacts(limit, offset);

    // Fetch metadata from Google Sheets
    const metadata = await fetchContactMetadata();
    const notes = await fetchContactNotes();
    const followUps = await fetchFollowUpTasks();

    // Enrich Brevo contacts with CRM sheet data (notes, tasks, lead scoring)
    const enrichedContacts = brevoContacts.map(contact => {
      const meta = metadata.find(m => m.email.toLowerCase() === contact.email.toLowerCase());
      const contactNotes = notes.filter(n => n.email.toLowerCase() === contact.email.toLowerCase());
      const contactTasks = followUps.filter(t => t.email.toLowerCase() === contact.email.toLowerCase() && t.status === 'Open');

      // Calculate lead status based on Brevo data
      let leadStatus = 'Cold';
      const webinarCount = contact.webinarsAttendedCount || 0;
      const isSurveyContact = contact.surveyContact === 'Yes';
      
      if (isSurveyContact || webinarCount >= 2) {
        leadStatus = 'Hot Lead';
      } else if (webinarCount >= 1 || contact.attendedWebinar === 'Yes') {
        leadStatus = 'Warm';
      }

      // Calculate lead score (0-100)
      let leadScore = 0;
      leadScore += webinarCount * 15; // 15 points per webinar
      leadScore += isSurveyContact ? 30 : 0; // 30 points for survey contact
      leadScore += contact.attendedWebinar === 'Yes' ? 20 : 0; // 20 points for attendance
      leadScore += contactNotes.length * 5; // 5 points per note
      leadScore = Math.min(100, leadScore); // Cap at 100

      return {
        ...contact,
        leadScore: meta?.leadScore || leadScore,
        leadStatus: meta?.leadStatus || leadStatus,
        notesCount: contactNotes.length,
        pendingTasks: contactTasks.length,
        hasOpenTasks: contactTasks.length > 0
      };
    });

    // Apply filters
    let filtered = enrichedContacts;
    if (filter === 'hot-leads') {
      filtered = enrichedContacts.filter(c => c.leadStatus === 'Hot Lead' || c.surveyContact);
    } else if (filter === 'webinar-attendees') {
      filtered = enrichedContacts.filter(c => c.webinarCount > 0);
    } else if (filter === 'cold-leads') {
      filtered = enrichedContacts.filter(c => c.leadStatus === 'Cold');
    }

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c => 
        (c.email || '').toLowerCase().includes(searchLower) ||
        (c.name || '').toLowerCase().includes(searchLower) ||
        (c.organization || '').toLowerCase().includes(searchLower)
      );
    }

    // Calculate summary
    const summary = {
      totalContacts: enrichedContacts.length,
      hotLeads: enrichedContacts.filter(c => c.leadStatus === 'Hot Lead' || c.surveyContact).length,
      webinarAttendees: enrichedContacts.filter(c => c.webinarCount > 0).length,
      pendingFollowUps: followUps.filter(t => t.status === 'Open').length,
      coldContacts: enrichedContacts.filter(c => c.leadStatus === 'Cold').length
    };

    const response = {
      success: true,
      contacts: filtered.slice(0, limit),
      total: filtered.length,
      summary,
      timestamp: new Date().toISOString()
    };

    // Cache if no filters
    if (!filter && !search) {
      cache = response;
      cacheTimestamp = nowMs;
      console.log('[Contacts] Data cached for 5 minutes');
    }

    return ok(headers, response);

  } catch (err) {
    console.error('[Contacts] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

async function fetchBrevoContacts(limit, offset) {
  if (!BREVO_API_KEY) {
    console.warn('[Contacts] BREVO_API_KEY not set');
    return [];
  }

  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}`, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    if (!res.ok) {
      console.error('[Contacts] Brevo API error:', res.status);
      return [];
    }

    const data = await res.json();
    
    // Map Brevo contacts to our format (using existing Brevo fields)
    return (data.contacts || []).map(c => ({
      email: c.email,
      name: `${c.attributes?.FIRSTNAME || ''} ${c.attributes?.LASTNAME || ''}`.trim() || c.email,
      firstName: c.attributes?.FIRSTNAME || '',
      lastName: c.attributes?.LASTNAME || '',
      organization: c.attributes?.ORGANIZATION_NAME || '',
      jobTitle: c.attributes?.JOB_TITLE || '',
      phone: c.attributes?.PHONE_MOBILE || c.attributes?.PHONE_OFFICE || c.attributes?.SMS || '',
      phoneOffice: c.attributes?.PHONE_OFFICE || '',
      phoneMobile: c.attributes?.PHONE_MOBILE || '',
      city: c.attributes?.CITY || '',
      state: c.attributes?.STATE_PROVINCE || '',
      country: c.attributes?.COUNTRY_REGION || '',
      organizationType: c.attributes?.ORGANIZATION_TYPE || '',
      webinarId: c.attributes?.WEBINAR_ID || '',
      webinarTopic: c.attributes?.WEBINAR_TOPIC || '',
      webinarsAttendedCount: parseInt(c.attributes?.WEBINARS_ATTENDED_COUNT || '0', 10),
      attendedWebinar: c.attributes?.ATTENDED_WEBINAR || 'No',
      surveyContact: c.attributes?.WEB_CONTACT_REQ || 'No',
      sourcedFrom: c.attributes?.SOURCED_FROM || '',
      customTag: c.attributes?.CUSTOM_TAG || '',
      linkedin: c.attributes?.LINKEDIN || '',
      tags: c.attributes?.TAGS || [],
      lists: c.listIds || [],
      emailBlacklisted: c.emailBlacklisted || false,
      smsBlacklisted: c.smsBlacklisted || false,
      createdAt: c.createdAt,
      modifiedAt: c.modifiedAt,
      lastChanged: c.attributes?.LAST_CHANGED || c.modifiedAt,
      attributes: c.attributes || {}
    }));
  } catch (err) {
    console.error('[Contacts] Brevo fetch failed:', err.message);
    return [];
  }
}

async function fetchContactMetadata() {
  if (!CRM_SHEET_ID) {
    console.warn('[Contacts] CRM_SHEET_ID not set');
    return [];
  }

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CRM_SHEET_ID,
      range: 'ContactMetadata!A2:H'
    });

    const rows = res.data.values || [];
    return rows.map(row => ({
      email: row[0] || '',
      leadScore: parseInt(row[1] || '0', 10),
      leadStatus: row[2] || 'Cold',
      firstTouchDate: row[3] || '',
      lastActivityDate: row[4] || '',
      webinarCount: parseInt(row[5] || '0', 10),
      attendedCount: parseInt(row[6] || '0', 10),
      surveyContact: row[7] || 'No'
    }));
  } catch (err) {
    console.warn('[Contacts] Failed to fetch metadata:', err.message);
    return [];
  }
}

async function fetchContactNotes() {
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

    const rows = res.data.values || [];
    return rows.map(row => ({
      timestamp: row[0] || '',
      email: row[1] || '',
      noteType: row[2] || '',
      note: row[3] || '',
      createdBy: row[4] || '',
      followUpDate: row[5] || ''
    }));
  } catch (err) {
    console.warn('[Contacts] Failed to fetch notes:', err.message);
    return [];
  }
}

async function fetchFollowUpTasks() {
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

    const rows = res.data.values || [];
    return rows.map(row => ({
      taskId: row[0] || '',
      email: row[1] || '',
      contactName: row[2] || '',
      task: row[3] || '',
      dueDate: row[4] || '',
      status: row[5] || 'Open',
      createdDate: row[6] || ''
    }));
  } catch (err) {
    console.warn('[Contacts] Failed to fetch follow-ups:', err.message);
    return [];
  }
}

