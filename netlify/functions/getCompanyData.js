// netlify/functions/getCompanyData.js
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

    // Fetch CompanyDataVault
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'CompanyDataVault!A2:H',
    });

    const rows = response.data.values || [];

    const data = rows.map((row, index) => ({
      id: index + 2,
      fieldId: row[0] || '',
      category: row[1] || '',
      fieldName: row[2] || '',
      fieldValue: row[3] || '',
      alternateValue: row[4] || '',
      lastUpdated: row[5] || '',
      verified: row[6] || '',
      notes: row[7] || ''
    }));

    // Group by category for easier access
    const groupedData = data.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data,
        grouped: groupedData,
        summary: {
          total: data.length,
          categories: Object.keys(groupedData).length
        }
      })
    };

  } catch (error) {
    console.error('Error fetching company data:', error);
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