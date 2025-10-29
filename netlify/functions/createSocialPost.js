// netlify/functions/createSocialPost.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }

  // Safe body parse
  let formData = {};
  try {
    formData = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON body' }) };
  }

  try {
    // Use shared credential loader
    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;
    if (!spreadsheetId) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'SOCIAL_MEDIA_SHEET_ID not configured' }) };
    }

    // Normalize platforms to a comma list (accept array or CSV string)
    const platforms = Array.isArray(formData.platforms)
      ? formData.platforms.map(p => String(p).trim()).filter(Boolean).join(',')
      : String(formData.platforms || '').split(',').map(p => p.trim()).filter(Boolean).join(',');

    // Tag handling (accept array or CSV)
    const tags = Array.isArray(formData.tags)
      ? formData.tags.map(t => String(t).trim()).filter(Boolean).join(',')
      : String(formData.tags || '').trim();

    // Use ISO timestamp as a stable postId (your other function looks rows up by A)
    const timestamp = new Date().toISOString();

    // Extract webinar data
    const webinarId = formData.webinarId || '';
    const webinarTitle = formData.webinarTitle || '';

    // Log webinar data for debugging (especially important for webinar posts)
    if (formData.purpose?.includes('webinar') || formData.contentType?.includes('webinar')) {
      console.log('[CreateSocialPost] Webinar post detected:', {
        purpose: formData.purpose,
        contentType: formData.contentType,
        webinarId,
        webinarTitle,
        hasWebinarId: !!webinarId,
        hasWebinarTitle: !!webinarTitle
      });
      
      if (!webinarId && (formData.purpose?.includes('webinar') || formData.contentType?.includes('webinar'))) {
        console.warn('[CreateSocialPost] WARNING: Webinar post missing webinarId! This will affect reminder tracking.');
      }
    }

    const row = [
      timestamp,                          // A timestamp (also acts as an ID in your flows)
      formData.status || 'Draft',         // B status
      formData.contentType || 'custom',   // C contentType
      formData.title || '',               // D title
      formData.body || '',                // E body
      formData.imageUrl || '',            // F imageUrl
      formData.videoUrl || '',            // G videoUrl
      platforms,                          // H platforms (CSV)
      formData.scheduleDate || '',        // I scheduleDate
      '',                                 // J publishedDate
      '',                                 // K postPermalink
      '',                                 // L facebookPostId
      '',                                 // M linkedInPostId
      '',                                 // N wordPressPostId
      '',                                 // O brevoEmailId
      '',                                 // P analytics
      formData.createdBy || 'system',     // Q createdBy
      tags,                               // R tags
      formData.purpose || 'general',      // S purpose (reminder tracking)
      webinarId,                          // T webinarId (for webinar posts)
      webinarTitle                        // U webinarTitle (for reference)
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'MainPostData!A:U',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Post created successfully', postId: timestamp }),
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
