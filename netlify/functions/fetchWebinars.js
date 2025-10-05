const { google } = require('googleapis');

exports.handler = async () => {
  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.WEBINAR_SHEET_ID;

    // Fetch webinars - now reading A through L to get all columns
    const webinarResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Webinars!A2:L',
    });

    // Fetch surveys
    const surveyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Survey_Responses!A2:L',
    });

    const webinarRows = webinarResponse.data.values || [];
    const surveyRows = surveyResponse.data.values || [];

    // Map to your actual column order:
    // A: Webinar ID, B: Title, C: Date, D: Time, E: Platform Link
    // F: Registration Form URL, G: Status, H: Capacity, I: Registration Count
    // J: Attendance Count, K: Survey Link, L: Created Date
    const webinars = webinarRows.map((row, index) => ({
      id: row[0] || `webinar-${index}`,
      title: row[1] || '',
      date: row[2] || '',
      time: row[3] || '',
      platformLink: row[4] || '',
      registrationFormUrl: row[5] || '',
      status: row[6] || 'Upcoming',
      capacity: parseInt(row[7]) || 100,
      registrationCount: parseInt(row[8]) || 0,
      attendanceCount: parseInt(row[9]) || 0,
      surveyLink: row[10] || '',
    }));

    const surveys = surveyRows.map(row => ({
      timestamp: row[0] || '',
      email: row[1] || '',
      webinarId: row[2] || '',
      relevance: row[3] || '',
      rhonda: row[4] || '',
      chris: row[5] || '',
      guest: row[6] || '',
      sharing: row[7] || '',
      attending: row[8] || '',
      contactRequest: row[9] || '',
      comments: row[10] || '',
    }));

    const completedWebinars = webinars.filter(w => w.status === 'Completed');
    const upcomingWebinars = webinars.filter(w => w.status === 'Upcoming');

    const summary = {
      totalWebinars: webinars.length,
      completedCount: completedWebinars.length,
      upcomingCount: upcomingWebinars.length,
      totalRegistrations: webinars.reduce((sum, w) => sum + w.registrationCount, 0),
      totalAttendance: completedWebinars.reduce((sum, w) => sum + w.attendanceCount, 0),
      avgAttendance: completedWebinars.length > 0 
        ? Math.round(completedWebinars.reduce((sum, w) => sum + w.attendanceCount, 0) / completedWebinars.length)
        : 0,
      totalSurveys: surveys.length,
      surveyResponseRate: completedWebinars.reduce((sum, w) => sum + w.attendanceCount, 0) > 0
        ? Math.round((surveys.length / completedWebinars.reduce((sum, w) => sum + w.attendanceCount, 0)) * 100)
        : 0,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webinars, surveys, summary }),
    };
  } catch (error) {
    console.error('Error fetching webinars:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};