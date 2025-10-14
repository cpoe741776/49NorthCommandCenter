// netlify/functions/getTickerFeed.js
const { google } = require('googleapis');
const { getGoogleAuth } = require('./_utils/google');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Adjust these if your ticker lives elsewhere
    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID || process.env.SOCIAL_MEDIA_SHEET_ID;
    const range = process.env.TICKER_RANGE || 'TickerFeed!A2:D';

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values || [];

    const items = rows.map((r) => ({
      timestamp: r[0] || '',
      type: r[1] || 'info',
      message: r[2] || '',
      link: r[3] || ''
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ items }) };
  } catch (err) {
    console.error('[getTickerFeed] error:', err?.message);
    // Don’t 500 the UI — return empty list
    return { statusCode: 200, headers, body: JSON.stringify({ items: [] }) };
  }
};
