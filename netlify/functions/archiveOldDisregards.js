// netlify/functions/archiveOldDisregards.js
// Archives disregarded emails older than threshold to Disregarded_Archive tab

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const { daysThreshold = 90 } = JSON.parse(event.body || '{}');
    
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return ok(headers, { success: false, error: 'GOOGLE_SHEET_ID not configured' });
    }

    // Get disregarded emails
    const disregardRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Disregarded!A2:U'
    });

    const rows = disregardRes.data.values || [];
    const now = new Date();
    
    // Filter rows older than threshold
    const toArchive = [];
    const toKeep = [];
    
    rows.forEach((row, idx) => {
      const dateAdded = new Date(row[18] || 0); // Column S: Date Added
      const daysOld = (now - dateAdded) / (1000 * 60 * 60 * 24);
      
      if (daysOld > daysThreshold) {
        toArchive.push({ row, rowIndex: idx + 2 }); // +2 for header and 0-index
      } else {
        toKeep.push(row);
      }
    });

    if (toArchive.length === 0) {
      return ok(headers, { success: true, archived: 0, message: 'No emails to archive' });
    }

    console.log(`[ArchiveDisregards] Archiving ${toArchive.length} emails older than ${daysThreshold} days`);

    // Append to Disregarded_Archive tab
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Disregarded_Archive!A:U',
        valueInputOption: 'USER_ENTERED',
        resource: { values: toArchive.map(item => item.row) }
      });
    } catch (err) {
      // If tab doesn't exist, create it by just appending (Sheets will create it)
      console.log('[ArchiveDisregards] Creating Disregarded_Archive tab...');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Disregarded_Archive!A:U',
        valueInputOption: 'USER_ENTERED',
        resource: { values: toArchive.map(item => item.row) }
      });
    }

    // Clear and rewrite Disregarded tab with remaining rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Disregarded!A2:U'
    });

    if (toKeep.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Disregarded!A2:U',
        valueInputOption: 'USER_ENTERED',
        resource: { values: toKeep }
      });
    }

    console.log(`[ArchiveDisregards] Successfully archived ${toArchive.length} emails`);

    return ok(headers, {
      success: true,
      archived: toArchive.length,
      remaining: toKeep.length,
      message: `Archived ${toArchive.length} emails to Disregarded_Archive`
    });

  } catch (err) {
    console.error('[ArchiveDisregards] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

