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
    const { postId } = JSON.parse(event.body);
    
    if (!postId) {
      throw new Error('postId is required');
    }

    console.log('Publishing post:', postId);

    // Get post data from Google Sheets
    const postData = await getPostData(postId);
    
    if (!postData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Post not found' }),
      };
    }

    const results = {};
    const platforms = postData.platforms.split(',').map(p => p.trim()).filter(Boolean);

    console.log('Publishing to platforms:', platforms);

    // Publish to each platform
    for (const platform of platforms) {
      try {
        console.log(`Publishing to ${platform}...`);
        switch (platform) {
          case 'Facebook':
            results.facebook = await publishToFacebook(postData);
            break;
          case 'LinkedIn':
            results.linkedin = await publishToLinkedIn(postData);
            break;
          case 'Website':
            results.wordpress = await publishToWordPress(postData);
            break;
          case 'Email':
            results.brevo = await publishToBrevo(postData);
            break;
          default:
            console.log(`Unknown platform: ${platform}`);
        }
      } catch (error) {
        console.error(`Error publishing to ${platform}:`, error);
        results[platform.toLowerCase()] = { error: error.message };
      }
    }

    // Update post status in Google Sheets
    await updatePostStatus(postId, 'Published', results);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, results }),
    };
  } catch (error) {
    console.error('Error publishing post:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

async function getPostData(postId) {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'MainPostData!A2:R', // Change 'Sheet1' to your actual tab name
  });

  const rows = response.data.values || [];
  const post = rows.find(row => row[0] === postId);
  
  if (!post) return null;

  return {
    timestamp: post[0],
    status: post[1],
    contentType: post[2],
    title: post[3],
    body: post[4],
    imageUrl: post[5],
    videoUrl: post[6],
    platforms: post[7],
    tags: post[17]
  };
}

async function updatePostStatus(postId, status, results) {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SOCIAL_MEDIA_SHEET_ID;

  // Find row index for this postId
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'MainPostData!A2:A', // Change 'Sheet1' to your actual tab name
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === postId) + 2; // +2 for header and 0-index

  if (rowIndex < 2) {
    console.error('Could not find row for postId:', postId);
    return;
  }

  console.log(`Updating row ${rowIndex} with status: ${status}`);

  // Update the entire row with new data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `MainPostData!B${rowIndex}:P${rowIndex}`, // Change 'Sheet1' to your actual tab name
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[
        status,                                     // B: status
        '',                                         // C: contentType (unchanged)
        '',                                         // D: title (unchanged)
        '',                                         // E: body (unchanged)
        '',                                         // F: imageUrl (unchanged)
        '',                                         // G: videoUrl (unchanged)
        '',                                         // H: platforms (unchanged)
        '',                                         // I: scheduleDate (unchanged)
        new Date().toISOString(),                   // J: publishedDate
        results.wordpress?.permalink || '',         // K: postPermalink
        results.facebook?.postId || '',             // L: facebookPostId
        results.linkedin?.postId || '',             // M: linkedInPostId
        results.wordpress?.postId || '',            // N: wordPressPostId
        results.brevo?.campaignId || '',            // O: brevoEmailId
        JSON.stringify(results)                     // P: analytics
      ]]
    }
  });
}

// Platform publishing functions
async function publishToFacebook(postData) {
  const FB_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  
  if (!FB_TOKEN || !FB_PAGE_ID) {
    throw new Error('Facebook credentials not configured');
  }

  const payload = {
    message: `${postData.title}\n\n${postData.body}`,
    access_token: FB_TOKEN
  };

  if (postData.imageUrl) {
    payload.link = postData.imageUrl;
  }

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook API error: ${error}`);
  }

  const result = await response.json();
  console.log('Facebook publish result:', result);
  return { postId: result.id };
}

async function publishToLinkedIn(postData) {
  const LI_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
  const LI_ORN = 'urn:li:organization:107582691';

  if (!LI_TOKEN) {
    throw new Error('LinkedIn token not configured');
  }

  const payload = {
    author: LI_ORN,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: `${postData.title}\n\n${postData.body}`
        },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LI_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn API error: ${error}`);
  }

  const result = await response.json();
  console.log('LinkedIn publish result:', result);
  return { postId: result.id };
}

async function publishToWordPress(postData) {
  const WP_USER = process.env.WP_USERNAME;
  const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
  const WP_URL = 'https://mymentalarmor.com/wp-json/wp/v2/posts';

  if (!WP_USER || !WP_PASS) {
    throw new Error('WordPress credentials not configured');
  }

  const payload = {
    title: postData.title,
    content: postData.body,
    status: 'publish'
  };

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

  const response = await fetch(WP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress API error: ${error}`);
  }

  const result = await response.json();
  console.log('WordPress publish result:', result);
  return { postId: result.id, permalink: result.link };
}

async function publishToBrevo(postData) {
  const BREVO_KEY = process.env.BREVO_API_KEY;
  const BREVO_URL = 'https://api.brevo.com/v3/emailCampaigns';

  if (!BREVO_KEY) {
    throw new Error('Brevo API key not configured');
  }

  const payload = {
    name: `Campaign: ${postData.title}`,
    subject: postData.title,
    sender: {
      name: process.env.BREVO_SENDER_NAME || '49 North',
      email: process.env.BREVO_SENDER_EMAIL
    },
    htmlContent: `<h1>${postData.title}</h1><p>${postData.body}</p>`,
    status: 'draft'
  };

  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error: ${error}`);
  }

  const result = await response.json();
  console.log('Brevo publish result:', result);
  return { campaignId: result.id };
}