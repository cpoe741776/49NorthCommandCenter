// netlify/functions/getBids.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

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

    // Fetch Active_Bids
    const activeBidsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:T',
    });

    const activeBidsRows = activeBidsResponse.data.values || [];

    const activeBids = activeBidsRows.map((row, index) => ({
      id: index + 2,
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

    // Fetch Disregarded
    const disregardedResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Disregarded!A2:H',
    });

    const disregardedRows = disregardedResponse.data.values || [];
    const disregardedBids = disregardedRows.map((row, index) => ({
      id: index + 2,
      recommendation: row[0] || '',
      reasoning: row[1] || '',
      emailSubject: row[2] || '',
      emailDateReceived: row[3] || '',
      emailFrom: row[4] || '',
      emailDomain: row[5] || '',
      dateAdded: row[6] || '',
      sourceEmailId: row[7] || ''
    }));

    // Fetch Submitted
    const submittedResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Submitted!A2:U',
    });

    const submittedRows = submittedResponse.data.values || [];
    const submittedBids = submittedRows.map((row, index) => ({
      id: index + 2,
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
      status: row[17] || 'Submitted',
      dateAdded: row[18] || '',
      sourceEmailId: row[19] || '',
      submissionDate: row[20] || ''
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activeBids,
        disregardedBids,
        submittedBids,
        summary: {
          totalActive: activeBids.length,
          respondCount: activeBids.filter(b => b.recommendation === 'Respond').length,
          gatherInfoCount: activeBids.filter(b => b.recommendation === 'Gather More Information').length,
          totalDisregarded: disregardedBids.length,
          totalSubmitted: submittedBids.length
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