// netlify/functions/getCommodityCodes.js
const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;

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
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch Commodity_Codes
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Commodity_Codes!A2:G',
    });

    const rows = response.data.values || [];

    const codes = rows.map((row, index) => ({
      id: index + 2,
      codeType: row[0] || '',
      codeNumber: row[1] || '',
      description: row[2] || '',
      category: row[3] || '',
      priority: row[4] || '',
      active: row[5] || '',
      notes: row[6] || ''
    }));

    // Group by code type
    const groupedCodes = codes.reduce((acc, item) => {
      if (!acc[item.codeType]) {
        acc[item.codeType] = [];
      }
      acc[item.codeType].push(item);
      return acc;
    }, {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        codes,
        grouped: groupedCodes,
        summary: {
          total: codes.length,
          byType: {
            NAICS: codes.filter(c => c.codeType === 'NAICS').length,
            NIGP: codes.filter(c => c.codeType === 'NIGP').length,
            PSC: codes.filter(c => c.codeType === 'PSC').length,
            UNSPSC: codes.filter(c => c.codeType === 'UNSPSC').length,
            CPV: codes.filter(c => c.codeType === 'CPV').length,
            FSC: codes.filter(c => c.codeType === 'FSC').length,
            SIC: codes.filter(c => c.codeType === 'SIC').length
          },
          primary: codes.filter(c => c.priority === 'Primary').length
        }
      })
    };

  } catch (error) {
    console.error('Error fetching commodity codes:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};