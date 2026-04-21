// netlify/functions/postWebinarAutomation.js
// POST /postWebinarAutomation  { webinarId: string }
//
// After a webinar completes, this function:
//   1. Loads attendee, registration, and survey data from Google Sheets
//   2. Tags attendees in Brevo (ATTENDED_WEBINAR, WEBINAR_ID, counts)
//   3. Segments contacts: attended / no-show / survey-requested-contact
//   4. Creates a follow-up reminder task in CRM sheet for anyone who
//      requested contact
//   5. Creates a Brevo email campaign DRAFT for the follow-up message
//      (you review & send from the Brevo dashboard — no auto-blasting)
//   6. Returns a summary so you can see exactly what happened

const { google } = require('googleapis');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');
const { upsertContact, createCampaignDraft } = require('./_utils/brevo');

const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;
const CRM_SHEET_ID = process.env.CRM_SHEET_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr || !body?.webinarId) return bad(headers, 'webinarId is required');

  const { webinarId, dryRun = false } = body;
  console.log(`[PostWebinar] Starting automation for webinar ${webinarId}${dryRun ? ' (DRY RUN)' : ''}`);

  try {
    // ── 1. Load all webinar data in one batchGet ────────────────────────────
    const googleAuth = getGoogleAuth();
    await googleAuth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: WEBINAR_SHEET_ID,
      ranges: [
        'Webinars!A2:L',          // 0
        'Registrations!A2:F',      // 1
        'Attendance!A2:M',         // 2
        'Survey_Responses!A2:Z',   // 3
      ],
    });

    const [webinarRows, regRows, attRows, surveyRows] = batchRes.data.valueRanges.map(
      r => r.values || []
    );

    // ── 2. Find the webinar ─────────────────────────────────────────────────
    const webinar = webinarRows.find(r => r[0] === webinarId);
    if (!webinar) return ok(headers, { success: false, error: `Webinar ${webinarId} not found` });

    const webinarTitle  = webinar[1] || 'Mental Armor Webinar';
    const webinarDate   = webinar[2] || '';
    const webinarStatus = webinar[6] || '';
    const surveyLink    = webinar[10] || '';
    const platformLink  = webinar[4] || '';

    console.log(`[PostWebinar] Webinar: "${webinarTitle}" | Status: ${webinarStatus}`);

    // ── 3. Build contact lists ──────────────────────────────────────────────
    // All registrations for this webinar
    const registrants = regRows
      .filter(r => r[1] === webinarId)
      .map(r => ({
        timestamp:    r[0] || '',
        webinarId:    r[1] || '',
        name:         r[2] || '',
        email:        (r[3] || '').toLowerCase().trim(),
        organization: r[4] || '',
        phone:        r[5] || '',
      }))
      .filter(r => r.email);

    // All attendees for this webinar (email in col C, index 2 in Attendance sheet variant)
    const attendeeEmails = new Set(
      attRows
        .filter(r => r[1] === webinarId || r[0] === webinarId) // col A or B may hold webinarId
        .map(r => (r[3] || r[2] || '').toLowerCase().trim())   // email is col D or C
        .filter(Boolean)
    );

    // Survey respondents for this webinar
    const surveyByEmail = surveyRows
      .filter(r => r[2] === webinarId)
      .reduce((acc, r) => {
        const email = (r[1] || '').toLowerCase().trim();
        if (email) acc[email] = {
          contactRequest: r[9] || '',
          comments:       r[10] || '',
          relevance:      r[3] || '',
        };
        return acc;
      }, {});

    // Segment contacts
    const attended  = registrants.filter(r => attendeeEmails.has(r.email));
    const noShows   = registrants.filter(r => !attendeeEmails.has(r.email));
    const requestedContact = registrants.filter(r => {
      const survey = surveyByEmail[r.email];
      if (!survey) return false;
      const norm = survey.contactRequest.toLowerCase();
      return norm.includes('schedule') || norm.includes('meeting') || norm.includes('contact');
    });
    const requestedReminder = registrants.filter(r => {
      const survey = surveyByEmail[r.email];
      if (!survey) return false;
      const norm = survey.contactRequest.toLowerCase();
      return norm.includes('reminder') || norm.includes('3 month');
    });

    console.log(`[PostWebinar] Registrants: ${registrants.length} | Attended: ${attended.length} | No-shows: ${noShows.length} | Contact requests: ${requestedContact.length}`);

    // ── 4. Tag attendees in Brevo ───────────────────────────────────────────
    const brevoResults = { updated: [], failed: [] };

    if (!dryRun) {
      // Update each attendee's Brevo contact record in parallel (batches of 5)
      const BATCH = 5;
      for (let i = 0; i < attended.length; i += BATCH) {
        const batch = attended.slice(i, i + BATCH);
        await Promise.all(batch.map(async (contact) => {
          try {
            const survey = surveyByEmail[contact.email];
            await upsertContact(contact.email, {
              ATTENDED_WEBINAR: 'Yes',
              WEBINAR_ID: webinarId,
              WEBINAR_TOPIC: webinarTitle,
              // WEBINARS_ATTENDED_COUNT is incremented server-side in Brevo via attribute
              // We set it explicitly; getContacts will read the current value
              ...(survey?.contactRequest ? { WEB_CONTACT_REQ: survey.contactRequest } : {}),
              LAST_CHANGED: new Date().toISOString().split('T')[0],
            });
            brevoResults.updated.push(contact.email);
          } catch (err) {
            console.warn(`[PostWebinar] Brevo update failed for ${contact.email}:`, err.message);
            brevoResults.failed.push({ email: contact.email, error: err.message });
          }
        }));
      }

      // Mark no-shows (registered but didn't attend)
      for (let i = 0; i < noShows.length; i += BATCH) {
        const batch = noShows.slice(i, i + BATCH);
        await Promise.all(batch.map(async (contact) => {
          try {
            await upsertContact(contact.email, {
              ATTENDED_WEBINAR: 'No',
              WEBINAR_ID: webinarId,
              WEBINAR_TOPIC: webinarTitle,
              LAST_CHANGED: new Date().toISOString().split('T')[0],
            });
          } catch (err) {
            console.warn(`[PostWebinar] No-show Brevo update failed for ${contact.email}:`, err.message);
          }
        }));
      }
    }

    // ── 5. Create follow-up reminder tasks in CRM sheet ────────────────────
    const followUpTasksCreated = [];

    if (!dryRun && CRM_SHEET_ID && requestedContact.length > 0) {
      const followUpDate = getFollowUpDate(3); // 3 business days from now
      const taskRows = requestedContact.map(contact => {
        const survey = surveyByEmail[contact.email];
        return [
          `FU-${webinarId}-${contact.email.split('@')[0]}-${Date.now()}`, // taskId
          contact.email,
          contact.name,
          `Follow up with ${contact.name} from "${webinarTitle}" — requested contact via survey`,
          followUpDate,
          'Open',
          new Date().toISOString().split('T')[0], // createdDate
          `WebinarId: ${webinarId}`,
          survey?.comments ? `Comments: ${survey.comments.substring(0, 200)}` : '',
        ];
      });

      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: CRM_SHEET_ID,
          range: 'FollowUpTasks!A:I',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: taskRows },
        });
        followUpTasksCreated.push(...requestedContact.map(c => c.email));
        console.log(`[PostWebinar] Created ${taskRows.length} follow-up tasks`);
      } catch (err) {
        console.error('[PostWebinar] CRM task creation failed:', err.message);
      }
    }

    // ── 6. Create Brevo email campaign draft ───────────────────────────────
    let campaignDraft = null;

    if (!dryRun && attended.length > 0) {
      try {
        const htmlContent = buildFollowUpEmailHtml({
          webinarTitle,
          webinarDate,
          surveyLink,
          platformLink,
          attendeeCount: attended.length,
        });

        campaignDraft = await createCampaignDraft({
          name: `Post-Webinar Follow-up: ${webinarTitle} (${webinarDate})`,
          subject: `Thank you for attending "${webinarTitle}"`,
          htmlContent,
          // BREVO_ATTENDEE_LIST_ID should be a dedicated list for this webinar's attendees
          // Falls back to main list — review recipients before sending!
          listIds: [parseInt(process.env.BREVO_WEBINAR_LIST_ID || process.env.BREVO_LIST_ID || '108', 10)],
        });

        console.log(`[PostWebinar] Campaign draft created: ${campaignDraft.campaignId}`);
      } catch (err) {
        console.error('[PostWebinar] Campaign draft failed:', err.message);
        campaignDraft = { error: err.message };
      }
    }

    // ── 7. Return summary ───────────────────────────────────────────────────
    return ok(headers, {
      success: true,
      dryRun,
      webinar: { id: webinarId, title: webinarTitle, date: webinarDate },
      stats: {
        totalRegistrants:     registrants.length,
        attended:             attended.length,
        noShows:              noShows.length,
        surveyResponses:      Object.keys(surveyByEmail).length,
        requestedContact:     requestedContact.length,
        requestedReminder:    requestedReminder.length,
      },
      brevoUpdates: dryRun ? { preview: attended.map(c => c.email) } : brevoResults,
      followUpTasksCreated,
      emailCampaignDraft: campaignDraft,
      noShowList: noShows.map(c => ({ name: c.name, email: c.email, organization: c.organization })),
      contactRequestList: requestedContact.map(c => ({
        name: c.name,
        email: c.email,
        organization: c.organization,
        surveyComment: surveyByEmail[c.email]?.comments || '',
      })),
    });

  } catch (err) {
    console.error('[PostWebinar] Fatal error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFollowUpDate(businessDays) {
  const d = new Date();
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++; // skip weekends
  }
  return d.toISOString().split('T')[0];
}

