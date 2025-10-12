// updateSystemAdminStatus.js //
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

    // DELETE the row instead of updating status
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetId(sheets, SHEET_ID, 'Active_Admin'),
                dimension: 'ROWS',
                startIndex: targetRow - 1, // 0-indexed for API
                endIndex: targetRow         // exclusive end
              }
            }
          }
        ]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, deleted: true })
    };

  } catch (error) {
    console.error('Error archiving admin email:', error);
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

// Helper function to get sheet ID by name
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId
  });
  
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : 0;
}