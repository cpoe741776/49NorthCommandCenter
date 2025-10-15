// netlify/functions/getWebinars.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=60, s-maxage=60'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const spreadsheetId = process.env.WEBINAR_SHEET_ID;
    if (!spreadsheetId) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, webinars: [], surveys: [], registrations: [], summary: { totalWebinars: 0, completedCount: 0, upcomingCount: 0, totalRegistrations: 0, totalAttendance: 0, avgAttendance: 0, totalSurveys: 0, surveyResponseRate: 0 } }) };
    }

    // service account creds (base64 or raw JSON)
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Ranges:
    // Webinars!A2:L (12 cols)
    // Survey_Responses!A2:L (12 cols)
    // Registrations!A2:F (6 cols)
    const [webinarResp, surveyResp, regResp] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Webinars!A2:L' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Survey_Responses!A2:L' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Registrations!A2:F' }),
    ]);

    const webinarRows = webinarResp.data.values || [];
    const surveyRows = surveyResp.data.values || [];
    const registrationRows = regResp.data.values || [];

    // Helpers
    const asInt = (v, d = 0) => {
      const n = parseInt(String(v ?? '').trim(), 10);
      return Number.isFinite(n) ? n : d;
    };
    const norm = (v) => (typeof v === 'string' ? v.trim() : (v ?? ''));

    // Map webinars (A..L)
    // A id | B title | C date | D time | E platformLink | F registrationFormUrl
    // G status | H capacity | I registrationCount | J attendanceCount | K surveyLink | L (optional/unused)
    const webinars = webinarRows.map((row, index) => ({
      id: norm(row[0] || `webinar-${index}`),
      title: norm(row[1]),
      date: norm(row[2]),
      time: norm(row[3]),
      platformLink: norm(row[4]),
      registrationFormUrl: norm(row[5]),
      status: norm(row[6]) || 'Upcoming',
      capacity: asInt(row[7], 100),
      registrationCount: asInt(row[8], 0),
      attendanceCount: asInt(row[9], 0),
      surveyLink: norm(row[10]),
      extra: norm(row[11]) // keep L if present; harmless for UI
    }));

    // Map surveys (A..L)
    const surveys = surveyRows.map((row) => ({
      timestamp: norm(row[0]),
      email: norm(row[1]),
      webinarId: norm(row[2]),
      relevance: norm(row[3]),
      rhonda: norm(row[4]),
      chris: norm(row[5]),
      guest: norm(row[6]),
      sharing: norm(row[7]),
      attending: norm(row[8]),
      contactRequest: norm(row[9]),
      comments: norm(row[10]),
      extra: norm(row[11])
    }));

    // Map registrations (A..F)
    // A Timestamp | B Webinar ID | C Name | D Email | E Organization | F Phone
    const registrations = registrationRows.map((row) => ({
      timestamp: norm(row[0]),
      webinarId: norm(row[1]),
      name: norm(row[2]),
      email: norm(row[3]),
      organization: norm(row[4]),
      phone: norm(row[5]),
    }));

    const completedWebinars = webinars.filter(w => w.status === 'Completed');
    const upcomingWebinars = webinars.filter(w => w.status === 'Upcoming');

    const totalAttendance = completedWebinars.reduce((sum, w) => sum + (w.attendanceCount || 0), 0);
    const avgAttendance = completedWebinars.length ? Math.round(totalAttendance / completedWebinars.length) : 0;

    const summary = {
      totalWebinars: webinars.length,
      completedCount: completedWebinars.length,
      upcomingCount: upcomingWebinars.length,
      totalRegistrations: webinars.reduce((sum, w) => sum + (w.registrationCount || 0), 0),
      totalAttendance,
      avgAttendance,
      totalSurveys: surveys.length,
      surveyResponseRate: totalAttendance > 0 ? Math.round((surveys.length / totalAttendance) * 100) : 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, webinars, surveys, registrations, summary }),
    };
  } catch (error) {
    console.error('getWebinars error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
