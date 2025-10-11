const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;

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
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch CompanyDocuments
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'CompanyDocuments!A2:I',
    });

    const rows = response.data.values || [];

    const documents = rows.map((row, index) => ({
      id: row[0] || `DOC-${index + 1}`,
      category: row[1] || 'Uncategorized',
      documentName: row[2] || '',
      fileType: row[3] || '',
      uploadDate: row[4] || '',
      driveFileId: row[5] || '',
      driveLink: row[6] || '',
      fileSize: row[7] || '',
      notes: row[8] || ''
    }));

    // Group by category
    const grouped = documents.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = [];
      }
      acc[doc.category].push(doc);
      return acc;
    }, {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        documents,
        grouped,
        summary: {
          total: documents.length,
          categories: Object.keys(grouped).length
        }
      })
    };

  } catch (error) {
    console.error('Error fetching documents:', error);
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