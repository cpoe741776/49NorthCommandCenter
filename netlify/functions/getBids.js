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

    const nonEmpty = (r) => r && r.length && r.some((c) => String(c || '').trim() !== '');

    // ----- Active_Bids (A..U) -----
    const activeResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:U',
    });
    const activeRows = (activeResp.data.values || []).filter(nonEmpty);
    const activeBids = activeRows.map((row, i) => toBid(row, i + 2, 'New'));

    // ----- Disregarded (A..U) -----
    const disResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Disregarded!A2:U',
    });
    const disRows = (disResp.data.values || []).filter(nonEmpty);
    const disregardedBids = disRows.map((row, i) => toBid(row, i + 2, 'Disregarded'));

    // ----- Submitted (A..V, V = submissionDate) -----
    const subResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Submitted!A2:V',
    });
    const subRows = (subResp.data.values || []).filter(nonEmpty);
    const submittedBids = subRows.map((row, i) => ({
      ...toBid(row, i + 2, 'Submitted'),
      submissionDate: row[21] || '', // V
    }));

    // Case-insensitive counts, trimmed
    const recKey = (s) => String(s || '').trim().toLowerCase();
    const respondCount = activeBids.filter((b) => recKey(b.recommendation) === 'respond').length;
    const gatherInfoCount = activeBids.filter((b) => recKey(b.recommendation) === 'gather more information').length;

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
          respondCount,
          gatherInfoCount,
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
  const v = (i) => (row && row[i] != null ? row[i] : '');
  return {
    id: sheetRowNumber,
    recommendation: v(0),
    scoreDetails: v(1),
    aiReasoning: v(2),
    aiSummary: v(3),
    emailDateReceived: v(4),
    emailFrom: v(5),
    keywordsCategory: v(6),
    keywordsFound: v(7),
    relevance: v(8),
    emailSubject: v(9),
    emailBody: v(10),
    url: v(11),
    dueDate: v(12),
    significantSnippet: v(13),
    emailDomain: v(14),
    bidSystem: v(15),
    country: v(16),
    entity: v(17),
    status: v(18) || fallbackStatus,
    dateAdded: v(19),
    sourceEmailId: v(20),
    // Back-compat aliases
    emailSummary: v(3),  // maps to aiSummary
    reasoning: v(2),     // maps to aiReasoning
  };
}
