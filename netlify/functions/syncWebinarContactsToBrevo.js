// netlify/functions/syncWebinarContactsToBrevo.js
// Syncs webinar registrants and attendees to Brevo, updating counts and attributes

const fetch = require('node-fetch');
const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LIST_ID;
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

    // Sync to Brevo
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const [email, contact] of contactMap) {
      try {
        // Check if contact exists in Brevo
        const exists = await checkBrevoContactExists(email);

        const attributes = {
          FIRSTNAME: contact.firstName || '',
          LASTNAME: contact.lastName || '',
          ORGANIZATION_NAME: contact.organization || '',
          PHONE_MOBILE: contact.phone || '',
          WEBINARS_ATTENDED_COUNT: contact.attendedWebinarIds.size,
          ATTENDED_WEBINAR: contact.attendedWebinarIds.size > 0 ? 'Yes' : 'No',
          WEB_CONTACT_REQ: contact.surveys.some(s => s.contactMe === 'Yes') ? 'Yes' : 'No',
          SOURCED_FROM: 'Webinar',
          LAST_CHANGED: new Date().toISOString(),
          INITIAL_CONTACT_TIME: contact.registrations[0]?.timestamp || new Date().toISOString()
        };

        if (!exists) {
          // Create new contact
          await createBrevoContact(email, attributes);
          created++;
        } else {
          // Update existing contact
          await updateBrevoContact(email, attributes);
          updated++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`[WebinarSync] Failed for ${email}:`, err.message);
        errors++;
      }
    }

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

async function checkBrevoContactExists(email) {
  if (!BREVO_API_KEY) return false;

  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    return res.ok;
  } catch (err) {
    return false;
  }
}

async function createBrevoContact(email, attributes) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify({
      email,
      attributes,
      listIds: BREVO_LIST_ID ? [parseInt(BREVO_LIST_ID, 10)] : [],
      updateEnabled: true
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Brevo create failed: ${error}`);
  }

  return await res.json();
}

async function updateBrevoContact(email, attributes) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');

  const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify({
      attributes
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Brevo update failed: ${error}`);
  }

  return true;
}

