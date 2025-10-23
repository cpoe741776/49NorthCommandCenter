// netlify/functions/populateReminderTracking.js
// Automatically populates ReminderTracking tab based on upcoming webinars

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, serverErr } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;
const SOCIAL_SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    console.log('[PopulateReminderTracking] Starting automatic reminder population...');
    console.log('[PopulateReminderTracking] WEBINAR_SHEET_ID:', WEBINAR_SHEET_ID ? 'configured' : 'missing');
    console.log('[PopulateReminderTracking] SOCIAL_SHEET_ID:', SOCIAL_SHEET_ID ? 'configured' : 'missing');

    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch upcoming webinars
    const webinarRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Webinars!A2:L'
    });

    const webinarRows = webinarRes.data.values || [];
    const now = new Date();
    
    const upcomingWebinars = webinarRows
      .filter(r => {
        const webDate = new Date(r[2] + ' ' + (r[3] || '12:00'));
        return webDate > now;
      })
      .map(r => ({
        id: r[0],
        title: r[1],
        date: r[2],
        time: r[3]
      }));

    console.log('[PopulateReminderTracking] Found', upcomingWebinars.length, 'upcoming webinars');
    upcomingWebinars.forEach(w => {
      console.log(`[PopulateReminderTracking] Webinar: "${w.title}" (ID: ${w.id}) on ${w.date}`);
    });

    // Fetch existing reminder tracking entries
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SOCIAL_SHEET_ID,
      range: 'ReminderTracking!A2:L'
    }).catch(() => ({ data: { values: [] } }));

    const existingRows = existingRes.data.values || [];
    console.log('[PopulateReminderTracking] Found', existingRows.length, 'existing reminder entries');

    // Generate reminder entries for each upcoming webinar
    const newEntries = [];
    
    upcomingWebinars.forEach(webinar => {
      const webinarDate = new Date(webinar.date + ' ' + (webinar.time || '12:00'));
      const webinarId = webinar.id;
      
      // Calculate reminder dates
      const oneWeekDate = new Date(webinarDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneDayDate = new Date(webinarDate.getTime() - 24 * 60 * 60 * 1000);
      const oneHourDate = new Date(webinarDate.getTime() - 60 * 60 * 1000);

      // Check if entries already exist for this webinar
      const existingForWebinar = existingRows.filter(row => row[2] === webinarId);
      
      // Generate reminder types
      const reminderTypes = [
        { type: 'webinar-1week', dueDate: oneWeekDate, description: '1 week before webinar' },
        { type: 'webinar-social-1week', dueDate: oneWeekDate, description: '1 week social post' },
        { type: 'webinar-1day', dueDate: oneDayDate, description: '1 day before webinar' },
        { type: 'webinar-social-1day', dueDate: oneDayDate, description: '1 day social post' },
        { type: 'webinar-1hour', dueDate: oneHourDate, description: '1 hour before webinar' },
        { type: 'webinar-social-1hour', dueDate: oneHourDate, description: '1 hour social post' }
      ];

      reminderTypes.forEach(reminder => {
        // Check if this specific reminder already exists
        const exists = existingForWebinar.some(row => row[1] === reminder.type);
        
        if (!exists) {
          const status = now > reminder.dueDate ? 'overdue' : 'pending';
          
          newEntries.push([
            '', // A: Reminder ID (auto-generated)
            reminder.type, // B: Reminder Type
            webinarId, // C: Target ID (Webinar ID)
            webinarDate.toISOString().split('T')[0], // D: Target Date (webinar date)
            status, // E: Status
            '', // F: Draft Created Date
            '', // G: Brevo Email ID
            '', // H: Brevo Dashboard Link
            '', // I: Social Post ID
            reminder.description, // J: Notes
            'system', // K: Created By
            new Date().toISOString() // L: Last Checked
          ]);
        }
      });
    });

    console.log('[PopulateReminderTracking] Generated', newEntries.length, 'new reminder entries');

    if (newEntries.length > 0) {
      // Append new entries to ReminderTracking tab
      await sheets.spreadsheets.values.append({
        spreadsheetId: SOCIAL_SHEET_ID,
        range: 'ReminderTracking!A:L',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newEntries },
      });

      console.log('[PopulateReminderTracking] Successfully added', newEntries.length, 'reminder entries');
    }

    return ok(headers, {
      success: true,
      message: `Successfully processed ${upcomingWebinars.length} webinars`,
      newEntriesAdded: newEntries.length,
      webinarsProcessed: upcomingWebinars.map(w => ({
        id: w.id,
        title: w.title,
        date: w.date,
        remindersGenerated: 6
      }))
    });

  } catch (error) {
    console.error('[PopulateReminderTracking] Error:', error);
    return serverErr(headers, error.message);
  }
};
