const { google } = require('googleapis');
const { Readable } = require('stream');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

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
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
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
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // Parse request body
    const { fileName, fileData, category, notes } = JSON.parse(event.body);

    // Decode base64 file data
    const buffer = Buffer.from(fileData, 'base64');
    const fileStream = Readable.from(buffer);

    // Upload to Google Drive
    const fileMetadata = {
      name: fileName,
      parents: [FOLDER_ID]
    };

    const media = {
      mimeType: 'application/pdf', // Adjust based on file type
      body: fileStream
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, size, webViewLink'
    });

    const fileId = driveResponse.data.id;
    const fileSize = driveResponse.data.size;
    const webLink = driveResponse.data.webViewLink;

    // Make file accessible (anyone with link can view)
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Generate document ID
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const docId = `DOC-${timestamp}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Add to Google Sheet
    const fileType = fileName.split('.').pop().toUpperCase();
    const uploadDate = new Date().toISOString().slice(0, 10);
    const fileSizeFormatted = `${(fileSize / 1024).toFixed(0)} KB`;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'CompanyDocuments!A:I',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          docId,
          category || 'Uncategorized',
          fileName,
          fileType,
          uploadDate,
          fileId,
          webLink,
          fileSizeFormatted,
          notes || ''
        ]]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        document: {
          id: docId,
          fileName,
          driveLink: webLink,
          fileId
        }
      })
    };

  } catch (error) {
    console.error('Error uploading document:', error);
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