// netlify/functions/archiveTickerItems.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TICKER_TAB = 'TickerFeed';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all ticker items
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TICKER_TAB}!A:F`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ archived: 0 }),
      };
    }

    const now = new Date();
    let archivedCount = 0;
    const updates = [];

    // Check each row (skip header)
    rows.slice(1).forEach((row, index) => {
      const rowIndex = index + 2; // +2 because we skipped header and arrays are 0-indexed
      const expiresOn = row[5];
      const active = row[4];

      // If expired and still active, mark as inactive
      if (active === 'TRUE' && expiresOn && new Date(expiresOn) < now) {
        updates.push({
          range: `${TICKER_TAB}!E${rowIndex}`,
          values: [['FALSE']],
        });
        archivedCount++;
      }
    });

    // Batch update if there are changes
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ archived: archivedCount }),
    };
  } catch (error) {
    console.error('Error archiving ticker items:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to archive ticker items' }),
    };
  }
};

