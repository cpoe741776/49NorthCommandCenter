const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items } = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.TICKER_SHEET_ID;

    // Get all ticker items
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Ticker!A2:D',
    });

    const rows = response.data.values || [];
    
    // Find and delete auto-generated rows
    const updates = [];
    rows.forEach((row, index) => {
      if (row[3] === 'auto') { // source column
        updates.push({
          range: `Ticker!A${index + 2}:D${index + 2}`,
          values: [['', '', '', '']],
        });
      }
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: { data: updates, valueInputOption: 'RAW' },
      });
    }

    // Add new auto-generated items
    if (items.length > 0) {
      const newRows = items.map(item => [
        new Date().toISOString(),
        item.message,
        item.priority,
        'auto'
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Ticker!A2:D',
        valueInputOption: 'RAW',
        resource: { values: newRows },
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error refreshing ticker items:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};