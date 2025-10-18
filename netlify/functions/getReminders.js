// netlify/functions/getReminders.js
// Returns current reminder status for webinars and weekly social posts

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, serverErr } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;
const SOCIAL_SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;

// In-memory cache (5 minute TTL)
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

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    // Check cache first
    const nowMs = Date.now();
    if (cache && (nowMs - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Reminders] Returning cached data (age: ' + Math.round((nowMs - cacheTimestamp) / 1000) + 's)');
      return ok(headers, { ...cache, cached: true });
    }

    console.log('[Reminders] Cache miss or expired, fetching fresh data...');
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getWeekNumber(now);

    // Fetch webinars
    const webinarRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Webinars!A2:L'
    });

    const webinarRows = webinarRes.data.values || [];
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
    const hasPost = (targetDate, purpose) => {
      const dateStr = targetDate.toISOString().split('T')[0];
      return socialPosts.some(post => {
        const postDate = new Date(post[0] || post[9] || 0); // timestamp or publishedDate
        const postDateStr = postDate.toISOString().split('T')[0];
        const postPurpose = post[18] || ''; // Column S (index 18)
        
        // Match date AND purpose
        return postDateStr === dateStr && postPurpose === purpose;
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

    const response = {
      success: true,
      webinarReminders,
      weeklyReminders,
      summary,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    cache = response;
    cacheTimestamp = Date.now();
    console.log('[Reminders] Data cached for 5 minutes');

    return ok(headers, response);

  } catch (e) {
    console.error('getReminders error:', e);
    return serverErr(headers, e.message);
  }
};

