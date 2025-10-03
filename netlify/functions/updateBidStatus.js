// netlify/functions/updateBidStatus.js
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { bidId, status, dueDate } = JSON.parse(event.body);

    if (!bidId || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'bidId and status are required' }),
      };
    }

    // Authenticate
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      ),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // If status is 'respond', just update the recommendation column
    if (status === 'respond') {
      const rowIndex = parseInt(bidId);
      const range = `Active_Bids!A${rowIndex}`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['Respond']],
        },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Bid moved to Respond column' 
        }),
      };
    }

    // For 'submitted' or 'disregard', move the row to the appropriate tab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A:T',
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No active bids found' }),
      };
    }

    const rowIndex = parseInt(bidId);
    if (rowIndex < 2 || rowIndex > rows.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Bid not found' }),
      };
    }

    const bidRow = rows[rowIndex - 1];
    const today = new Date().toISOString().split('T')[0];

    // If dueDate is provided and status is submitted, update column L (index 11) before moving
    if (status === 'submitted' && dueDate) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Active_Bids!L${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[dueDate]],
        },
      });
      
      // Refresh the row data after updating
      const updatedResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `Active_Bids!A${rowIndex}:T${rowIndex}`,
      });
      bidRow.splice(0, bidRow.length, ...updatedResponse.data.values[0]);
    }

    let targetTab, targetRow;
    
    if (status === 'disregard') {
      targetTab = 'Disregarded';
      targetRow = [
        bidRow[0],  // Recommendation
        bidRow[1],  // Reasoning
        bidRow[8],  // Email Subject
        bidRow[3],  // Email Date Received
        bidRow[4],  // Email From
        bidRow[13], // Email Domain
        bidRow[18], // Date Added
        bidRow[19]  // Source Email ID
      ];
    } else if (status === 'submitted') {
      targetTab = 'Submitted';
      targetRow = [
        ...bidRow,
        today
      ];
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid status. Use "submitted", "disregard", or "respond"' }),
      };
    }

    // Append to target tab
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${targetTab}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [targetRow],
      },
    });

    // Delete from Active_Bids
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: await getSheetId(sheets, SHEET_ID, 'Active_Bids'),
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: `Bid moved to ${targetTab}` 
      }),
    };
  } catch (error) {
    console.error('Error updating bid status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update bid status', details: error.message }),
    };
  }
};

async function getSheetId(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });
  
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}