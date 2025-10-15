// getSystemAdminEmails.js //

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch Active_Admin sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active_Admin!A2:J', // 10 columns
    });

    const rows = response.data.values || [];

    const adminEmails = rows.map((row, index) => ({
      id: `admin-${index + 2}`,
      recommendation: row[0] || 'Systems Administration',
      emailDateReceived: row[1] || '',
      emailFrom: row[2] || '',
      emailSubject: row[3] || '',
      emailBody: row[4] || '',
      bidSystem: row[5] || 'Unknown',
      emailDomain: row[6] || '',
      dateAdded: row[7] || '',
      sourceEmailId: row[8] || '',
      status: row[9] || 'New'
    }));

    

    // Count only "New" status
    const newCount = adminEmails.filter(e => e.status === 'New').length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emails: adminEmails,
        count: adminEmails.length,
        newCount: newCount
      })
    };

  } catch (error) {
    console.error('Error fetching admin emails:', error);
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