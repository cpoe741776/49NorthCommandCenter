// netlify/functions/getBidSystems.js //
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

    // Fetch BidSystemsRegistry
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A2:T',
    });

    const rows = response.data.values || [];

    const systems = rows.map((row, index) => ({
      id: index + 2,
      systemId: row[0] || '',
      systemName: row[1] || '',
      category: row[2] || '',
      status: row[3] || '',
      websiteUrl: row[4] || '',
      loginUrl: row[5] || '',
      username: row[6] || '',
      password: row[7] || '',
      registrationDate: row[8] || '',
      lastLoginDate: row[9] || '',
      emailAlertsEnabled: row[10] || '',
      alertEmailAddress: row[11] || '',
      naicsCodesMonitored: row[12] || '',
      geographicCoverage: row[13] || '',
      subscriptionType: row[14] || '',
      renewalDate: row[15] || '',
      annualCost: row[16] || '',
      notes: row[17] || '',
      dateAdded: row[18] || '',
      lastUpdated: row[19] || ''
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        systems,
        summary: {
          total: systems.length,
          active: systems.filter(s => s.status === 'Active').length,
          pending: systems.filter(s => s.status === 'Pending Registration').length,
          byCategory: {
            international: systems.filter(s => s.category === 'International').length,
            usState: systems.filter(s => s.category === 'US State').length,
            localCounty: systems.filter(s => s.category === 'Local/County').length,
            privateCommercial: systems.filter(s => s.category === 'Private/Commercial').length
          }
        }
      })
    };

  } catch (error) {
    console.error('Error fetching bid systems:', error);
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