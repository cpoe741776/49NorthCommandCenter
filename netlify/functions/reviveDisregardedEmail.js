// netlify/functions/reviveDisregardedEmail.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { rowNumber, newRecommendation, emailData } = JSON.parse(event.body || '{}');
    if (!rowNumber || !newRecommendation || !emailData) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing required fields' }) };
    }
    if (!['Respond', 'Gather More Information'].includes(newRecommendation)) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid recommendation' }) };
    }

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Build row in A..U order
    const nowIso = new Date().toISOString();
    const row = [
      newRecommendation || '',             // A: Recommendation
      emailData.scoreDetails || '',        // B: Score Details
      emailData.aiReasoning || '',         // C: AI Reasoning
      emailData.aiSummary || '',           // D: AI Email Summary
      emailData.emailDateReceived || '',   // E: Email Date Received
      emailData.emailFrom || '',           // F: Email From
      emailData.keywordsCategory || '',    // G: Keywords Category
      emailData.keywordsFound || '',       // H: Keywords Found
      emailData.relevance || '',           // I: Relevance
      emailData.emailSubject || '',        // J: Email Subject
      emailData.emailBody || '',           // K: Email Body
      emailData.url || '',                 // L: URL
      emailData.dueDate || '',             // M: Due Date
      emailData.significantSnippet || '',  // N: Significant Snippet
      emailData.emailDomain || '',         // O: Email Domain
      emailData.bidSystem || '',           // P: Bid System
      emailData.country || '',             // Q: Country
      emailData.entity || '',              // R: Entity/Agency
      'New',                               // S: Status
      nowIso,                              // T: Date Added
      emailData.sourceEmailId || ''        // U: Source Email ID
    ];

    // Append into Active_Bids (A:U)
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Active_Bids!A:U',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    // Delete from Disregarded
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const dis = (meta.data.sheets || []).find(s => s.properties.title === 'Disregarded');
    const disId = dis ? dis.properties.sheetId : null;
    if (disId == null) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Disregarded sheet not found' }) };
    }

    const r = parseInt(String(rowNumber), 10);
    if (!Number.isFinite(r) || r < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid rowNumber' }) };
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: disId, dimension: 'ROWS', startIndex: r - 1, endIndex: r }
          }
        }]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `Email moved to Active_Bids as "${newRecommendation}"` }),
    };
  } catch (error) {
    console.error('reviveDisregardedEmail error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
