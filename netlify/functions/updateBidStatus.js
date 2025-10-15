// netlify/functions/updateBidStatus.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Column mapping for A..U


exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { bidId, status, dueDate } = JSON.parse(event.body || '{}');
    if (!bidId || !status) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'bidId and status are required' }) };
    }

    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Quick "Respond" update: write "Respond" to column A on that row
    if (status === 'respond') {
      const rowIndex = parseInt(bidId, 10);
      if (!Number.isFinite(rowIndex) || rowIndex < 2) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid bidId' }) };
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Active_Bids!A${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Respond']] },
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Bid moved to Respond' }) };
    }

    // Load Active_Bids rows (A:U)
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A:U',
    });
    const rows = resp.data.values || [];
    const rowIndex = parseInt(bidId, 10);
    if (!Number.isFinite(rowIndex) || rowIndex < 2 || rowIndex > rows.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Bid not found' }) };
    }

    // Update Due Date in column M if provided and status is submitted
    if (status === 'submitted' && dueDate) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Active_Bids!M${rowIndex}`, // M = Due Date
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[dueDate]] },
      });
      // Re-fetch the row after update
      const updated = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `Active_Bids!A${rowIndex}:U${rowIndex}`,
      });
      rows[rowIndex - 1] = updated.data.values?.[0] || rows[rowIndex - 1];
    }

    const bidRow = rows[rowIndex - 1];
    const today = new Date().toISOString().split('T')[0];

    if (status === 'disregard') {
      // Append full row to Disregarded (A:U)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Disregarded!A:U',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [bidRow] },
      });
    } else if (status === 'submitted') {
      // Append full row + Submitted On to Submitted (A:V)
      const targetRow = [...bidRow, today];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Submitted!A:V',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [targetRow] },
      });
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status' }) };
    }

    // Delete from Active_Bids
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: await getSheetId(sheets, SHEET_ID, 'Active_Bids'),
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        }],
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `Bid moved to ${status === 'disregard' ? 'Disregarded' : 'Submitted'}` }),
    };
  } catch (error) {
    console.error('updateBidStatus error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update bid status', details: error.message }) };
  }
};

async function getSheetId(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}
