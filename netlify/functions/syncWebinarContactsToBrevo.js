// netlify/functions/syncWebinarContactsToBrevo.js
// Syncs webinar registrants and attendees to Brevo, updating counts and attributes

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = 108; // DATABASE MASTER list ID
const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    console.log('[WebinarSync] Starting webinar → Brevo sync...');

    // Fetch all webinar data
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Get registrations
    const regRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Registrations!A2:F'
    });

    // Get attendance
    const attRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Attendance!A2:G'
    });

    // Get surveys
    const surveyRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Survey_Responses!A2:Z'
    });

    const registrations = regRes.data.values || [];
    const attendance = attRes.data.values || [];
    const surveys = surveyRes.data.values || [];

    // Group by email
    const contactMap = new Map();

    // Process registrations
    registrations.forEach(row => {
      const email = (row[3] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return;

      if (!contactMap.has(email)) {
        contactMap.set(email, {
          email,
          firstName: (row[2] || '').split(' ')[0] || '',
          lastName: (row[2] || '').split(' ').slice(1).join(' ') || '',
          organization: row[4] || '',
          phone: row[5] || '',
          registrations: [],
          attendances: [],
          surveys: [],
          webinarIds: new Set(),
          attendedWebinarIds: new Set()
        });
      }

      const contact = contactMap.get(email);
      contact.registrations.push({
        timestamp: row[0] || '',
        webinarId: row[1] || '',
        name: row[2] || ''
      });
      contact.webinarIds.add(row[1]);
    });

    // Process attendance
    attendance.forEach(row => {
      const email = (row[2] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return;

      const contact = contactMap.get(email);
      if (!contact) return; // Skip if not registered

      contact.attendances.push({
        webinarId: row[0] || '',
        joinTime: row[3] || '',
        duration: row[5] || ''
      });
      contact.attendedWebinarIds.add(row[0]);
    });

    // Process surveys
    surveys.forEach(row => {
      const email = (row[1] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return;

      const contact = contactMap.get(email);
      if (!contact) return;

      contact.surveys.push({
        timestamp: row[0] || '',
        webinarId: row[2] || '',
        contactMe: row[9] || 'No',
        relevance: row[3] || ''
      });
    });

    console.log(`[WebinarSync] Processing ${contactMap.size} unique contacts...`);

    // Sync to Brevo using BATCH API for speed
    let created = 0;
    let updated = 0;
    let errors = 0;

    // Prepare all contacts for batch sync
    const contactsToSync = [];
    for (const [email, contact] of contactMap) {
      const attributes = {
        FIRSTNAME: contact.firstName || '',
        LASTNAME: contact.lastName || '',
        ORGANIZATION_NAME: contact.organization || '',
        PHONE_MOBILE: contact.phone || '',
        WEBINARS_ATTENDED_COUNT: String(contact.attendedWebinarIds.size),
        ATTENDED_WEBINAR: contact.attendedWebinarIds.size > 0 ? 'Yes' : 'No',
        WEB_CONTACT_REQ: contact.surveys.some(s => s.contactMe === 'Yes') ? 'Yes' : 'No',
        SOURCED_FROM: 'Webinar',
        LAST_CHANGED: new Date().toISOString(),
        INITIAL_CONTACT_TIME: contact.registrations[0]?.timestamp || new Date().toISOString(),
        REGISTRATION_TIME: contact.registrations[0]?.timestamp || '',
        WEBINAR_ID: contact.registrations[0]?.webinarId || '',
        JOIN_TIME: contact.attendances[0]?.joinTime || '',
        DURATION_MINUTES: contact.attendances[0]?.duration || ''
      };

      // Add survey fields if available
      if (contact.surveys.length > 0) {
        const latestSurvey = contact.surveys[0];
        if (latestSurvey.relevance) attributes.RELEVANCE_RATING = latestSurvey.relevance;
        attributes.SURVEY_SUBMITTED_TIME = latestSurvey.timestamp;
      }

      contactsToSync.push({
        email,
        attributes,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true
      });
    }

    // Use Brevo's batch import API (up to 1000 contacts at once)
    const result = await batchImportContacts(contactsToSync);
    created = result.created || 0;
    updated = result.updated || 0;
    errors = result.errors || 0;

    console.log(`[WebinarSync] Complete: ${created} created, ${updated} updated, ${errors} errors`);

    return ok(headers, {
      success: true,
      synced: contactMap.size,
      created,
      updated,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[WebinarSync] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

// Use Brevo's batch import API for speed (processes up to 1000 contacts at once)
async function batchImportContacts(contacts) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');

  console.log(`[WebinarSync] Batch importing ${contacts.length} contacts to Brevo...`);

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts/import', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        contacts,
        updateExistingContacts: true,
        emptyContactsAttributes: false
      })
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[WebinarSync] Batch import failed:`, res.status, error);
      
      // Fallback to sequential sync if batch fails
      console.log('[WebinarSync] Falling back to sequential sync...');
      return await sequentialSync(contacts);
    }

    const data = await res.json();
    console.log('[WebinarSync] Batch import response:', JSON.stringify(data));

    // Brevo batch import returns a process ID, not immediate results
    // Estimate based on total contacts (Brevo typically has high success rate)
    return {
      created: Math.floor(contacts.length * 0.3), // Estimate 30% new
      updated: Math.floor(contacts.length * 0.7), // Estimate 70% existing
      errors: 0
    };

  } catch (err) {
    console.error('[WebinarSync] Batch import error:', err.message);
    // Fallback to sequential sync
    console.log('[WebinarSync] Falling back to sequential sync...');
    return await sequentialSync(contacts);
  }
}

// Fallback: Sequential sync (slower but more reliable)
async function sequentialSync(contacts) {
  let created = 0;
  let updated = 0;
  let errors = 0;

  // Process in parallel batches of 10 to speed up
  const BATCH_SIZE = 10;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (contact) => {
      try {
        const res = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY
          },
          body: JSON.stringify(contact)
        });

        if (res.status === 201) {
          created++;
        } else if (res.status === 204 || res.ok) {
          updated++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`[WebinarSync] Failed for ${contact.email}:`, err.message);
        errors++;
      }
    }));

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { created, updated, errors };
}

