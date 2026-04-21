// netlify/functions/publishScheduledPosts.js
// Cron job: publishes scheduled social posts that are due.
// Platform publishing logic lives in _utils/socialPostPublisher.js

const { google } = require('googleapis');
const { loadServiceAccount } = require('./_utils/google');
const { publishToPlatform } = require('./_utils/socialPostPublisher');
const { buildSheetUpdateData } = require('./publishSocialPost');

const SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const SHEET_TAB = 'MainPostData';

exports.handler = async () => {
  console.log('[ScheduledPosts] Cron started at', new Date().toISOString());

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A2:U`,
    });

    const rows = response.data.values || [];
    const now = new Date();
    console.log('[ScheduledPosts]', rows.length, 'total rows — scanning for due posts');

    let publishedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2;
      const postId      = row[0];
      const status      = row[1];
      const scheduleDate = row[8];

      if (status !== 'Scheduled') continue;
      if (!scheduleDate) {
        console.warn('[ScheduledPosts] Post', postId, 'is Scheduled but has no scheduleDate');
        continue;
      }
      if (new Date(scheduleDate) > now) continue; // not yet time

      console.log('[ScheduledPosts] Publishing', postId, 'due at', scheduleDate);

      const postData = {
        postId,
        status,
        contentType:   row[2],
        title:         row[3],
        body:          row[4],
        imageUrl:      row[5],
        videoUrl:      row[6],
        platforms:     row[7],
        scheduleDate,
        publishedDate: row[9],
        tags:          row[17],
        purpose:       row[18],
        webinarId:     row[19],
      };

      const platforms = String(postData.platforms || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      if (!platforms.length) {
        console.warn('[ScheduledPosts] Post', postId, 'has no platforms — skipping');
        continue;
      }

      const results = {};
      for (const platform of platforms) {
        try {
          results[platform.toLowerCase()] = await publishToPlatform(platform, postData);
        } catch (e) {
          console.error(`[ScheduledPosts] ${platform} error for ${postId}:`, e.message);
          results[platform.toLowerCase()] = { error: e.message };
        }
      }

      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          valueInputOption: 'USER_ENTERED',
          requestBody: { data: buildSheetUpdateData(SHEET_TAB, rowIndex, results) },
        });
        publishedCount++;
        console.log('[ScheduledPosts] ✅ Published', postId, '→', Object.keys(results));
      } catch (updateErr) {
        errorCount++;
        console.error('[ScheduledPosts] ❌ Sheet update failed for', postId, ':', updateErr.message);
        // Log the error into column P so it's visible
        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!P${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[JSON.stringify({ error: updateErr.message, ts: now.toISOString() })]] },
          });
        } catch {}
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      totalChecked: rows.length,
      publishedCount,
      errorCount,
      message: publishedCount > 0 ? `Published ${publishedCount} post(s)` : 'No posts due',
    };
    console.log('[ScheduledPosts]', summary.message);
    return { statusCode: 200, body: JSON.stringify(summary) };

  } catch (err) {
    console.error('[ScheduledPosts] Fatal:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
