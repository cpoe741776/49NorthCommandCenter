// netlify/functions/updateBidStatus.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const SHEETS = {
  ACTIVE: 'Active_Bids',
  DISREGARDED: 'Disregarded',
  SUBMITTED: 'Submitted',
  ACTIVE_ADMIN: 'Active_Admin',
};

const COLS = {
  // Active_Bids A..U -> Source Email ID is column U (zero-based index 20)
  SOURCE_EMAIL_ID_INDEX: 20,
  DUE_DATE_COL_LETTER: 'M',
};

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
    const body = JSON.parse(event.body || '{}');
    const { sourceEmailId, sourceEmailIds, status, dueDate } = body;

    if ((!sourceEmailId && !Array.isArray(sourceEmailIds)) || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'sourceEmailId or sourceEmailIds and status are required' }),
      };
    }

    const normalizedStatus = String(status || '').trim().toLowerCase();

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // ---------- helpers ----------
    async function getSheetIdByTitle(title) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const sh = (meta.data.sheets || []).find(s => s.properties?.title === title);
      return sh ? sh.properties.sheetId : null;
    }

    async function loadActiveRows() {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEETS.ACTIVE}!A:U`,
      });
      return resp.data.values || [];
    }

    function findRowIndexBySourceEmailId(rows, wantedId) {
      const target = String(wantedId || '').trim();
      if (!target) return null;

      // rows[0] is header; data starts at row 2 (index 1)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const sid = String(row[COLS.SOURCE_EMAIL_ID_INDEX] || '').trim();
        if (sid === target) return i + 1; // sheet row number
      }
      return null;
    }

    async function updateDueDateIfNeeded(rowIndex, singleStatus, singleDueDate) {
      if (singleStatus === 'submitted' && singleDueDate) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${SHEETS.ACTIVE}!${COLS.DUE_DATE_COL_LETTER}${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[singleDueDate]] },
        });
      }
    }

    async function appendToSheet(range, values) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      });
    }

    async function deleteActiveRowOrClear(rowIndex) {
      const activeSheetId = await getSheetIdByTitle(SHEETS.ACTIVE);
      if (!activeSheetId) throw new Error('Active_Bids sheetId not found');

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
        return { deleted: true };
      } catch (e) {
        const msg = String(e?.message || e);
        // Fallback: clear row values (A:U) if delete is blocked
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${SHEETS.ACTIVE}!A${rowIndex}:U${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [Array(21).fill('')] },
        });
        return { deleted: false, cleared: true, deleteError: msg };
      }
    }

    async function processSingle(singleSourceEmailId, singleStatus, singleDueDate) {
      const wanted = String(singleSourceEmailId || '').trim();
      if (!wanted) return { ok: false, error: 'Invalid sourceEmailId' };

      // 1) Find the row by Source Email ID
      const rows = await loadActiveRows();
      const rowIndex = findRowIndexBySourceEmailId(rows, wanted);
      if (!rowIndex) return { ok: false, error: `Bid not found in ${SHEETS.ACTIVE} (Source Email ID: ${wanted})` };

      // Respond is an in-place update (no move)
      if (singleStatus === 'respond') {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${SHEETS.ACTIVE}!A${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Respond']] },
        });
        return { ok: true, message: 'Bid marked as Respond' };
      }

      // 2) If needed, update due date, then fetch row again
      await updateDueDateIfNeeded(rowIndex, singleStatus, singleDueDate);

      const updatedRowResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEETS.ACTIVE}!A${rowIndex}:U${rowIndex}`,
      });
      const bidRow = updatedRowResp.data.values?.[0] || [];

      const today = new Date().toISOString().split('T')[0];

      // 3) Append to target sheet
      if (singleStatus === 'disregard') {
        await appendToSheet(`${SHEETS.DISREGARDED}!A:U`, bidRow);
      } else if (singleStatus === 'submitted') {
        const targetRow = [...bidRow, today]; // Submitted A:V (V = submission date)
        await appendToSheet(`${SHEETS.SUBMITTED}!A:V`, targetRow);
      } else if (singleStatus === 'system-admin') {
        // Map Active_Bids (A:U) -> Active_Admin (A:J)
        const adminRow = [
          'Systems Administration',   // A
          bidRow[4] || '',            // B Email Date Received (E)
          bidRow[5] || '',            // C Email From (F)
          bidRow[9] || '',            // D Email Subject (J)
          bidRow[10] || '',           // E Email Body (K)
          bidRow[15] || '',           // F Bid System (P)
          bidRow[14] || '',           // G Email Domain (O)
          bidRow[19] || today,        // H Date Added (T)
          bidRow[20] || wanted,       // I Source Email ID (U)
          'New',                      // J Status
        ];
        await appendToSheet(`${SHEETS.ACTIVE_ADMIN}!A:J`, adminRow);
      } else {
        return { ok: false, error: `Invalid status: ${singleStatus}` };
      }

      // 4) Remove from Active_Bids (delete or clear)
      const removal = await deleteActiveRowOrClear(rowIndex);

      // 5) Clear getBids cache so changes show immediately (best effort)
      try {
        const { clearBidsCache } = require('./getBids');
        if (clearBidsCache) clearBidsCache();
      } catch (e) {
        console.warn('[updateBidStatus] Could not clear cache:', e.message);
      }

      const statusMessage =
        singleStatus === 'disregard' ? 'Disregarded' :
        singleStatus === 'submitted' ? 'Submitted' :
        singleStatus === 'system-admin' ? 'System Administration' :
        'Updated';

      return { ok: true, message: `Bid moved to ${statusMessage}`, removal };
    }

    // ---------- Batch mode ----------
    if (Array.isArray(sourceEmailIds) && sourceEmailIds.length > 0) {
      const results = [];
      for (const sid of sourceEmailIds) {
        try {
          const r = await processSingle(sid, normalizedStatus, dueDate);
          results.push({ sourceEmailId: sid, ...r });
        } catch (e) {
          results.push({ sourceEmailId: sid, ok: false, error: e.message });
        }
      }

      const okCount = results.filter(r => r.ok).length;
      const total = results.length;

      const success = okCount > 0;

      return {
        statusCode: success ? 200 : 400,
        headers,
        body: JSON.stringify({ success, ok: okCount, total, results }),
      };
    }

    // ---------- Single mode ----------
    const single = await processSingle(sourceEmailId, normalizedStatus, dueDate);
    if (!single.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: single.error }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: single.message, removal: single.removal }),
    };
  } catch (error) {
    console.error('updateBidStatus error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to update bid status', details: error.message }),
    };
  }
};
