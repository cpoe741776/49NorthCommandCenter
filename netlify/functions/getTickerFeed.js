// netlify/functions/getTickerFeed.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TICKER_TAB = 'TickerFeed';

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch ticker feed data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TICKER_TAB}!A:F`,
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    // Parse rows into objects (skip header row)
    const [, ...dataRows] = rows;
    const tickerItems = dataRows.map(row => ({
      timestamp: row[0] || '',
      message: row[1] || '',
      priority: row[2] || 'medium',
      source: row[3] || 'manual',
      active: row[4] === 'TRUE' || row[4] === true,
      expiresOn: row[5] || '',
    }));

    // Filter out expired items
    const now = new Date();
    const activeItems = tickerItems.filter(item => {
      if (!item.active) return false;
      if (!item.expiresOn) return true;
      return new Date(item.expiresOn) > now;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(activeItems),
    };
  } catch (error) {
    console.error('Error fetching ticker feed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch ticker feed' }),
    };
  }
};

