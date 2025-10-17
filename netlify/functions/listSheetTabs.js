// netlify/functions/listAllSheets.js
const { google } = require('googleapis');

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
    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all spreadsheet IDs from environment variables
    const spreadsheetIds = {
      mainBids: process.env.GOOGLE_SHEET_ID,
      webinars: process.env.WEBINAR_SHEET_ID,
      companyData: process.env.COMPANY_DATA_SHEET_ID,
      bidSystems: process.env.BID_SYSTEMS_SHEET_ID
    };

    const results = {};

    // Fetch tabs for each spreadsheet
    for (const [name, id] of Object.entries(spreadsheetIds)) {
      if (!id) {
        results[name] = { error: 'Spreadsheet ID not configured' };
        continue;
      }

      try {
        const response = await sheets.spreadsheets.get({ spreadsheetId: id });
        results[name] = {
          spreadsheetId: id,
          title: response.data.properties.title,
          tabs: response.data.sheets.map(sheet => ({
            title: sheet.properties.title,
            sheetId: sheet.properties.sheetId,
            index: sheet.properties.index,
            rowCount: sheet.properties.gridProperties?.rowCount || 0,
            columnCount: sheet.properties.gridProperties?.columnCount || 0
          }))
        };
      } catch (err) {
        results[name] = { 
          error: err.message,
          spreadsheetId: id 
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        spreadsheets: results,
        timestamp: new Date().toISOString()
      }, null, 2)
    };

  } catch (error) {
    console.error('Error listing sheets:', error);
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