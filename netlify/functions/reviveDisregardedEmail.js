// reviveDisregardedEmail.js //
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

  try {
    const { rowNumber, newRecommendation, emailData } = JSON.parse(event.body);

    if (!rowNumber || !newRecommendation || !emailData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    if (!['Respond', 'Gather More Information'].includes(newRecommendation)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid recommendation' })
      };
    }

    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get sheet IDs
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID
    });
    
    const disregardedSheet = metadata.data.sheets.find(s => s.properties.title === 'Disregarded');
    const disregardedSheetId = disregardedSheet ? disregardedSheet.properties.sheetId : 0;

    // Step 1: Add to Active_Bids with new recommendation
    const activeBidRow = [
      newRecommendation,                    // A: Recommendation (NEW)
      emailData.scoreDetails,               // B: Score Details
      emailData.aiReasoning,                // C: AI Reasoning
      emailData.aiSummary,                  // D: AI Email Summary
      emailData.emailDateReceived,          // E: Email Date Received
      emailData.emailFrom,                  // F: Email From
      emailData.keywordsCategory,           // G: Keywords Category
      emailData.keywordsFound,              // H: Keywords Found
      emailData.relevance,                  // I: Relevance
      emailData.emailSubject,               // J: Email Subject
      emailData.emailBody,                  // K: Email Body
      emailData.url,                        // L: URL
      emailData.dueDate,                    // M: Due Date
      emailData.significantSnippet,         // N: Significant Snippet
      emailData.emailDomain,                // O: Email Domain
      emailData.bidSystem,                  // P: Bid System
      emailData.country,                    // Q: Country
      emailData.entity,                     // R: Entity/Agency
      'New',                                // S: Status (NEW)
      new Date().toISOString(),             // T: Date Added (NOW)
      emailData.sourceEmailId               // U: Source Email ID
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A:U',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [activeBidRow]
      }
    });

    // Step 2: Delete from Disregarded
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: disregardedSheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1, // 0-indexed
                endIndex: rowNumber         // exclusive
              }
            }
          }
        ]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: `Email moved to Active_Bids as "${newRecommendation}"`
      })
    };

  } catch (error) {
    console.error('Error reviving disregarded email:', error);
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