// netlify/functions/createReminder.js
const { google } = require('googleapis');
const { getSecrets } = require('../../../helpers/secretManager');
const { auth } = require('../../../helpers/googleAuth');

const TASKS_HEADERS = [
  'id',
  'createdAt',
  'createdBy',
  'rawText',
  'title',
  'notes',
  'dueAt',
  'tz',
  'recurrence',
  'priority',
  'status',
  'lastNotifiedAt',
  'notifyEveryMins',
  'contactEmail' // 💡 Now officially supported for CRM reminders
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const secrets = await getSecrets();
    const sheetId = secrets.SECRETARY_TASKS_SHEET_ID;
    const body = JSON.parse(event.body || '{}');

    const {
      type = 'Personal',
      title = '',
      notes = '',
      priority = 'code-green',
      createdAt = new Date().toISOString(),
      contactEmail = '',
      dueAt = '',
    } = body;

    const frequencyMap = {
      'code-red': 15,
      'code-yellow': 60,
      'code-green': 240,
      'code-white': 480,
    };

    const notifyEveryMins = frequencyMap[priority.toLowerCase()] || 240;

    const row = [
      Date.now().toString(), // id
      createdAt,
      'CommandApp',
      `${type} Reminder: ${title}`, // rawText
      title,
      notes,
      dueAt || '', // dueAt
      'UTC',
      '', // recurrence
      priority,
      'pending',
      '', // lastNotifiedAt
      notifyEveryMins,
      type === 'CRM' ? contactEmail : ''
    ];

    const authClient = await auth();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Tasks!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('❌ createReminder error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
