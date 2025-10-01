// netlify/functions/getBids.js
const { google } = require('googleapis');

const SHEET_ID = '1o-kW7fBqQVG15xXvvenkO3nRmSfxpCp6vY-qybpRp9w';

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get service account credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    // Authenticate with Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch Active_Bids sheet
    const activeBidsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:T', // Skip header row, get all data columns
    });

    const activeBidsRows = activeBidsResponse.data.values || [];

    // Transform rows into bid objects
    const activeBids = activeBidsRows.map((row, index) => ({
      id: index + 1,
      recommendation: row[0] || '',
      reasoning: row[1] || '',
      emailSummary: row[2] || '',
      emailDateReceived: row[3] || '',
      emailFrom: row[4] || '',
      keywordsCategory: row[5] || '',
      keywordsFound: row[6] || '',
      relevance: row[7] || '',
      emailSubject: row[8] || '',
      emailBody: row[9] || '',
      url: row[10] || '',
      dueDate: row[11] || '',
      significantSnippet: row[12] || '',
      emailDomain: row[13] || '',
      bidSystem: row[14] || '',
      country: row[15] || '',
      entity: row[16] || '',
      status: row[17] || 'New',
      dateAdded: row[18] || '',
      sourceEmailId: row[19] || ''
    }));

    // Fetch Disregarded sheet for archive count
    const disregardedResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Disregarded!A2:H',
    });

    const disregardedRows = disregardedResponse.data.values || [];
    const disregardedBids = disregardedRows.map((row, index) => ({
      id: index + 1,
      recommendation: row[0] || '',
      reasoning: row[1] || '',
      emailSubject: row[2] || '',
      emailDateReceived: row[3] || '',
      emailFrom: row[4] || '',
      emailDomain: row[5] || '',
      dateAdded: row[6] || '',
      sourceEmailId: row[7] || ''
    }));

    // Return data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activeBids,
        disregardedBids,
        summary: {
          totalActive: activeBids.length,
          respondCount: activeBids.filter(b => b.recommendation === 'Respond').length,
          gatherInfoCount: activeBids.filter(b => b.recommendation === 'Gather More Information').length,
          totalDisregarded: disregardedBids.length
        }
      })
    };

  } catch (error) {
    console.error('Error fetching bids:', error);
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