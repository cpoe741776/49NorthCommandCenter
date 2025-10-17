// netlify/functions/getSocialPosts.js
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
    // Credentials: support BASE64 or plain JSON
    const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      : process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!credJson) throw new Error('Missing Google service account credentials');

    const credentials = JSON.parse(credJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;
    if (!spreadsheetId) throw new Error('SOCIAL_MEDIA_SHEET_ID not configured');

    // Parse optional filters
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const statusFilter = (url.searchParams.get('status') || '').trim(); // e.g. Draft, Scheduled, Published
    const limitParam = parseInt(url.searchParams.get('limit') || '0', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'MainPostData!A2:R',
    });

    const rows = response.data.values || [];
    const posts = rows.map((row) => {
      const get = (i) => (row[i] ?? '').toString().trim();
      return {
        timestamp: get(0),
        status: get(1),
        contentType: get(2),
        title: get(3),
        body: get(4),
        imageUrl: get(5),
        videoUrl: get(6),
        platforms: get(7),
        scheduleDate: get(8),
        publishedDate: get(9),
        postPermalink: get(10),
        facebookPostId: get(11),
        linkedInPostId: get(12),
        wordPressPostId: get(13),
        brevoEmailId: get(14),
        analytics: get(15),
        createdBy: get(16),
        tags: get(17),
      };
    });

    // Optional filter by status
    const filtered = statusFilter
      ? posts.filter((p) => p.status.toLowerCase() === statusFilter.toLowerCase())
      : posts;

    // Sort by timestamp (desc), fallback to scheduleDate then publishedDate
    const toTime = (s) => {
      const t = Date.parse(s || '');
      return Number.isNaN(t) ? 0 : t;
    };
    filtered.sort((a, b) =>
      (toTime(b.timestamp) || toTime(b.scheduleDate) || toTime(b.publishedDate)) -
      (toTime(a.timestamp) || toTime(a.scheduleDate) || toTime(a.publishedDate))
    );

    const sliced = limit ? filtered.slice(0, limit) : filtered;

    // Calculate summary stats
    const summary = {
      totalPosts: posts.length,
      published: posts.filter(p => p.status.toLowerCase() === 'published').length,
      scheduled: posts.filter(p => p.status.toLowerCase() === 'scheduled').length,
      drafts: posts.filter(p => p.status.toLowerCase() === 'draft').length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: sliced.length, posts: sliced, summary }),
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
