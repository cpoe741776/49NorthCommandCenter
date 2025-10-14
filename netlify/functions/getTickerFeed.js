// netlify/functions/getTickerFeed.js
// Verify this file exists and has the correct structure

const { google } = require('googleapis');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let serviceAccountKey;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      serviceAccountKey = JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      );
    } else {
      serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch from TickerFeed tab in main bids sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'TickerFeed!A2:F', // Timestamp, Message, Priority, Source, Active, Target
    });

    const rows = response.data.values || [];
    
    // Parse and filter active items only
    const items = rows
      .map((row) => ({
        timestamp: row[0] || new Date().toISOString(),
        message: row[1] || '',
        priority: row[2] || 'low',
        source: row[3] || 'manual',
        active: String(row[4] || 'true').toLowerCase() === 'true',
        target: row[5] || null
      }))
      .filter(item => item.active && item.message.trim().length > 0);

    console.log(`[TickerFeed] Returning ${items.length} active items`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        items: items,
        count: items.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[TickerFeed] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        items: []
      })
    };
  }
};