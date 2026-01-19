// netlify/functions/updateBidStatus.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { bidId, bidIds, status, dueDate } = JSON.parse(event.body || '{}');
    if ((!bidId && !Array.isArray(bidIds)) || !status) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'bidId or bidIds and status are required' }) };
    }

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    async function resolveRowIndexFromBidId(singleBidId) {
      // If numeric, treat as row index (legacy behavior)
      const maybeNum = parseInt(singleBidId, 10);
      if (String(maybeNum) === String(singleBidId) && Number.isFinite(maybeNum) && maybeNum >= 2) {
        return maybeNum;
      }

      // Otherwise treat as Source Email ID (preferred stable id)
      const sourceId = String(singleBidId || '').trim();
      if (!sourceId) return null;

      const colResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Active_Bids!U2:U', // Source Email ID column
      });

      const vals = colResp.data.values || [];
      for (let i = 0; i < vals.length; i++) {
        const v = String((vals[i] && vals[i][0]) || '').trim();
        if (v === sourceId) {
          return i + 2; // because range starts at row 2
        }
      }
      return null;
    }

    async function processSingle(singleBidId, singleStatus, singleDueDate) {
      const rowIndex = await resolveRowIndexFromBidId(singleBidId);
      if (!rowIndex) {
        return { ok: false, error: `Bid not found in Active_Bids (id: ${singleBidId})` };
      }

      // Quick "Respond" update: write "Respond" to column A on that row
      if (singleStatus === 'respond') {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Active_Bids!A${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Respond']] },
        });
        return { ok: true, message: 'Bid moved to Respond' };
      }

      // Load the exact row (A..U)
      const rowResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `Active_Bids!A${rowIndex}:U${rowIndex}`,
      });
      const bidRow = (rowResp.data.values && rowResp.data.values[0]) ? rowResp.data.values[0] : null;
      if (!bidRow) {
        return { ok: false, error: `Bid row could not be read (rowIndex: ${rowIndex})` };
      }

      // Update Due Date in column M if provided and status is submitted
      if (singleStatus === 'submitted' && singleDueDate) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Active_Bids!M${rowIndex}`, // M = Due Date
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[singleDueDate]] },
        });

        // re-fetch row
        const updated = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `Active_Bids!A${rowIndex}:U${rowIndex}`,
        });
        const updatedRow = (updated.data.values && updated.data.values[0]) ? updated.data.values[0] : bidRow;
        for (let i = 0; i < updatedRow.length; i++) bidRow[i] = updatedRow[i];
      }

      const today = new Date().toISOString().split('T')[0];

      if (singleStatus === 'disregard') {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Disregarded!A:U',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [bidRow] },
        });
      } else if (singleStatus === 'submitted') {
        const targetRow = [...bidRow, today];
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Submitted!A:V',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [targetRow] },
        });
      } else if (singleStatus === 'system-admin') {
        const adminRow = [
          'Systems Administration',     // A
          bidRow[4] || '',              // B: Email Date Received (E)
          bidRow[5] || '',              // C: Email From (F)
          bidRow[9] || '',              // D: Email Subject (J)
          bidRow[10] || '',             // E: Email Body (K)
          bidRow[15] || '',             // F: Bid System (P)
          bidRow[14] || '',             // G: Email Domain (O)
          bidRow[19] || today,          // H: Date Added (T)
          bidRow[20] || '',             // I: Source Email ID (U)
          'New',                        // J
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Active_Admin!A:J',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [adminRow] },
        });
      } else {
        return { ok: false, error: 'Invalid status' };
      }

      // Delete from Active_Bids (with safe fallback)
      const activeSheetId = await getSheetId(sheets, SHEET_ID, 'Active_Bids');

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: activeSheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            }],
          },
        });
      } catch (e) {
        const msg = String(e.message || e);
        if (msg.includes('not possible to delete all non-frozen rows')) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `Active_Bids!A${rowIndex}:U${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [new Array(21).fill('')] },
          });
        } else {
          throw e;
        }
      }

      const statusMessage =
        singleStatus === 'disregard' ? 'Disregarded' :
        singleStatus === 'submitted' ? 'Submitted' :
        singleStatus === 'system-admin' ? 'System Administration' :
        'updated';

      // Clear getBids in-memory cache
      try {
        const { clearBidsCache } = require('./getBids');
        if (clearBidsCache) clearBidsCache();
      } catch (e) {
        console.warn('[UpdateBidStatus] Could not clear cache:', e.message);
      }

      return { ok: true, message: `Bid moved to ${statusMessage}` };
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

      if (okCount > 0) {
        try {
          const { clearBidsCache } = require('./getBids');
          if (clearBidsCache) clearBidsCache();
        } catch (e) {
          console.warn('[UpdateBidStatus] Could not clear cache after batch:', e.message);
        }
      }

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
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Failed to update bid status', details: error.message }) };
  }
};

async function getSheetId(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}
