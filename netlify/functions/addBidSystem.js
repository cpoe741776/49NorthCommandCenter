// netlify/functions/addBidSystem.js
const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;

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
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Parse the new system data
    const newSystem = JSON.parse(event.body);

    // Generate new System ID
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A:A',
    });
    const rowCount = (existingData.data.values || []).length;
    const newSystemId = `SYS${String(rowCount).padStart(3, '0')}`;

    const today = new Date().toISOString().split('T')[0];

    // Create row data in the correct order (A-T columns)
    const rowData = [
      newSystemId,                           // A: System ID
      newSystem.systemName || '',            // B: System Name
      newSystem.category || '',              // C: Category
      newSystem.status || 'Pending Registration', // D: Status
      newSystem.websiteUrl || '',            // E: Website URL
      newSystem.loginUrl || '',              // F: Login URL
      newSystem.username || '',              // G: Username
      newSystem.password || '',              // H: Password
      today,                                 // I: Registration Date
      '',                                    // J: Last Login Date
      newSystem.emailAlertsEnabled || 'No', // K: Email Alerts Enabled
      newSystem.alertEmailAddress || '',     // L: Alert Email Address
      newSystem.naicsCodes || '',            // M: NAICS Codes Monitored
      newSystem.geographicCoverage || '',    // N: Geographic Coverage
      newSystem.subscriptionType || 'Free',  // O: Subscription Type
      '',                                    // P: Renewal Date
      newSystem.annualCost || '$0',          // Q: Annual Cost
      newSystem.notes || '',                 // R: Notes
      today,                                 // S: Date Added
      today                                  // T: Last Updated
    ];

    // Append to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A:T',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        systemId: newSystemId,
        message: 'System added successfully'
      })
    };

  } catch (error) {
    console.error('Error adding bid system:', error);
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