// netlify/functions/moveBidToSystemAdmin.js
// Moves a bid from Active_Bids to Active_Admin (System Correspondence)

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

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
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { bidId } = JSON.parse(event.body || '{}');

    if (!bidId) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Bid ID required' }) };
    }

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[MoveToBidSystem] Moving bid', bidId, 'to Active_Admin');

    // 1. Fetch the bid from Active_Bids
    const bidsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A2:U'
    });

    const bids = bidsRes.data.values || [];
    const rowIndex = parseInt(bidId, 10);
    
    if (rowIndex < 2 || rowIndex > bids.length + 1) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Bid not found' }) };
    }

    const bidRow = bids[rowIndex - 2]; // 0-indexed array, row 2 = index 0

    if (!bidRow || bidRow.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Bid data not found' }) };
    }

    // 2. Map Active_Bids columns (A:U) to Active_Admin columns (A:J)
    // Active_Bids: A=Recommendation, B=ScoreDetails, C=AIReasoning, D=AISummary, E=EmailDateReceived, 
    //              F=EmailFrom, G=KeywordsCategory, H=KeywordsFound, I=Relevance, J=EmailSubject, 
    //              K=EmailBody, L=URL, M=DueDate, N=SignificantSnippet, O=EmailDomain, P=BidSystem, 
    //              Q=Country, R=Entity, S=Status, T=DateAdded, U=SourceEmailId
    //
    // Active_Admin: A=Recommendation, B=EmailDateReceived, C=EmailFrom, D=EmailSubject, E=EmailBody, 
    //               F=BidSystem, G=EmailDomain, H=DateAdded, I=SourceEmailId, J=Status

    const adminRow = [
      'Systems Administration',  // A: Recommendation (override to System Admin)
      bidRow[4] || '',            // B: Email Date Received (from E)
      bidRow[5] || '',            // C: Email From (from F)
      bidRow[9] || '',            // D: Email Subject (from J)
      bidRow[10] || '',           // E: Email Body (from K)
      bidRow[15] || '',           // F: Bid System (from P)
      bidRow[14] || '',           // G: Email Domain (from O)
      bidRow[19] || new Date().toISOString(), // H: Date Added (from T, or now)
      bidRow[20] || '',           // I: Source Email ID (from U)
      'New'                       // J: Status (set to New for admin review)
    ];

    // 3. Append to Active_Admin
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Active_Admin!A:J',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [adminRow] }
    });

    console.log('[MoveToBidSystem] Appended to Active_Admin');

    // 4. Delete from Active_Bids
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const activeBidsSheet = (meta.data.sheets || []).find(s => s.properties.title === 'Active_Bids');
    const sheetId = activeBidsSheet ? activeBidsSheet.properties.sheetId : null;

    if (sheetId === null) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Active_Bids sheet not found' }) };
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });

    console.log('[MoveToBidSystem] Deleted from Active_Bids row', rowIndex);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Bid moved to System Administration successfully'
      })
    };

  } catch (error) {
    console.error('[MoveToBidSystem] Error:', error);
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

