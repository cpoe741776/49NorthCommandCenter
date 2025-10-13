const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('SOCIAL_MEDIA_SHEET_ID not configured');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'MainPostData!A2:R', // Skip header row, change 'Sheet1' to your actual tab name
    });

    const rows = response.data.values || [];
    const posts = rows.map(row => ({
      timestamp: row[0] || '',
      status: row[1] || '',
      contentType: row[2] || '',
      title: row[3] || '',
      body: row[4] || '',
      imageUrl: row[5] || '',
      videoUrl: row[6] || '',
      platforms: row[7] || '',
      scheduleDate: row[8] || '',
      publishedDate: row[9] || '',
      postPermalink: row[10] || '',
      facebookPostId: row[11] || '',
      linkedInPostId: row[12] || '',
      wordPressPostId: row[13] || '',
      brevoEmailId: row[14] || '',
      analytics: row[15] || '',
      createdBy: row[16] || '',
      tags: row[17] || ''
    }));

    // Sort by timestamp descending (newest first)
    posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, posts }),
    };
  } catch (error) {
    console.error('Error fetching social media content:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};