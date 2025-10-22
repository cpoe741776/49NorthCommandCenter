// netlify/functions/addContactNote.js
// Adds a note to a contact in the CRM ContactNotes tab AND syncs to Brevo NOTES field

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const CRM_SHEET_ID = process.env.CRM_SHEET_ID;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const { email, noteType, note, createdBy, followUpDate } = JSON.parse(event.body || '{}');

    if (!email || !note) {
      return ok(headers, { success: false, error: 'Email and note required' });
    }

    if (!CRM_SHEET_ID) {
      return ok(headers, { success: false, error: 'CRM_SHEET_ID not configured' });
    }

    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const timestamp = new Date().toISOString();
    const row = [
      timestamp,                    // A: Timestamp
      email,                        // B: Email
      noteType || 'Note',           // C: Note Type
      note,                         // D: Note
      createdBy || 'system',        // E: Created By
      followUpDate || ''            // F: Follow Up Date
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: CRM_SHEET_ID,
      range: 'ContactNotes!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] }
    });

    console.log('[AddNote] Note added to Google Sheet for:', email);

    // Also sync to Brevo NOTES field
    await syncNoteToBrevo(email, note, timestamp);

    return ok(headers, {
      success: true,
      message: 'Note added successfully',
      noteId: timestamp
    });

  } catch (err) {
    console.error('[AddNote] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

// Sync note to Brevo NOTES field (append with timestamp)
async function syncNoteToBrevo(email, note, timestamp) {
  if (!BREVO_API_KEY) {
    console.warn('[AddNote] BREVO_API_KEY not set, skipping Brevo sync');
    return;
  }

  try {
    // First, fetch current NOTES value from Brevo
    const getRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    let existingNotes = '';
    if (getRes.ok) {
      const contactData = await getRes.json();
      existingNotes = contactData.attributes?.NOTES || '';
    }

    // Format new note with timestamp
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const formattedNote = `[${formattedDate}] ${note}`;

    // Append new note to existing notes (with newline separator)
    const updatedNotes = existingNotes 
      ? `${existingNotes}\n${formattedNote}`
      : formattedNote;

    // Update Brevo contact with new NOTES value
    const updateRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        attributes: {
          NOTES: updatedNotes,
          LAST_CHANGED: new Date().toISOString()
        }
      })
    });

    if (updateRes.ok) {
      console.log('[AddNote] Note synced to Brevo NOTES field for:', email);
    } else {
      console.error('[AddNote] Failed to sync note to Brevo:', updateRes.status);
    }
  } catch (err) {
    console.error('[AddNote] Brevo sync error:', err.message);
    // Don't fail the whole operation if Brevo sync fails
  }
}

