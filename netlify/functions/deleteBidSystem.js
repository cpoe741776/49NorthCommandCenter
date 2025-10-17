// netlify/functions/deleteBidSystem.js
const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;
const APP_TOKEN = process.env.APP_TOKEN; // optional shared secret

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    if (APP_TOKEN) {
      const provided = event.headers['x-app-token'] || event.headers['X-App-Token'];
      if (provided !== APP_TOKEN) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
      }
    }

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const { systemId } = JSON.parse(event.body || '{}');
    if (!systemId) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'systemId is required' }) };
    }

    // Find row by System ID (A2:A)
    const idCol = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A2:A',
    });
    const ids = idCol.data.values || [];
    const idx = ids.findIndex((r) => (r[0] || '') === systemId);
    if (idx === -1) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'System not found' }) };
    }

    // Get numeric sheetId (gid) by title
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheet = meta.data.sheets.find((s) => s.properties.title === 'BidSystemsRegistry');
    if (!sheet) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Sheet "BidSystemsRegistry" not found' }) };
    }
    const sheetId = sheet.properties.sheetId;

    // Compute 0-based row index to delete. Header is row 0; data starts at 1.
    // idx is 0-based into A2:A, so actual sheet row index = (idx + 1)
    const rowIndex = idx + 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'System deleted' }) };
  } catch (error) {
    console.error('Error deleting bid system:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
