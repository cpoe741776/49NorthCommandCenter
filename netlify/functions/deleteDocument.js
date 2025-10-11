const { google } = require('googleapis');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID || process.env.BID_SYSTEMS_SHEET_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    const { documentId, driveFileId } = JSON.parse(event.body);

    // Delete from Google Drive
    try {
      await drive.files.delete({
        fileId: driveFileId,
        supportsAllDrives: true
      });
      console.log('File deleted from Drive:', driveFileId);
    } catch (driveError) {
      console.warn('Drive delete failed (file may already be deleted):', driveError.message);
      // Continue to delete from sheet even if Drive delete fails
    }

    // Find and delete row from sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'CompanyDocuments!A:A',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Find the row with matching document ID
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === documentId) {
        rowIndex = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }

    if (rowIndex > 1) { // Row 1 is header, so must be > 1
      // Get sheet ID for CompanyDocuments tab
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
      });
      
      const companyDocsSheet = sheetMetadata.data.sheets.find(
        sheet => sheet.properties.title === 'CompanyDocuments'
      );
      
      const sheetId = companyDocsSheet ? companyDocsSheet.properties.sheetId : 0;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }]
        }
      });
      
      console.log('Row deleted from sheet:', rowIndex);
    } else {
      console.warn('Document not found in sheet:', documentId);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Document deleted from both Drive and sheet'
      })
    };

  } catch (error) {
    console.error('Error deleting document:', error);
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