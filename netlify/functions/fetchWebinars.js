const { google } = require('googleapis');

exports.handler = async () => {
  try {
    // Decode Base64 key
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.WEBINAR_SHEET_ID;

    // Fetch webinars
    const webinarResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Webinars!A2:K',
    });

    // Fetch surveys
    const surveyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Surveys!A2:D',
    });

    const webinarRows = webinarResponse.data.values || [];
    const surveyRows = surveyResponse.data.values || [];

    const webinars = webinarRows.map((row, index) => ({
      id: row[0] || `webinar-${index}`,
      title: row[1] || '',
      date: row[2] || '',
      time: row[3] || '',
      status: row[4] || 'Upcoming',
      registrationCount: parseInt(row[5]) || 0,
      attendanceCount: parseInt(row[6]) || 0,
      capacity: parseInt(row[7]) || 100,
      platformLink: row[8] || '',
      registrationFormUrl: row[9] || '',
      surveyLink: row[10] || '',
    }));

    const surveys = surveyRows.map(row => ({
      webinarId: row[0] || '',
      submittedAt: row[1] || '',
      rating: parseInt(row[2]) || 0,
      feedback: row[3] || '',
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