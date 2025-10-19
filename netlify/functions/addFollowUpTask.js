// netlify/functions/addFollowUpTask.js
// Adds a follow-up task for a contact in the CRM FollowUpTasks tab

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const CRM_SHEET_ID = process.env.CRM_SHEET_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const { email, contactName, task, dueDate } = JSON.parse(event.body || '{}');

    if (!email || !task) {
      return ok(headers, { success: false, error: 'Email and task required' });
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

    // Generate task ID
    const taskId = `TASK${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    const row = [
      taskId,                       // A: Task ID
      email,                        // B: Email
      contactName || email,         // C: Contact Name
      task,                         // D: Task
      dueDate || '',                // E: Due Date
      'Open',                       // F: Status
      timestamp                     // G: Created Date
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: CRM_SHEET_ID,
      range: 'FollowUpTasks!A:G',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] }
    });

    console.log('[AddTask] Task created:', taskId, 'for', email);

    return ok(headers, {
      success: true,
      message: 'Follow-up task created',
      taskId
    });

  } catch (err) {
    console.error('[AddTask] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

