// netlify/functions/addContactNote.js
// Adds a note to a contact in the CRM ContactNotes tab

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const CRM_SHEET_ID = process.env.CRM_SHEET_ID;

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

    console.log('[AddNote] Note added for:', email);

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

