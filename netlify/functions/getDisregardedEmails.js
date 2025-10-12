// getDisregardedEmails.js //
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
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch Disregarded sheet (21 columns now)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Disregarded!A2:U', // A-U = 21 columns
    });

    const rows = response.data.values || [];

    const disregardedEmails = rows.map((row, index) => ({
      id: `disregarded-${index + 2}`,
      rowNumber: index + 2,
      recommendation: row[0] || 'Disregard',
      scoreDetails: row[1] || '',
      aiReasoning: row[2] || '',
      aiSummary: row[3] || '',
      emailDateReceived: row[4] || '',
      emailFrom: row[5] || '',
      keywordsCategory: row[6] || '',
      keywordsFound: row[7] || '',
      relevance: row[8] || 'Low',
      emailSubject: row[9] || '',
      emailBody: row[10] || '',
      url: row[11] || '',
      dueDate: row[12] || '',
      significantSnippet: row[13] || '',
      emailDomain: row[14] || '',
      bidSystem: row[15] || 'Unknown',
      country: row[16] || '',
      entity: row[17] || '',
      status: row[18] || 'Disregarded',
      dateAdded: row[19] || '',
      sourceEmailId: row[20] || ''
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emails: disregardedEmails,
        count: disregardedEmails.length
      })
    };

  } catch (error) {
    console.error('Error fetching disregarded emails:', error);
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