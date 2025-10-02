// netlify/functions/addTickerItem.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TICKER_TAB = 'TickerFeed';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const item = JSON.parse(event.body);

    // Validate required fields
    if (!item.message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    // Set defaults
    const tickerItem = {
      timestamp: item.timestamp || new Date().toISOString(),
      message: item.message,
      priority: item.priority || 'medium',
      source: item.source || 'auto',
      active: item.active !== undefined ? item.active : true,
      expiresOn: item.expiresOn || addDays(new Date(), 7).toISOString(),
    };

    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Append to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TICKER_TAB}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          tickerItem.timestamp,
          tickerItem.message,
          tickerItem.priority,
          tickerItem.source,
          tickerItem.active,
          tickerItem.expiresOn,
        ]],
      },
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ success: true, item: tickerItem }),
    };
  } catch (error) {
    console.error('Error adding ticker item:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to add ticker item' }),
    };
  }
};

// Add this at the very end of addTickerItem.js, before the closing of the file

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}