// netlify/functions/deleteSocialPost.js
// Deletes a social media post from MainPostData sheet

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, bad, serverErr } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const SHEET_TAB = 'MainPostData';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'DELETE', 'OPTIONS');
  if (guard) return guard;

  try {
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const postId = url.searchParams.get('postId');

    if (!postId) {
      return bad(headers, 'postId parameter required');
    }

    console.log('[DeletePost] Deleting post:', postId);

    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Find the row with this postId
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A2:A`
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === postId);

    if (rowIndex === -1) {
      return bad(headers, 'Post not found');
    }

    const sheetRowNumber = rowIndex + 2; // A2 = row 2

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0, // Assuming MainPostData is the first sheet (ID 0)
              dimension: 'ROWS',
              startIndex: sheetRowNumber - 1, // 0-indexed
              endIndex: sheetRowNumber
            }
          }
        }]
      }
    });

    console.log('[DeletePost] Successfully deleted row', sheetRowNumber, 'for post', postId);

    return ok(headers, {
      success: true,
      message: 'Post deleted successfully',
      postId,
      rowNumber: sheetRowNumber
    });

  } catch (err) {
    console.error('[DeletePost] Error:', err);
    return serverErr(headers, err.message);
  }
};

