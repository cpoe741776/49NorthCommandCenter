// netlify/functions/publishSocialPost.js
// Publishes a single social post (manual trigger from the UI).
// Platform publishing logic lives in _utils/socialPostPublisher.js

const { google } = require('googleapis');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');
const { publishToPlatform } = require('./_utils/socialPostPublisher');

const SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const SHEET_TAB = 'MainPostData';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON body');

  const postId = body?.postId;
  let postData = body?.postData;

  try {
    const auth = getGoogleAuth();
    await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Load from sheet if postData not provided inline
    let rowIndex = null;
    if (!postData) {
      if (!postId) return bad(headers, 'postId is required when postData is not supplied');

      const rowsResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A2:R`,
      });
      const rows = rowsResp.data.values || [];
      const row = rows.find(r => r[0] === postId);
      if (!row) return ok(headers, { success: false, error: 'Post not found' });

      postData = {
        postId:        row[0],
        status:        row[1],
        contentType:   row[2],
        title:         row[3],
        body:          row[4],
        imageUrl:      row[5],
        videoUrl:      row[6],
        platforms:     row[7],
        scheduleDate:  row[8],
        publishedDate: row[9],
        tags:          row[17],
      };
      rowIndex = await findRowIndexById(sheets, postId);
    }

    const platforms = String(postData.platforms || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    if (!platforms.length) return bad(headers, 'No target platforms provided');

    // Publish to each platform (errors are captured per-platform, not thrown)
    const results = {};
    for (const platform of platforms) {
      try {
        results[platform.toLowerCase()] = await publishToPlatform(platform, postData);
      } catch (e) {
        console.error(`[publishSocialPost] ${platform} error:`, e.message);
        results[platform.toLowerCase()] = { error: e.message || 'publish failed' };
      }
    }

    // Write results back to sheet
    const finalRowIndex = rowIndex ?? await findRowIndexById(sheets, postId || postData.postId);
    if (finalRowIndex) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: buildSheetUpdateData(SHEET_TAB, finalRowIndex, results),
        },
      });
    }

    return ok(headers, { success: true, results });
  } catch (e) {
    console.error('[publishSocialPost] Fatal:', e);
    return serverErr(headers);
  }
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function findRowIndexById(sheets, postId) {
  if (!postId) return null;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A2:A`,
  });
  const rows = resp.data.values || [];
  const idx = rows.findIndex(r => r[0] === postId);
  return idx >= 0 ? idx + 2 : null;
}

function buildSheetUpdateData(tab, rowIndex, results) {
  return [
    { range: `${tab}!B${rowIndex}`, values: [['Published']] },
    { range: `${tab}!J${rowIndex}`, values: [[new Date().toISOString()]] },
    { range: `${tab}!K${rowIndex}`, values: [[results.website?.permalink || '']] },
    { range: `${tab}!L${rowIndex}`, values: [[results.facebook?.postId || '']] },
    { range: `${tab}!M${rowIndex}`, values: [[results.linkedin?.postId || '']] },
    { range: `${tab}!N${rowIndex}`, values: [[results.website?.postId || '']] },
    { range: `${tab}!O${rowIndex}`, values: [[results.email?.campaignId || '']] },
    { range: `${tab}!P${rowIndex}`, values: [[JSON.stringify(results)]] },
  ];
}

module.exports.buildSheetUpdateData = buildSheetUpdateData;
