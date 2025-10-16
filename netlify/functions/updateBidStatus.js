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
    const { bidId, bidIds, status, dueDate } = JSON.parse(event.body || '{}');
    if ((!bidId && !Array.isArray(bidIds)) || !status) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'bidId or bidIds and status are required' }) };
    }

    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    async function processSingle(singleBidId, singleStatus, singleDueDate) {
      // Quick "Respond" update: write "Respond" to column A on that row
      if (singleStatus === 'respond') {
        const rowIndex = parseInt(singleBidId, 10);
        if (!Number.isFinite(rowIndex) || rowIndex < 2) {
          return { ok: false, error: 'Invalid bidId' };
        }
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Active_Bids!A${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Respond']] },
        });
        return { ok: true, message: 'Bid moved to Respond' };
      }

      // Load Active_Bids rows (A:U)
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Active_Bids!A:U',
      });
      const rows = resp.data.values || [];
      const rowIndex = parseInt(singleBidId, 10);
      if (!Number.isFinite(rowIndex) || rowIndex < 2 || rowIndex > rows.length) {
        return { ok: false, error: 'Bid not found' };
      }

      // Update Due Date in column M if provided and status is submitted
      if (singleStatus === 'submitted' && singleDueDate) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Active_Bids!M${rowIndex}`, // M = Due Date
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[singleDueDate]] },
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

      if (singleStatus === 'disregard') {
        // Append full row to Disregarded (A:U)
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Disregarded!A:U',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [bidRow] },
        });
      } else if (singleStatus === 'submitted') {
        // Append full row + Submitted On to Submitted (A:V)
        const targetRow = [...bidRow, today];
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Submitted!A:V',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [targetRow] },
        });
      } else {
        return { ok: false, error: 'Invalid status' };
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

      return { ok: true, message: `Bid moved to ${singleStatus === 'disregard' ? 'Disregarded' : 'Submitted'}` };
    }

    // Batch mode
    if (Array.isArray(bidIds) && bidIds.length > 0) {
      const results = [];
      for (const id of bidIds) {
        try {
          const r = await processSingle(id, status, dueDate);
          results.push({ bidId: id, ...r });
        } catch (e) {
          results.push({ bidId: id, ok: false, error: e.message });
        }
      }
      const okCount = results.filter(r => r.ok).length;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ok: okCount, total: results.length, results }) };
    }

    // Single mode
    const single = await processSingle(bidId, status, dueDate);
    if (!single.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: single.error }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: single.message }) };
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
