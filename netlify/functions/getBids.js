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

    // Fetch Active_Bids (now A2:U to include new columns)
    const activeBidsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:U',
    });

    const activeBidsRows = activeBidsResponse.data.values || [];

    const activeBids = activeBidsRows.map((row, index) => ({
      id: index + 2,
      recommendation: row[0] || '',
      scoreDetails: row[1] || '',          // NEW
      aiReasoning: row[2] || '',           // NEW
      aiSummary: row[3] || '',             // NEW
      emailDateReceived: row[4] || '',
      emailFrom: row[5] || '',
      keywordsCategory: row[6] || '',
      keywordsFound: row[7] || '',
      relevance: row[8] || '',
      emailSubject: row[9] || '',
      emailBody: row[10] || '',
      url: row[11] || '',
      dueDate: row[12] || '',
      significantSnippet: row[13] || '',
      emailDomain: row[14] || '',
      bidSystem: row[15] || '',
      country: row[16] || '',
      entity: row[17] || '',
      status: row[18] || 'New',
      dateAdded: row[19] || '',
      sourceEmailId: row[20] || '',
      
      // Backwards compatibility - keep old field name for existing components
      emailSummary: row[3] || '',          // Maps to aiSummary
      reasoning: row[2] || ''              // Maps to aiReasoning
    }));

    // Fetch Disregarded (unchanged)
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

    // Fetch Submitted (now A2:V to include new columns)
    const submittedResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Submitted!A2:V',
    });

    const submittedRows = submittedResponse.data.values || [];
    const submittedBids = submittedRows.map((row, index) => ({
      id: index + 2,
      recommendation: row[0] || '',
      scoreDetails: row[1] || '',          // NEW
      aiReasoning: row[2] || '',           // NEW
      aiSummary: row[3] || '',             // NEW
      emailDateReceived: row[4] || '',
      emailFrom: row[5] || '',
      keywordsCategory: row[6] || '',
      keywordsFound: row[7] || '',
      relevance: row[8] || '',
      emailSubject: row[9] || '',
      emailBody: row[10] || '',
      url: row[11] || '',
      dueDate: row[12] || '',
      significantSnippet: row[13] || '',
      emailDomain: row[14] || '',
      bidSystem: row[15] || '',
      country: row[16] || '',
      entity: row[17] || '',
      status: row[18] || 'Submitted',
      dateAdded: row[19] || '',
      sourceEmailId: row[20] || '',
      submissionDate: row[21] || '',
      
      // Backwards compatibility
      emailSummary: row[3] || '',
      reasoning: row[2] || ''
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