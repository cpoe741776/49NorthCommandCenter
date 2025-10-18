// netlify/functions/cleanupOldData.js
// Cleans up old drafts, duplicates, and orphaned data

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const now = new Date();
    const DRAFT_THRESHOLD_DAYS = 30;
    
    let oldDraftsDeleted = 0;
    let duplicatesRemoved = 0;
    let orphanedReminders = 0;

    // 1. Delete old drafts from MainPostData
    if (process.env.SOCIAL_MEDIA_SHEET_ID) {
      try {
        const socialRes = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
          range: 'MainPostData!A2:U'
        });

        const rows = socialRes.data.values || [];
        const toKeep = [];
        
        rows.forEach(row => {
          const status = (row[1] || '').toLowerCase();
          const timestamp = new Date(row[0] || 0);
          const daysOld = (now - timestamp) / (1000 * 60 * 60 * 24);
          
          if (status === 'draft' && daysOld > DRAFT_THRESHOLD_DAYS) {
            oldDraftsDeleted++;
          } else {
            toKeep.push(row);
          }
        });

        if (oldDraftsDeleted > 0) {
          await sheets.spreadsheets.values.clear({
            spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
            range: 'MainPostData!A2:U'
          });

          if (toKeep.length > 0) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
              range: 'MainPostData!A2:U',
              valueInputOption: 'USER_ENTERED',
              resource: { values: toKeep }
            });
          }

          console.log(`[Cleanup] Deleted ${oldDraftsDeleted} old drafts`);
        }
      } catch (err) {
        console.warn('[Cleanup] Failed to clean drafts:', err.message);
      }
    }

    // 2. Clean up orphaned reminders
    if (process.env.SOCIAL_MEDIA_SHEET_ID && process.env.WEBINAR_SHEET_ID) {
      try {
        // Get all webinar IDs
        const webinarRes = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.WEBINAR_SHEET_ID,
          range: 'Webinars!A2:L'
        });
        const webinarIds = (webinarRes.data.values || []).map(r => r[0]);

        // Get reminder tracking
        const reminderRes = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
          range: 'ReminderTracking!A2:L'
        }).catch(() => ({ data: { values: [] } }));

        const reminderRows = reminderRes.data.values || [];
        const toKeep = [];

        reminderRows.forEach(row => {
          const targetId = row[2]; // Column C: Target ID
          const reminderType = row[1] || '';

          // Keep if not a webinar reminder, or if webinar still exists
          if (!reminderType.includes('webinar') || webinarIds.includes(targetId)) {
            toKeep.push(row);
          } else {
            orphanedReminders++;
          }
        });

        if (orphanedReminders > 0) {
          await sheets.spreadsheets.values.clear({
            spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
            range: 'ReminderTracking!A2:L'
          });

          if (toKeep.length > 0) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
              range: 'ReminderTracking!A2:L',
              valueInputOption: 'USER_ENTERED',
              resource: { values: toKeep }
            });
          }

          console.log(`[Cleanup] Removed ${orphanedReminders} orphaned reminders`);
        }
      } catch (err) {
        console.warn('[Cleanup] Failed to clean orphaned reminders:', err.message);
      }
    }

    // Note: Duplicate webinars are already handled by deduplication in getWebinars.js

    return ok(headers, {
      success: true,
      oldDraftsDeleted,
      duplicatesRemoved,
      orphanedReminders,
      message: `Cleanup complete: ${oldDraftsDeleted} drafts, ${duplicatesRemoved} duplicates, ${orphanedReminders} orphaned reminders`
    });

  } catch (err) {
    console.error('[Cleanup] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

