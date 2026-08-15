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
      // Disregarding a batch used to call processSingle once per id.  Each call
      // re-read the entire Source Email ID column, which quickly exhausted the
      // Sheets read quota and left the UI looking as though records had moved
      // when they had not.  Load Active_Bids once, resolve all selected ids in
      // memory, append the archive rows in one request, then delete the source
      // rows from bottom to top so row numbers cannot shift underneath us.
      if (status === 'disregard') {
        const activeResp = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Active_Bids!A2:U',
        });
        const activeRows = activeResp.data.values || [];
        const rowsById = new Map();

        activeRows.forEach((row, index) => {
          const sourceEmailId = String(row[20] || '').trim(); // U = Source Email ID
          if (sourceEmailId) rowsById.set(sourceEmailId, { rowIndex: index + 2, row });
        });

        const resolved = [];
        const results = [];
        const seenIds = new Set();

        for (const bidId of bidIds) {
          const id = String(bidId || '').trim();
          const match = rowsById.get(id);
          if (!match) {
            results.push({ bidId, ok: false, error: `Bid not found in Active_Bids (id: ${bidId})` });
          } else if (seenIds.has(id)) {
            results.push({ bidId, ok: false, error: 'Duplicate bid id in batch' });
          } else {
            seenIds.add(id);
            resolved.push({ bidId, ...match });
          }
        }

        if (resolved.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: 'Disregarded!A:U',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: resolved.map(({ row }) => row) },
          });

          const activeSheetId = await getSheetId(sheets, SHEET_ID, 'Active_Bids');
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
              requests: resolved
                .sort((a, b) => b.rowIndex - a.rowIndex)
                .map(({ rowIndex }) => ({
                  deleteDimension: {
                    range: {
                      sheetId: activeSheetId,
                      dimension: 'ROWS',
                      startIndex: rowIndex - 1,
                      endIndex: rowIndex,
                    },
                  },
                })),
            },
          });

          results.push(...resolved.map(({ bidId }) => ({ bidId, ok: true, message: 'Bid moved to Disregarded' })));
          try {
            const { clearBidsCache } = require('./getBids');
            if (clearBidsCache) clearBidsCache();
          } catch (e) {
            console.warn('[UpdateBidStatus] Could not clear cache after disregard batch:', e.message);
          }
        }

        return { statusCode: 200, headers, body: JSON.stringify({
          success: true,
          ok: results.filter(r => r.ok).length,
          total: results.length,
          results,
        }) };
      }

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
