// netlify/functions/getReminders.js
// Returns current reminder status for webinars and weekly social posts
// OPTIONAL: ?includeExecutiveTasks=1 will also return executiveTasks from Secretary Tasks sheet
// Default behavior (no query param) is unchanged and remains cached.

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, serverErr } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');
const { getSecret } = require('./_utils/secrets');

const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;
const SOCIAL_SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;

// In-memory cache (5 minute TTL) — ONLY for default webinar/social payload
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Get ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDates(weekNumber, year) {
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  const weekStart = new Date(jan1.getTime() + daysOffset * 24 * 60 * 60 * 1000);

  // Adjust to Monday
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + diff);

  return {
    monday: new Date(weekStart),
    wednesday: new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
    friday: new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000)
  };
}

async function fetchExecutiveTasks(sheets) {
  const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
  if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID secret");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Tasks!A:Z"
  });

  const rows = res.data.values || [];
  if (!rows.length) return [];

  const [header, ...data] = rows;

  const idx = (name) => header.indexOf(name);
  const get = (row, key) => {
    const i = idx(key);
    return i >= 0 ? (row[i] ?? "") : "";
  };

  // Map into objects; tolerate missing columns (don’t break other modules)
  const tasks = data
    .map(row => ({
      id: String(get(row, "id") || "").trim(),
      createdAt: get(row, "createdAt"),
      createdBy: get(row, "createdBy"),
      rawText: get(row, "rawText"),
      title: get(row, "title"),
      contactEmail: get(row, "contactEmail"),
      notes: get(row, "notes"),
      dueAt: get(row, "dueAt"),
      tz: get(row, "tz"),
      recurrence: get(row, "recurrence"),
      priority: get(row, "priority"),
      status: get(row, "status"),
      lastNotifiedAt: get(row, "lastNotifiedAt"),
      notifyEveryMins: get(row, "notifyEveryMins")
    }))
    .filter(t => t.id && t.title); // keep it clean

  return tasks;
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  const includeExecutiveTasks =
    event?.queryStringParameters?.includeExecutiveTasks === "1" ||
    (event?.queryStringParameters?.includeExecutiveTasks || "").toLowerCase() === "true";

  try {
    // Cache only applies to the original payload (webinar/social),
    // and only when NOT asking for executive tasks.
    const nowMs = Date.now();
    if (!includeExecutiveTasks && cache && (nowMs - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Reminders] Returning cached data (age: ' + Math.round((nowMs - cacheTimestamp) / 1000) + 's)');
      return ok(headers, { ...cache, cached: true });
    }

    console.log('[Reminders] Cache miss or expired, fetching fresh data...');
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getWeekNumber(now);

    // Fetch webinars (gracefully handle quota / 429)
    let webinarRows = [];
    try {
      const webinarRes = await sheets.spreadsheets.values.get({
        spreadsheetId: WEBINAR_SHEET_ID,
        range: 'Webinars!A2:L'
      });
      webinarRows = webinarRes.data.values || [];
    } catch (err) {
      const status = err?.status || err?.code || err?.response?.status;
      if (status === 429) {
        console.error('[Reminders] Webinar sheet quota exceeded (429):', err.message);
        webinarRows = [];
      } else {
        throw err;
      }
    }

    const upcomingWebinars = webinarRows
      .filter(r => {
        const webDate = new Date(r[2] + ' ' + (r[3] || '12:00'));
        return webDate > now;
      })
      .map(r => ({
        id: r[0],
        title: r[1],
        date: r[2],
        time: r[3],
        registrationFormUrl: r[5],
        platformLink: r[4]
      }));

    console.log('[Reminders] Found', upcomingWebinars.length, 'upcoming webinars');
    upcomingWebinars.forEach(w => {
      const webDate = new Date(w.date + ' ' + (w.time || '12:00'));
      const oneWeekBefore = new Date(webDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      console.log(
        `[Reminders] Webinar "${w.title}" on ${w.date} - 1 week reminder due: ${oneWeekBefore.toISOString().split('T')[0]} (today: ${now.toISOString().split('T')[0]})`
      );
    });

    // Fetch reminder tracking AND social posts (needed for purpose checking)
    let reminderRows = [];
    let socialPosts = [];
    if (SOCIAL_SHEET_ID) {
      try {
        const [reminderRes, socialRes] = await Promise.all([
          sheets.spreadsheets.values.get({
            spreadsheetId: SOCIAL_SHEET_ID,
            range: 'ReminderTracking!A2:L'
          }).catch(() => ({ data: { values: [] } })),
          sheets.spreadsheets.values.get({
            spreadsheetId: SOCIAL_SHEET_ID,
            range: 'MainPostData!A2:U'
          })
        ]);
        reminderRows = reminderRes.data.values || [];
        socialPosts = socialRes.data.values || [];
      } catch (err) {
        console.warn('Failed to fetch reminder/social data:', err.message);
      }
    }

    // Build webinar reminders status
    const webinarReminders = upcomingWebinars.map(webinar => {
      const webinarDate = new Date(webinar.date + ' ' + (webinar.time || '12:00'));

      const timings = {
        oneWeek: new Date(webinarDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        oneDay: new Date(webinarDate.getTime() - 24 * 60 * 60 * 1000),
        oneHour: new Date(webinarDate.getTime() - 60 * 60 * 1000)
      };

      const findReminder = (type) => {
        return reminderRows.find(r => r[2] === webinar.id && r[1] === `webinar-${type}`);
      };

      const findSocialReminder = (type) => {
        return reminderRows.find(r => r[2] === webinar.id && r[1] === `webinar-social-${type}`);
      };

      // Check if webinar social post exists in MainPostData by purpose AND webinarId
      const hasWebinarPost = (purpose) => {
        return socialPosts.some(post => {
          const postPurpose = post[18] || ''; // Column S
          const postWebinarId = post[19] || ''; // Column T
          return postPurpose === purpose && postWebinarId === webinar.id;
        });
      };

      const oneWeekReminder = findReminder('1week');
      const oneDayReminder = findReminder('1day');
      const oneHourReminder = findReminder('1hour');

      const oneWeekSocialReminder = findSocialReminder('1week');
      const oneDaySocialReminder = findSocialReminder('1day');
      const oneHourSocialReminder = findSocialReminder('1hour');

      // Debug logging for this webinar
      console.log(`[Reminders] Webinar "${webinar.title}" (${webinar.id}):`);
      console.log(`  - 1 week reminder due: ${timings.oneWeek.toISOString().split('T')[0]}`);
      console.log(
        `  - 1 week reminder status: ${
          oneWeekReminder ? oneWeekReminder[4] : (now > timings.oneWeek ? 'overdue' : 'pending')
        }`
      );
      console.log(
        `  - 1 week social status: ${
          hasWebinarPost('webinar-1week') ? 'posted' : (now > timings.oneWeek ? 'overdue' : 'pending')
        }`
      );

      return {
        webinarId: webinar.id,
        webinarTitle: webinar.title,
        webinarDate: webinar.date,
        webinarTime: webinar.time,
        reminders: {
          oneWeek: {
            dueDate: timings.oneWeek.toISOString(),
            status: oneWeekReminder ? oneWeekReminder[4] : (now > timings.oneWeek ? 'overdue' : 'pending'),
            campaignId: oneWeekReminder ? oneWeekReminder[6] : null,
            dashboardLink: oneWeekReminder ? oneWeekReminder[7] : null,
            isPast: now > timings.oneWeek
          },
          oneDay: {
            dueDate: timings.oneDay.toISOString(),
            status: oneDayReminder ? oneDayReminder[4] : (now > timings.oneDay ? 'overdue' : 'pending'),
            campaignId: oneDayReminder ? oneDayReminder[6] : null,
            dashboardLink: oneDayReminder ? oneDayReminder[7] : null,
            isPast: now > timings.oneDay
          },
          oneHour: {
            dueDate: timings.oneHour.toISOString(),
            status: oneHourReminder ? oneHourReminder[4] : (now > timings.oneHour ? 'overdue' : 'pending'),
            campaignId: oneHourReminder ? oneHourReminder[6] : null,
            dashboardLink: oneHourReminder ? oneHourReminder[7] : null,
            isPast: now > timings.oneHour
          }
        },
        socialReminders: {
          oneWeek: {
            dueDate: timings.oneWeek.toISOString(),
            status: hasWebinarPost('webinar-1week') ? 'posted' : (now > timings.oneWeek ? 'overdue' : 'pending'),
            postId: oneWeekSocialReminder ? oneWeekSocialReminder[8] : null,
            isPast: now > timings.oneWeek
          },
          oneDay: {
            dueDate: timings.oneDay.toISOString(),
            status: hasWebinarPost('webinar-1day') ? 'posted' : (now > timings.oneDay ? 'overdue' : 'pending'),
            postId: oneDaySocialReminder ? oneDaySocialReminder[8] : null,
            isPast: now > timings.oneDay
          },
          oneHour: {
            dueDate: timings.oneHour.toISOString(),
            status: hasWebinarPost('webinar-1hour') ? 'posted' : (now > timings.oneHour ? 'overdue' : 'pending'),
            postId: oneHourSocialReminder ? oneHourSocialReminder[8] : null,
            isPast: now > timings.oneHour
          }
        }
      };
    });

    // Calculate week dates for weekly reminder checks
    const weekDates = getWeekDates(currentWeek, currentYear);

    // Check if posts exist for Mon/Wed/Fri this week by PURPOSE
    // Allow posts created within the same week (not just exact day)
    const hasPost = (targetDate, purpose) => {
      const targetWeek = getWeekNumber(targetDate);
      const targetYear = targetDate.getFullYear();

      return socialPosts.some(post => {
        const postDate = new Date(post[0] || post[9] || 0); // timestamp or publishedDate
        const postPurpose = post[18] || ''; // Column S (index 18)
        const postWeek = getWeekNumber(postDate);
        const postYear = postDate.getFullYear();

        // Match purpose AND same week (allows posting Monday content on Tuesday, etc.)
        return postPurpose === purpose && postWeek === targetWeek && postYear === targetYear;
      });
    };

    const weeklyReminders = {
      currentWeek: `${currentYear}-W${String(currentWeek).padStart(2, '0')}`,
      monday: {
        date: weekDates.monday.toISOString().split('T')[0],
        status: hasPost(weekDates.monday, 'weekly-monday') ? 'posted' : (now > weekDates.monday ? 'missing' : 'upcoming'),
        overdue: now > weekDates.monday && !hasPost(weekDates.monday, 'weekly-monday'),
        daysUntil: Math.ceil((weekDates.monday - now) / (24 * 60 * 60 * 1000))
      },
      wednesday: {
        date: weekDates.wednesday.toISOString().split('T')[0],
        status: hasPost(weekDates.wednesday, 'weekly-wednesday') ? 'posted' : (now > weekDates.wednesday ? 'missing' : 'upcoming'),
        overdue: now > weekDates.wednesday && !hasPost(weekDates.wednesday, 'weekly-wednesday'),
        daysUntil: Math.ceil((weekDates.wednesday - now) / (24 * 60 * 60 * 1000))
      },
      friday: {
        date: weekDates.friday.toISOString().split('T')[0],
        status: hasPost(weekDates.friday, 'weekly-friday') ? 'posted' : (now > weekDates.friday ? 'missing' : 'upcoming'),
        overdue: now > weekDates.friday && !hasPost(weekDates.friday, 'weekly-friday'),
        daysUntil: Math.ceil((weekDates.friday - now) / (24 * 60 * 60 * 1000))
      }
    };

    const summary = {
      totalWebinarReminders: webinarReminders.reduce((sum, w) => {
        return sum +
          (w.reminders.oneWeek.status === 'pending' || w.reminders.oneWeek.status === 'overdue' ? 1 : 0) +
          (w.reminders.oneDay.status === 'pending' || w.reminders.oneDay.status === 'overdue' ? 1 : 0) +
          (w.reminders.oneHour.status === 'pending' || w.reminders.oneHour.status === 'overdue' ? 1 : 0);
      }, 0),
      overdueWebinarEmails: webinarReminders.reduce((sum, w) => {
        return sum +
          (w.reminders.oneWeek.status === 'overdue' ? 1 : 0) +
          (w.reminders.oneDay.status === 'overdue' ? 1 : 0) +
          (w.reminders.oneHour.status === 'overdue' ? 1 : 0);
      }, 0),
      overdueWebinarSocialPosts: webinarReminders.reduce((sum, w) => {
        return sum +
          (w.socialReminders.oneWeek.status === 'overdue' ? 1 : 0) +
          (w.socialReminders.oneDay.status === 'overdue' ? 1 : 0) +
          (w.socialReminders.oneHour.status === 'overdue' ? 1 : 0);
      }, 0),
      missingSocialPosts: [
        weeklyReminders.monday.overdue ? 'Monday' : null,
        weeklyReminders.wednesday.overdue ? 'Wednesday' : null,
        weeklyReminders.friday.overdue ? 'Friday' : null
      ].filter(Boolean),
      upcomingSocialPosts: [
        weeklyReminders.monday.status === 'upcoming' ? 'Monday' : null,
        weeklyReminders.wednesday.status === 'upcoming' ? 'Wednesday' : null,
        weeklyReminders.friday.status === 'upcoming' ? 'Friday' : null
      ].filter(Boolean),
      totalPending: 0 // Will be calculated below
    };

    // Calculate total pending (emails + weekly social + webinar social)
    summary.totalPending = summary.overdueWebinarEmails + summary.missingSocialPosts.length + summary.overdueWebinarSocialPosts;

    // Optional: Executive Assistant tasks
    let executiveTasks;
    let executiveTasksError;

    if (includeExecutiveTasks) {
      try {
        executiveTasks = await fetchExecutiveTasks(sheets);
      } catch (err) {
        console.warn("[Reminders] Executive tasks fetch failed:", err.message);
        executiveTasks = [];
        executiveTasksError = err.message;
      }
    }

    const response = {
      success: true,
      webinarReminders,
      weeklyReminders,
      summary,
      timestamp: new Date().toISOString(),
      ...(includeExecutiveTasks ? { executiveTasks, executiveTasksError } : {})
    };

    // Cache only the original payload (no executive tasks)
    if (!includeExecutiveTasks) {
      cache = response;
      cacheTimestamp = Date.now();
      console.log('[Reminders] Data cached for 5 minutes');
    }

    return ok(headers, response);

  } catch (e) {
    console.error('getReminders error:', e);
    return serverErr(headers, e.message);
  }
};
