// netlify/functions/updateBidStatus.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const BIDS_TAB = 'BidsCacheParsed';

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
    const { bidId, status } = JSON.parse(event.body);

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

    // Get all bids to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${BIDS_TAB}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No bids found' }),
      };
    }

    // Find the bid row (bidId is the row number)
    const rowIndex = parseInt(bidId);
    if (rowIndex < 2 || rowIndex > rows.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Bid not found' }),
      };
    }

    // Find the status column (usually column R or S)
    // Assuming 'status' is in column R (18th column, index 17)
    const statusColumn = 'R'; // Adjust if your status column is different
    const range = `${BIDS_TAB}!${statusColumn}${rowIndex}`;

    // Update the status
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[status]],
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: `Bid ${bidId} marked as ${status}` 
      }),
    };
  } catch (error) {
    console.error('Error updating bid status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update bid status' }),
    };
  }
};