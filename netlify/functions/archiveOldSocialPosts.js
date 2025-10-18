// netlify/functions/archiveOldSocialPosts.js
// Archives published social posts older than threshold to MainPostData_Archive tab

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const { daysThreshold = 180 } = JSON.parse(event.body || '{}');
    
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;

    if (!spreadsheetId) {
      return ok(headers, { success: false, error: 'SOCIAL_MEDIA_SHEET_ID not configured' });
    }

    // Get social posts
    const socialRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'MainPostData!A2:U'
    });

    const rows = socialRes.data.values || [];
    const now = new Date();
    
    // Filter published posts older than threshold
    const toArchive = [];
    const toKeep = [];
    
    rows.forEach((row, idx) => {
      const status = (row[1] || '').toLowerCase();
      const publishedDate = new Date(row[9] || 0); // Column J: Published Date
      const daysOld = (now - publishedDate) / (1000 * 60 * 60 * 24);
      
      if (status === 'published' && daysOld > daysThreshold) {
        toArchive.push({ row, rowIndex: idx + 2 });
      } else {
        toKeep.push(row);
      }
    });

    if (toArchive.length === 0) {
      return ok(headers, { success: true, archived: 0, message: 'No posts to archive' });
    }

    console.log(`[ArchiveSocial] Archiving ${toArchive.length} posts older than ${daysThreshold} days`);

    // Append to MainPostData_Archive tab
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'MainPostData_Archive!A:U',
        valueInputOption: 'USER_ENTERED',
        resource: { values: toArchive.map(item => item.row) }
      });
    } catch (err) {
      // If tab doesn't exist, create it by appending
      console.log('[ArchiveSocial] Creating MainPostData_Archive tab...');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'MainPostData_Archive!A:U',
        valueInputOption: 'USER_ENTERED',
        resource: { values: toArchive.map(item => item.row) }
      });
    }

    // Clear and rewrite MainPostData with remaining rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'MainPostData!A2:U'
    });

    if (toKeep.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'MainPostData!A2:U',
        valueInputOption: 'USER_ENTERED',
        resource: { values: toKeep }
      });
    }

    console.log(`[ArchiveSocial] Successfully archived ${toArchive.length} posts`);

    return ok(headers, {
      success: true,
      archived: toArchive.length,
      remaining: toKeep.length,
      message: `Archived ${toArchive.length} posts to MainPostData_Archive`
    });

  } catch (err) {
    console.error('[ArchiveSocial] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

