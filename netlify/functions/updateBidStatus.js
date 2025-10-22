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

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

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
      } else if (singleStatus === 'system-admin') {
        // Move to Active_Admin (System Correspondence)
        // Active_Admin columns: A=Recommendation, B=EmailDateReceived, C=EmailFrom, D=EmailSubject, 
        //                       E=EmailBody, F=BidSystem, G=EmailDomain, H=DateAdded, I=SourceEmailId, J=Status
        // Map from Active_Bids (A:U) to Active_Admin (A:J)
        const adminRow = [
          'Systems Administration',  // A: Recommendation (override)
          bidRow[4] || '',            // B: Email Date Received (from E)
          bidRow[5] || '',            // C: Email From (from F)
          bidRow[9] || '',            // D: Email Subject (from J)
          bidRow[10] || '',           // E: Email Body (from K)
          bidRow[15] || '',           // F: Bid System (from P)
          bidRow[14] || '',           // G: Email Domain (from O)
          bidRow[19] || today,        // H: Date Added (from T, or today)
          bidRow[20] || '',           // I: Source Email ID (from U)
          'New'                       // J: Status (set to New for admin review)
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

      const statusMessage = 
        singleStatus === 'disregard' ? 'Disregarded' :
        singleStatus === 'submitted' ? 'Submitted' :
        singleStatus === 'system-admin' ? 'System Administration' :
        'updated';
      
      // Clear the getBids cache so changes are reflected immediately
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
      
      // Clear cache if any updates succeeded
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update bid status', details: error.message }) };
  }
};

async function getSheetId(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}