function buildFollowUpEmailHtml({ webinarTitle, webinarDate, surveyLink, platformLink, attendeeCount }) {
  const senderName = process.env.BREVO_SENDER_NAME || '49 North';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.7; color: #333; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { color: #003049; font-size: 22px; }
    h2 { color: #003049; font-size: 18px; margin-top: 28px; }
    .cta {
      display: inline-block; margin: 16px 0; padding: 12px 24px;
      background: #003049; color: #fff !important; text-decoration: none;
      border-radius: 4px; font-weight: bold;
    }
    .highlight { background: #f0f7ff; border-left: 4px solid #003049; padding: 12px 16px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>Thank you for joining us!</h1>

  <p>Hi {{contact.FIRSTNAME}},</p>

  <p>
    Thank you for attending <strong>"${webinarTitle}"</strong>${webinarDate ? ` on ${webinarDate}` : ''}.
    We're glad you joined the ${attendeeCount} professionals who participated.
  </p>

  <div class="highlight">
    <strong>Mental Armor™</strong> provides evidence-based resilience and performance training
    for public safety, military, and organizational leaders. We're glad you're exploring
    how these skills can support your team.
  </div>

  <h2>What's Next?</h2>
  <ul>
    <li>🎯 <strong>Apply what you learned</strong> — start with one skill from today's session</li>
    <li>📅 <strong>Upcoming webinars</strong> — stay tuned for our next event</li>
    ${surveyLink ? `<li>📋 <strong>Share your feedback</strong> — <a href="${surveyLink}">complete a quick survey</a> so we can improve</li>` : ''}
    ${platformLink ? `<li>🔗 <strong>Recording / resources</strong> — <a href="${platformLink}">access session materials</a></li>` : ''}
  </ul>

  <h2>Want to Explore Further?</h2>
  <p>
    If your organization is looking to build resilience, reduce burnout, or develop leadership
    capacity, we'd love to connect.
  </p>
  <a class="cta" href="https://www.mymentalarmor.com">Learn More at mymentalarmor.com</a>

  <p>
    Feel free to reply to this email directly — I personally read every response.
  </p>

  <p>
    Warm regards,<br>
    <strong>${senderName}</strong><br>
    Community Development Director, 49 North / Mental Armor™
  </p>

  <div class="footer">
    <p>49 North | Mental Armor™ Training | <a href="https://www.mymentalarmor.com">www.mymentalarmor.com</a></p>
    <p>You received this because you registered for our webinar. <a href="{{unsubscribe}}">Unsubscribe</a></p>
  </div>
</body>
</html>`.trim();
}
