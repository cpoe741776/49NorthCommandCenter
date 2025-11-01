// netlify/functions/getContacts.js
// Fetches unified contact list from Brevo + enriches with Google Sheets data

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
    const limit = parseInt(url.searchParams.get('limit') || '100', 10); // Default 100 for searches
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const filter = url.searchParams.get('filter') || ''; // 'hot-leads', 'webinar-attendees', etc.
    const search = url.searchParams.get('search') || '';
    const summaryOnly = url.searchParams.get('summaryOnly') === 'true';
    
    // New: Dedicated search fields
    const searchFirstName = url.searchParams.get('firstName') || '';
    const searchLastName = url.searchParams.get('lastName') || '';
    const searchEmail = url.searchParams.get('email') || '';
    const searchOrganization = url.searchParams.get('organization') || '';
    const searchState = url.searchParams.get('state') || '';
    const searchCountry = url.searchParams.get('country') || '';
    const searchCustomTag = url.searchParams.get('customTag') || '';
    
    // Segment/List loading
    const segmentId = url.searchParams.get('segmentId') || '';

    // If summaryOnly, just fetch and return summary stats
    if (summaryOnly || (limit === 0)) {
      console.log('[Contacts] Fetching summary only...');
      const globalStats = await calculateGlobalStats();
      const followUps = await fetchFollowUpTasks();
      const summary = {
        totalContacts: globalStats.totalContacts || 0,
        hotLeads: globalStats.hotLeads || 0,
        webinarAttendees: globalStats.webinarAttendees || 0,
        pendingFollowUps: followUps.filter(t => t.status === 'Open').length,
        coldContacts: globalStats.coldContacts || 0,
        warmLeads: globalStats.warmLeads || 0,
        showing: 0,
        fromPage: 0,
        estimated: globalStats.estimated || false,
        sampleSize: globalStats.sampleSize || 0
      };
      return ok(headers, { success: true, contacts: [], summary });
    }

    // Check cache (only for unfiltered requests)
    const nowMs = Date.now();
    if (!filter && !search && !searchFirstName && !searchLastName && !searchEmail && 
        !searchOrganization && !searchState && !searchCountry && !searchCustomTag && !segmentId && cache && (nowMs - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Contacts] Returning cached data');
      return ok(headers, { ...cache, cached: true });
    }

    console.log('[Contacts] Fetching fresh data with params:', {
      limit, offset, filter, 
      searchFirstName, searchLastName, searchEmail, 
      searchOrganization, searchState, searchCountry, searchCustomTag,
      segmentId
    });

    // Fetch contacts from Brevo (with optional filtering, search, and segment)
    const brevoData = await fetchBrevoContacts(limit, offset, filter, searchFirstName, searchLastName, searchEmail, searchOrganization, searchState, searchCountry, searchCustomTag, segmentId);
    const brevoContacts = brevoData.contacts;
    const brevoTotal = brevoData.count; // Total count from Brevo API
    const filteredTotal = brevoData.filteredCount || brevoTotal; // Count after Brevo-level filtering

    // Fetch metadata from Google Sheets
    const metadata = await fetchContactMetadata();
    const notes = await fetchContactNotes();
    const followUps = await fetchFollowUpTasks();

    // Enrich Brevo contacts with CRM sheet data (notes, tasks, lead scoring)
    const enrichedContacts = brevoContacts.map(contact => {
      const meta = metadata.find(m => m.email.toLowerCase() === contact.email.toLowerCase());
      const contactNotes = notes.filter(n => n.email.toLowerCase() === contact.email.toLowerCase());
      const contactTasks = followUps.filter(t => t.email.toLowerCase() === contact.email.toLowerCase() && t.status === 'Open');

      // Calculate lead status based on Brevo data (matching getWebinarAnalysis logic)
      let leadStatus = 'Cold';
      const webinarCount = contact.webinarsAttendedCount || 0;
      const isSurveyContact = contact.surveyContact === 'Yes';
      const requestedContact = contact.surveyContact === 'Yes'; // WEB_CONTACT_REQ field
      
      // Hot Lead: Requested contact OR 2+ webinars
      if (requestedContact || webinarCount >= 2) {
        leadStatus = 'Hot Lead';
      } 
      // Warm Lead: 1 webinar OR attended any webinar
      else if (webinarCount >= 1 || contact.attendedWebinar === 'Yes') {
        leadStatus = 'Warm';
      }

      // Calculate lead score (matching getWebinarAnalysis scoring)
      let leadScore = 0;
      if (requestedContact) leadScore += 100; // Contact request is highest priority
      if (webinarCount >= 3) leadScore += 15 + (30 * (webinarCount - 1)); // 15 for first, 30 each after
      else if (webinarCount === 2) leadScore += 45; // 15 + 30
      else if (webinarCount === 1) leadScore += 15;
      if (isSurveyContact) leadScore += 25; // Survey completion bonus
      if (contact.attendedWebinar === 'Yes') leadScore += 10; // Attendance bonus
      leadScore += contactNotes.length * 5; // 5 points per note
      leadScore = Math.min(200, leadScore); // Cap at 200 to match backend

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
      filtered = enrichedContacts.filter(c => c.leadStatus === 'Hot Lead');
    } else if (filter === 'webinar-attendees') {
      filtered = enrichedContacts.filter(c => (c.webinarsAttendedCount || 0) > 0 || c.attendedWebinar === 'Yes');
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

    // Calculate summary stats from ALL contacts in Brevo (not just this page)
    const globalStats = await calculateGlobalStats();
    
    const summary = {
      totalContacts: brevoTotal, // Actual total from Brevo
      hotLeads: globalStats.hotLeads,
      webinarAttendees: globalStats.webinarAttendees,
      pendingFollowUps: followUps.filter(t => t.status === 'Open').length,
      coldContacts: globalStats.coldContacts,
      warmLeads: globalStats.warmLeads,
      showing: filtered.slice(0, limit).length, // How many we're displaying on current page
      fromPage: enrichedContacts.length // How many contacts on this page
    };

    const response = {
      success: true,
      contacts: filtered.slice(0, limit),
      total: filtered.length,
      summary,
      timestamp: new Date().toISOString()
    };

    // Cache if no filters or search or segment
    if (!filter && !search && !searchFirstName && !searchLastName && !searchEmail && 
        !searchOrganization && !searchState && !searchCountry && !searchCustomTag && !segmentId) {
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

async function fetchBrevoContacts(limit, offset, filter = '', searchFirstName = '', searchLastName = '', searchEmail = '', searchOrganization = '', searchState = '', searchCountry = '', searchCustomTag = '', segmentId = '') {
  if (!BREVO_API_KEY) {
    console.warn('[Contacts] BREVO_API_KEY not set');
    return { contacts: [], count: 0, filteredCount: 0 };
  }

  try {
    // For field-specific search, fetch multiple batches of 1000 (Brevo's max per request)
    let fetchLimit = limit;
    let multiPageSearch = false;
    
    if (searchFirstName || searchLastName || searchEmail || searchOrganization || searchState || searchCountry || searchCustomTag) {
      fetchLimit = 1000; // Brevo's hard limit per request
      multiPageSearch = true;
      console.log('[Contacts] Search mode: Will fetch multiple pages of 1000 to find matches');
    }
    
    // Build Brevo API URL with optional filtering
    let url;
    
    // Segments use a different API endpoint than lists
    if (segmentId) {
      // Try segment-specific endpoint first
      url = `https://api.brevo.com/v3/contacts/segments/${segmentId}/contacts?limit=${fetchLimit}&offset=${offset}`;
      console.log('[Contacts] Fetching contacts from segment ID:', segmentId, 'using segment-specific endpoint');
    } else {
      url = `https://api.brevo.com/v3/contacts?limit=${fetchLimit}&offset=${offset}`;
    }
    
    // Note: Brevo's contact filtering is limited. We'll handle most filtering client-side,
    // but we can use modifiedSince or listIds if needed for performance
    
    let res = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });
    
    // If segment endpoint fails, fall back to listIds filter
    if (!res.ok && segmentId) {
      console.log('[Contacts] Segment endpoint failed with', res.status, '- trying listIds fallback');
      url = `https://api.brevo.com/v3/contacts?limit=${fetchLimit}&offset=${offset}&listIds=${segmentId}`;
      res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY
        }
      });
      
      if (!res.ok) {
        console.error('[Contacts] Both segment endpoints failed:', res.status);
        return { contacts: [], count: 0, filteredCount: 0 };
      }
      
      console.log('[Contacts] Fallback (listIds) succeeded');
    }

    if (!res.ok) {
      console.error('[Contacts] Brevo API error:', res.status);
      return { contacts: [], count: 0, filteredCount: 0 };
    }

    let data = await res.json();
    
    console.log('[Contacts] Brevo returned:', data.contacts?.length || 0, 'contacts. Total in Brevo:', data.count || 0);
    
    let allContacts = data.contacts || [];
    
    // If searching and we need more results, fetch additional pages
    if (multiPageSearch && allContacts.length >= 1000) {
      const totalInBrevo = data.count || 0;
      const maxPages = Math.min(15, Math.ceil(totalInBrevo / 1000)); // Fetch up to 15 pages (15,000 contacts ~50% of database)
      
      console.log('[Contacts] Multi-page search: Fetching up to', maxPages, 'pages to search', totalInBrevo, 'total contacts');
      
      for (let page = 1; page < maxPages; page++) {
        const pageOffset = page * 1000;
        const pageUrl = `https://api.brevo.com/v3/contacts?limit=1000&offset=${pageOffset}`;
        
        const pageRes = await fetch(pageUrl, {
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY
          }
        });
        
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          allContacts = allContacts.concat(pageData.contacts || []);
          console.log('[Contacts] Fetched page', page + 1, '- Total contacts:', allContacts.length);
        }
      }
      
      console.log('[Contacts] Multi-page fetch complete. Total fetched:', allContacts.length);
    }
    
    // Map Brevo contacts to our format (using existing Brevo fields)
    let contacts = allContacts.map(c => ({
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
    
    // Apply field-specific search filtering
    if (searchFirstName || searchLastName || searchEmail || searchOrganization || searchState || searchCountry || searchCustomTag) {
      const beforeFilterCount = contacts.length;
      console.log('[Contacts] Before filtering:', beforeFilterCount, 'contacts');
      console.log('[Contacts] Search criteria:', { searchFirstName, searchLastName, searchEmail, searchOrganization, searchState, searchCountry, searchCustomTag });
      
      contacts = contacts.filter(c => {
        let matches = true;
        
        if (searchFirstName) {
          const firstNameLower = (c.firstName || '').toLowerCase();
          const searchLower = searchFirstName.toLowerCase();
          matches = matches && firstNameLower.includes(searchLower);
        }
        
        if (searchLastName) {
          const lastNameLower = (c.lastName || '').toLowerCase();
          const searchLower = searchLastName.toLowerCase();
          matches = matches && lastNameLower.includes(searchLower);
        }
        
        if (searchEmail) {
          const emailLower = (c.email || '').toLowerCase();
          const searchLower = searchEmail.toLowerCase();
          matches = matches && emailLower.includes(searchLower);
        }
        
        if (searchOrganization) {
          const orgLower = (c.organization || '').toLowerCase();
          const searchLower = searchOrganization.toLowerCase();
          matches = matches && orgLower.includes(searchLower);
        }
        
        if (searchState) {
          const stateLower = (c.state || '').toLowerCase();
          const searchLower = searchState.toLowerCase();
          matches = matches && stateLower.includes(searchLower);
        }
        
        if (searchCountry) {
          const countryLower = (c.country || '').toLowerCase();
          const searchLower = searchCountry.toLowerCase();
          matches = matches && countryLower.includes(searchLower);
        }
        
        if (searchCustomTag) {
          const customTag = (c.customTag || '').toLowerCase();
          const searchLower = searchCustomTag.toLowerCase();
          // Support both exact match and comma-separated tags
          matches = matches && (customTag === searchLower || customTag.includes(searchLower));
        }
        
        return matches;
      });
      
      console.log('[Contacts] After field search filtering:', contacts.length, 'contacts match criteria');
      
      // Limit results after filtering
      contacts = contacts.slice(0, limit);
    }
    
    return {
      contacts,
      count: data.count || 0, // Total count in Brevo
      filteredCount: contacts.length // After our filtering
    };
  } catch (err) {
    console.error('[Contacts] Brevo fetch failed:', err.message);
    return { contacts: [], count: 0, filteredCount: 0 };
  }
}

// Calculate global statistics across ALL contacts in Brevo
async function calculateGlobalStats() {
  if (!BREVO_API_KEY) {
    return { hotLeads: 0, webinarAttendees: 0, coldContacts: 0, warmLeads: 0 };
  }

  try {
    // Fetch multiple pages to get accurate stats (Brevo max 1000 per request)
    // Fetch up to 5 pages (5000 contacts) to calculate stats
    // This is cached, so it won't run on every request
    let allContacts = [];
    let totalInBrevo = 0;
    const maxPages = 5;
    
    for (let page = 0; page < maxPages; page++) {
      const res = await fetch(`https://api.brevo.com/v3/contacts?limit=1000&offset=${page * 1000}`, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY
        }
      });

      if (!res.ok) {
        console.warn('[Contacts] Failed to fetch global stats page', page + 1);
        break;
      }

      const data = await res.json();
      if (page === 0) {
        totalInBrevo = data.count || 0; // Get total from first response
      }
      allContacts = allContacts.concat(data.contacts || []);
      
      // Stop if we got less than 1000 (reached end of contacts)
      if ((data.contacts || []).length < 1000) break;
    }

    if (allContacts.length === 0) {
      console.warn('[Contacts] No contacts fetched for global stats');
      return { hotLeads: 0, webinarAttendees: 0, coldContacts: 0, warmLeads: 0, totalContacts: 0 };
    }

    const contacts = allContacts;

    let hotLeads = 0;
    let webinarAttendees = 0;
    let coldContacts = 0;
    let warmLeads = 0;

    contacts.forEach(c => {
      const webinarCount = parseInt(c.attributes?.WEBINARS_ATTENDED_COUNT || '0', 10);
      const isSurveyContact = c.attributes?.WEB_CONTACT_REQ === 'Yes';
      const attendedWebinar = c.attributes?.ATTENDED_WEBINAR === 'Yes';

      if (webinarCount > 0 || attendedWebinar) {
        webinarAttendees++;
      }

      if (isSurveyContact || webinarCount >= 2) {
        hotLeads++;
      } else if (webinarCount >= 1 || attendedWebinar) {
        warmLeads++;
      } else {
        coldContacts++;
      }
    });

    console.log('[Contacts] Global stats calculated from', contacts.length, 'contacts:', {
      hotLeads,
      webinarAttendees,
      coldContacts,
      warmLeads
    });

    // If we have 28K+ contacts but only sampled 5K, extrapolate
    const totalContacts = totalInBrevo || contacts.length;
    if (totalContacts > contacts.length) {
      const ratio = totalContacts / contacts.length;
      return {
        hotLeads: Math.round(hotLeads * ratio),
        webinarAttendees: Math.round(webinarAttendees * ratio),
        coldContacts: Math.round(coldContacts * ratio),
        warmLeads: Math.round(warmLeads * ratio),
        totalContacts,
        estimated: true,
        sampleSize: contacts.length
      };
    }

    return { 
      hotLeads, 
      webinarAttendees, 
      coldContacts, 
      warmLeads, 
      totalContacts,
      estimated: false,
      sampleSize: contacts.length
    };
  } catch (err) {
    console.error('[Contacts] Global stats calculation failed:', err.message);
    return { hotLeads: 0, webinarAttendees: 0, coldContacts: 0, warmLeads: 0, totalContacts: 0 };
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

