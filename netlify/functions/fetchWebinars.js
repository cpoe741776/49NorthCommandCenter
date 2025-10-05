const { google } = require('googleapis');

const SHEET_ID = '1EffYYNULGwN8QgUw4XUQkIG3FEVWg4Y2G0UZ87gDoDA';

exports.handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all necessary data
    const [webinarsRes, attendanceRes, surveysRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Webinars!A2:L1000',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Attendance!A2:G10000',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Survey_Responses!A2:K1000',
      })
    ]);

    const webinarRows = webinarsRes.data.values || [];
    const attendanceRows = attendanceRes.data.values || [];
    const surveyRows = surveysRes.data.values || [];

    // Parse webinars
    const webinars = webinarRows.map(row => ({
      id: row[0] || '',
      title: row[1] || '',
      date: row[2] || '',
      time: row[3] || '',
      platformLink: row[4] || '',
      registrationFormUrl: row[5] || '',
      status: row[6] || '',
      capacity: parseInt(row[7]) || 500,
      registrationCount: parseInt(row[8]) || 0,
      attendanceCount: parseInt(row[9]) || 0,
      surveyLink: row[10] || '',
      createdDate: row[11] || ''
    }));

    // Parse attendance details
    const attendance = attendanceRows.map(row => ({
      webinarId: row[0] || '',
      name: row[1] || '',
      email: row[2] || '',
      joinTime: row[3] || '',
      leaveTime: row[4] || '',
      duration: parseInt(row[5]) || 0,
      attended: row[6] || ''
    }));

    // Parse surveys
    const surveys = surveyRows.map(row => ({
      timestamp: row[0] || '',
      email: row[1] || '',
      webinarId: row[2] || '',
      relevance: row[3] || '',
      rhondaRating: row[4] || '',
      chrisRating: row[5] || '',
      guestRating: row[6] || '',
      sharing: row[7] || '',
      attending: row[8] || '',
      contactRequest: row[9] || '',
      comments: row[10] || ''
    }));

    // Calculate summary statistics
    const completedWebinars = webinars.filter(w => w.status === 'Completed');
    const upcomingWebinars = webinars.filter(w => w.status === 'Upcoming');
    
    const totalAttendance = completedWebinars.reduce((sum, w) => sum + w.attendanceCount, 0);
    const avgAttendance = completedWebinars.length > 0 
      ? Math.round(totalAttendance / completedWebinars.length) 
      : 0;

    const totalRegistrations = webinars.reduce((sum, w) => sum + w.registrationCount, 0);
    
    const linkedSurveys = surveys.filter(s => s.webinarId && s.webinarId.trim() !== '');
    const avgSurveyResponse = completedWebinars.length > 0
      ? Math.round((linkedSurveys.length / totalAttendance) * 100)
      : 0;

    const summary = {
      totalWebinars: webinars.length,
      completedCount: completedWebinars.length,
      upcomingCount: upcomingWebinars.length,
      totalAttendance,
      avgAttendance,
      totalRegistrations,
      totalSurveys: linkedSurveys.length,
      surveyResponseRate: avgSurveyResponse
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webinars,
        attendance,
        surveys,
        summary
      })
    };

  } catch (error) {
    console.error('Error fetching webinar data:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch webinar data',
        details: error.message 
      })
    };
  }
};