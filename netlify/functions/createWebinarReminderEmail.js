// netlify/functions/createWebinarReminderEmail.js
const { google } = require('googleapis');
const { corsHeaders, methodGuard, safeJson, ok, bad, serverErr, checkAuth } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const WEBINAR_SHEET_ID = process.env.WEBINAR_SHEET_ID;
const SOCIAL_SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || '49 North';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_LIST_ID = process.env.BREVO_WEBINAR_LIST_ID || process.env.BREVO_LIST_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON');

  const { webinarId, timing } = body; // timing: '1week' | '1day' | '1hour'
  if (!webinarId || !timing) return bad(headers, 'webinarId and timing required');
  if (!['1week', '1day', '1hour'].includes(timing)) return bad(headers, 'Invalid timing');

  try {
    // Get webinar data
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const webinarRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WEBINAR_SHEET_ID,
      range: 'Webinars!A2:L'
    });

    const webinarRows = webinarRes.data.values || [];
    const webinar = webinarRows.find(r => r[0] === webinarId);
    
    if (!webinar) return bad(headers, 'Webinar not found');

    // Parse webinar data (A-L columns)
    const webinarData = {
      id: webinar[0],
      title: webinar[1] || 'Webinar',
      date: webinar[2] || '',
      time: webinar[3] || '',
      platformLink: webinar[4] || '',
      registrationFormUrl: webinar[5] || '',
      status: webinar[6] || '',
      capacity: webinar[7] || 100,
      registrationCount: webinar[8] || 0,
      attendanceCount: webinar[9] || 0,
      surveyLink: webinar[10] || '',
      createdDate: webinar[11] || ''
    };

    // Build email content
    const timingText = { '1week': '1 Week', '1day': '1 Day', '1hour': '1 Hour' }[timing];
    const emailSubject = `${timingText} Until: ${webinarData.title}`;
    
    const htmlContent = buildWebinarEmailHTML({
      timing: timingText,
      webinarTitle: webinarData.title,
      webinarDate: webinarData.date,
      webinarTime: webinarData.time,
      registrationUrl: webinarData.registrationFormUrl || webinarData.platformLink,
      // These would come from additional webinar metadata if you add those columns
      headlineHook: `Join us for ${webinarData.title}`,
      whatCovers: `This interactive session covers key resilience skills and mental armor techniques.`,
      whyMatters: `Building mental strength is critical for first responders and leaders facing high-stress environments.`,
      whoAttend: `First responders, healthcare professionals, educators, and organizational leaders.`,
      walkAway: `Practical resilience skills you can apply immediately.`,
      speakerBio: `Presented by the 49 North team of resilience experts.`
    });

    // Create Brevo draft campaign
    if (!BREVO_API_KEY) throw new Error('Brevo API key not configured');

    const brevoPayload = {
      name: `[WEBINAR - ${timingText}] ${webinarData.title}`,
      subject: emailSubject,
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL
      },
      htmlContent: htmlContent,
      recipients: BREVO_LIST_ID ? { listIds: [parseInt(BREVO_LIST_ID, 10)] } : undefined,
      inlineImageActivation: false
    };

    const brevoRes = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(brevoPayload)
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      throw new Error(`Brevo API error: ${errText}`);
    }

    const brevoData = await brevoRes.json();
    const campaignId = brevoData.id;
    const dashboardLink = `https://app.brevo.com/campaign/id/${campaignId}`;

    // Track in ReminderTracking tab
    const reminderRow = [
      `REM-${Date.now()}`,                          // A: reminderID
      `webinar-${timing}`,                          // B: reminderType
      webinarId,                                    // C: targetID
      new Date().toISOString(),                     // D: targetDate (when it triggered)
      'draft-created',                              // E: status
      new Date().toISOString(),                     // F: draftCreatedDate
      campaignId,                                   // G: brevoEmailID
      dashboardLink,                                // H: brevoDashboardLink
      '',                                           // I: socialPostID
      `${webinarData.registrationCount} registrants`, // J: notes
      'system',                                     // K: createdBy
      new Date().toISOString()                      // L: lastChecked
    ];

    if (SOCIAL_SHEET_ID) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SOCIAL_SHEET_ID,
          range: 'ReminderTracking!A:L',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [reminderRow] }
        });
      } catch (err) {
        console.warn('Failed to log reminder:', err.message);
      }
    }

    return ok(headers, {
      success: true,
      reminder: {
        id: reminderRow[0],
        type: reminderRow[1],
        webinarTitle: webinarData.title,
        timing: timingText,
        campaignId,
        dashboardLink
      }
    });

  } catch (e) {
    console.error('createWebinarReminderEmail error:', e);
    return serverErr(headers, e.message);
  }
};

// Helper to build HTML email
function buildWebinarEmailHTML(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #003049; color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; font-size: 18px; opacity: 0.9; }
    .content { padding: 30px; }
    .webinar-info { background: #f0f7ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #003049; }
    .webinar-info p { margin: 8px 0; }
    .section { margin: 25px 0; }
    .section h3 { color: #003049; margin-bottom: 10px; }
    .cta-button { display: inline-block; background: #003049; color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 30px 0; font-weight: bold; }
    .cta-button:hover { background: #004d66; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ ${data.timing} Until Your Webinar!</h1>
      <p>${data.webinarTitle}</p>
    </div>
    
    <div class="content">
      <div class="webinar-info">
        <p><strong>📅 Date:</strong> ${data.webinarDate}</p>
        <p><strong>🕐 Time:</strong> ${data.webinarTime} EDT</p>
        <p><strong>⏱️ Duration:</strong> Approximately 60 minutes</p>
      </div>
      
      <div class="section">
        <h2 style="color: #003049;">${data.headlineHook}</h2>
      </div>
      
      <div class="section">
        <h3>What This Session Covers:</h3>
        <p>${data.whatCovers}</p>
      </div>
      
      <div class="section">
        <h3>Why This Matters:</h3>
        <p>${data.whyMatters}</p>
      </div>
      
      <div class="section">
        <h3>Who Should Attend:</h3>
        <p>${data.whoAttend}</p>
      </div>
      
      <div class="section">
        <h3>What You'll Walk Away With:</h3>
        <p>${data.walkAway}</p>
      </div>
      
      <div class="section">
        <h3>About Your Presenter:</h3>
        <p>${data.speakerBio}</p>
      </div>
      
      <center>
        <a href="${data.registrationUrl}" class="cta-button">
          🎯 ${data.timing === '1 Hour' ? 'Join Now' : 'Register Now'}
        </a>
      </center>
      
      <p style="margin-top: 40px; font-size: 14px; color: #666;">
        <strong>Add to Calendar:</strong> Don't forget to mark your calendar for ${data.webinarDate} at ${data.webinarTime} EDT
      </p>
    </div>
    
    <div class="footer">
      <p><strong>49 North | Mental Armor™ Training</strong></p>
      <p>Building resilience for first responders, healthcare professionals, and leaders</p>
      <p style="margin-top: 15px;">
        <a href="https://mymentalarmor.com" style="color: #003049;">Visit Our Website</a> | 
        <a href="https://mymentalarmor.com/mental-armor-skills/" style="color: #003049;">Mental Armor Skills</a>
      </p>
      <p style="margin-top: 15px; font-size: 11px;">
        Questions? Reply to this email or call us at your convenience.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

