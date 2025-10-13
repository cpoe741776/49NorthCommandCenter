const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const formData = JSON.parse(event.body);
    
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('SOCIAL_MEDIA_SHEET_ID not configured');
    }

    const row = [
      new Date().toISOString(),              // timestamp
      'Draft',                                // status
      formData.contentType || 'custom',       // contentType
      formData.title || '',                   // title
      formData.body || '',                    // body
      formData.imageUrl || '',                // imageUrl
      formData.videoUrl || '',                // videoUrl
      formData.platforms?.join(',') || '',    // platforms
      formData.scheduleDate || '',            // scheduleDate
      '',                                     // publishedDate
      '',                                     // postPermalink
      '',                                     // facebookPostId
      '',                                     // linkedInPostId
      '',                                     // wordPressPostId
      '',                                     // brevoEmailId
      '',                                     // analytics
      formData.createdBy || 'system',         // createdBy
      formData.tags || ''                     // tags
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'MainPostData!A:R', // Change 'Sheet1' to your actual tab name if different
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    console.log('Social post created successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Post created successfully' }),
    };
  } catch (error) {
    console.error('Error creating social post:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};