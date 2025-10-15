// netlify/functions/getBids.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    // Service account (JSON or base64)
    const creds = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // ----- Active_Bids (A..U) -----
    const activeResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:U',
    });
    const activeRows = activeResp.data.values || [];
    const activeBids = activeRows.map((row, i) => toBid(row, i + 2, 'New'));

    // ----- Disregarded (A..U) -----
    const disResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Disregarded!A2:U',
    });
    const disRows = disResp.data.values || [];
    const disregardedBids = disRows.map((row, i) => toBid(row, i + 2, 'Disregarded'));

    // ----- Submitted (A..V, V = submissionDate) -----
    const subResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Submitted!A2:V',
    });
    const subRows = subResp.data.values || [];
    const submittedBids = subRows.map((row, i) => ({
      ...toBid(row, i + 2, 'Submitted'),
      submissionDate: row[21] || '', // V
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
          totalSubmitted: submittedBids.length,
        },
      }),
    };
  } catch (error) {
    console.error('Error fetching bids:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// Map a 21-column row (A..U) to a unified bid object.
// Default `fallbackStatus` is used when the sheet’s Status col is empty.
function toBid(row, sheetRowNumber, fallbackStatus) {
  // Expecting:
  // A Recommendation, B Score Details, C AI Reasoning, D AI Email Summary,
  // E Email Date Received, F From, G Keywords Category, H Keywords Found,
  // I Relevance, J Subject, K Body, L URL, M Due Date, N Snippet,
  // O Email Domain, P Bid System, Q Country, R Entity/Agency,
  // S Status, T Date Added, U Source Email ID
  return {
    id: sheetRowNumber,
    recommendation: row[0] || '',
    scoreDetails: row[1] || '',
    aiReasoning: row[2] || '',
    aiSummary: row[3] || '',
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
    status: row[18] || fallbackStatus,
    dateAdded: row[19] || '',
    sourceEmailId: row[20] || '',
    // Back-compat aliases
    emailSummary: row[3] || '',  // maps to aiSummary
    reasoning: row[2] || '',     // maps to aiReasoning
  };
}
