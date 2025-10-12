const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { sourceEmailId, status } = JSON.parse(event.body);

    if (!sourceEmailId || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all rows to find the matching email
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Admin!A2:J',
    });

    const rows = response.data.values || [];
    let targetRow = -1;

    // Find row with matching Source Email ID (column I, index 8)
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][8] === sourceEmailId) {
        targetRow = i + 2; // +2 because sheet is 1-indexed and we start from row 2
        break;
      }
    }

    if (targetRow === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Email not found' })
      };
    }

    // Update status (column J)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Active_Admin!J${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[status]]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error updating admin email status:', error);
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