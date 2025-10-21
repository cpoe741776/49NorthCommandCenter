// netlify/functions/publishScheduledPosts.js
// Automated cron job that publishes scheduled social media posts
// Runs every hour via Netlify scheduled functions

const { google } = require('googleapis');
const { loadServiceAccount } = require('./_utils/google');

const SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const SHEET_TAB = 'MainPostData';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FB_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const LI_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LI_ORG_URN = process.env.LINKEDIN_ORG_URN || 'urn:li:organization:107582691';
const WP_USER = process.env.WP_USERNAME;
const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
const WP_URL = process.env.WP_POSTS_URL || 'https://mymentalarmor.com/wp-json/wp/v2/posts';
const WP_BASE = WP_URL.replace('/wp-json/wp/v2/posts', '');

exports.handler = async (event, context) => {
  console.log('[ScheduledPosts] Cron job started at', new Date().toISOString());

  try {
    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all posts from MainPostData
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A2:U`
    });

    const rows = response.data.values || [];
    const now = new Date();

    console.log('[ScheduledPosts] Found', rows.length, 'total posts. Checking for scheduled posts...');

    let publishedCount = 0;
    let errorCount = 0;

    // Find and publish scheduled posts that are due
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // Sheet row number (A2 = row 2)

      const postId = row[0];
      const status = row[1];
      const scheduleDate = row[8]; // Column I

      // Skip if not scheduled
      if (status !== 'Scheduled') continue;

      // Skip if no schedule date
      if (!scheduleDate) {
        console.warn('[ScheduledPosts] Post', postId, 'has status Scheduled but no scheduleDate');
        continue;
      }

      // Check if it's time to publish
      const scheduledTime = new Date(scheduleDate);
      if (scheduledTime > now) {
        console.log('[ScheduledPosts] Post', postId, 'scheduled for', scheduleDate, '- not yet time');
        continue;
      }

      // Time to publish!
      console.log('[ScheduledPosts] Publishing post', postId, 'scheduled for', scheduleDate);

      const postData = {
        postId: row[0],
        status: row[1],
        contentType: row[2],
        title: row[3],
        body: row[4],
        imageUrl: row[5],
        videoUrl: row[6],
        platforms: row[7],
        scheduleDate: row[8],
        publishedDate: row[9],
        tags: row[17],
        purpose: row[18],
        webinarId: row[19]
      };

      try {
        // Parse target platforms
        const platforms = String(postData.platforms || '')
          .split(',')
          .map(p => p.trim())
          .filter(Boolean);

        if (platforms.length === 0) {
          console.warn('[ScheduledPosts] Post', postId, 'has no platforms');
          continue;
        }

        // Publish to each platform
        const results = {};
        for (const platform of platforms) {
          try {
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
                results[platform.toLowerCase()] = { error: `Unknown platform: ${platform}` };
            }
          } catch (e) {
            console.error(`[ScheduledPosts] ${platform} error:`, e.message);
            results[platform.toLowerCase()] = { error: e.message };
          }
        }

        // Update the sheet with publish results
        const updateData = [
          {
            range: `${SHEET_TAB}!B${rowIndex}`, // status
            values: [['Published']]
          },
          {
            range: `${SHEET_TAB}!J${rowIndex}`, // publishedDate
            values: [[now.toISOString()]]
          },
          {
            range: `${SHEET_TAB}!K${rowIndex}`, // postPermalink
            values: [[results.wordpress?.permalink || '']]
          },
          {
            range: `${SHEET_TAB}!L${rowIndex}`, // facebookPostId
            values: [[results.facebook?.postId || '']]
          },
          {
            range: `${SHEET_TAB}!M${rowIndex}`, // linkedInPostId
            values: [[results.linkedin?.postId || '']]
          },
          {
            range: `${SHEET_TAB}!N${rowIndex}`, // wordPressPostId
            values: [[results.wordpress?.postId || '']]
          },
          {
            range: `${SHEET_TAB}!O${rowIndex}`, // brevoEmailId
            values: [[results.brevo?.campaignId || '']]
          },
          {
            range: `${SHEET_TAB}!P${rowIndex}`, // analytics
            values: [[JSON.stringify(results)]]
          }
        ];

        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          valueInputOption: 'USER_ENTERED',
          requestBody: { data: updateData }
        });

        publishedCount++;
        console.log('[ScheduledPosts] ✅ Successfully published:', postId, 'Results:', Object.keys(results));

      } catch (err) {
        errorCount++;
        console.error('[ScheduledPosts] ❌ Failed to publish', postId, ':', err.message);
        
        // Optionally update status to indicate error
        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!P${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[JSON.stringify({ error: err.message, timestamp: now.toISOString() })]]
            }
          });
        } catch (updateErr) {
          console.error('[ScheduledPosts] Failed to log error:', updateErr.message);
        }
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      totalChecked: rows.length,
      publishedCount,
      errorCount,
      message: publishedCount > 0 
        ? `Published ${publishedCount} scheduled post(s)` 
        : 'No posts due for publishing'
    };

    console.log('[ScheduledPosts] Complete:', summary);

    return {
      statusCode: 200,
      body: JSON.stringify(summary)
    };

  } catch (err) {
    console.error('[ScheduledPosts] Fatal error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// =====================================
// Platform Publishing Functions
// (Reusing logic from publishSocialPost.js)
// =====================================

function convertGoogleDriveUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  
  const viewMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (viewMatch) {
    return `https://drive.google.com/uc?export=download&id=${viewMatch[1]}`;
  }
  
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  }
  
  return url;
}

async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    const directUrl = convertGoogleDriveUrl(imageUrl);
    const response = await fetch(directUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 49NorthBot/1.0)' }
    });
    
    if (!response.ok) return null;
    
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return { buffer, contentType };
  } catch (error) {
    console.error('[Image] Download error:', error.message);
    return null;
  }
}

async function publishToFacebook(postData) {
  if (!FB_TOKEN || !FB_PAGE_ID) throw new Error('Facebook credentials not configured');

  const message = `${postData.title || ''}\n\n${postData.body || ''}`.trim();

  if (postData.imageUrl) {
    try {
      const formData = new URLSearchParams();
      formData.append('message', message);
      formData.append('access_token', FB_TOKEN);
      formData.append('url', convertGoogleDriveUrl(postData.imageUrl));

      const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`, {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const out = await res.json();
        return { postId: out.id, type: 'photo' };
      }
    } catch (err) {
      console.error('[Facebook] Photo upload failed:', err.message);
    }
  }

  const payload = {
    message,
    access_token: FB_TOKEN
  };
  if (postData.imageUrl) payload.link = convertGoogleDriveUrl(postData.imageUrl);

  const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Facebook API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id };
}

async function publishToLinkedIn(postData) {
  if (!LI_TOKEN) throw new Error('LinkedIn token not configured');

  let assetUrn = null;

  if (postData.imageUrl) {
    try {
      const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LI_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: LI_ORG_URN,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }]
          }
        })
      });

      if (registerRes.ok) {
        const registerData = await registerRes.json();
        const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
        assetUrn = registerData.value?.asset;

        if (uploadUrl && assetUrn) {
          const imageData = await downloadImage(postData.imageUrl);
          if (imageData && imageData.buffer) {
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${LI_TOKEN}`,
                'Content-Type': 'application/octet-stream'
              },
              body: Buffer.from(imageData.buffer)
            });

            if (!uploadRes.ok) {
              console.warn('[LinkedIn] Image upload failed');
              assetUrn = null;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[LinkedIn] Image error:', err.message);
    }
  }

  const shareContent = {
    shareCommentary: { text: `${postData.title || ''}\n\n${postData.body || ''}`.trim() }
  };

  if (assetUrn) {
    shareContent.shareMediaCategory = 'IMAGE';
    shareContent.media = [{ status: 'READY', media: assetUrn }];
  } else {
    shareContent.shareMediaCategory = 'NONE';
  }

  const payload = {
    author: LI_ORG_URN,
    lifecycleState: 'PUBLISHED',
    specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LI_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`LinkedIn API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id, uploadedImage: !!assetUrn };
}

async function publishToWordPress(postData) {
  if (!WP_USER || !WP_PASS) throw new Error('WordPress credentials not configured');

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  let featuredMediaId = null;

  if (postData.imageUrl) {
    try {
      const imageData = await downloadImage(postData.imageUrl);
      
      if (imageData && imageData.buffer) {
        const filename = postData.imageUrl.includes('drive.google.com')
          ? `scheduled-post-${Date.now()}.jpg`
          : new URL(postData.imageUrl).pathname.split('/').pop() || 'image.jpg';

        const mediaRes = await fetch(`${WP_BASE}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': imageData.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          },
          body: Buffer.from(imageData.buffer)
        });

        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          featuredMediaId = mediaData.id;
        }
      }
    } catch (err) {
      console.warn('[WordPress] Featured image upload failed:', err.message);
    }
  }

  const payload = {
    title: postData.title || '',
    content: postData.body || '',
    status: 'publish',
    categories: [1],
    excerpt: postData.body ? postData.body.substring(0, 150) + '...' : ''
  };

  if (featuredMediaId) payload.featured_media = featuredMediaId;

  const res = await fetch(WP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) throw new Error(`WordPress API error: ${await res.text()}`);
  const out = await res.json();
  
  return { 
    postId: out.id, 
    permalink: out.link,
    featuredImageId: featuredMediaId
  };
}

async function publishToBrevo(postData) {
  if (!BREVO_API_KEY) throw new Error('Brevo API key not configured');

  const SENDER_NAME = process.env.BREVO_SENDER_NAME || '49 North';
  const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@49northresearch.com';
  const LIST_ID = parseInt(process.env.BREVO_LIST_ID || '108', 10);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">${postData.title || 'Update from 49 North'}</h1>
      ${postData.imageUrl ? `<img src="${postData.imageUrl}" alt="Featured Image" style="max-width: 100%; height: auto; margin: 20px 0;" />` : ''}
      <div style="line-height: 1.6; color: #333;">
        ${(postData.body || '').split('\n').map(p => `<p>${p}</p>`).join('')}
      </div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
      <p style="text-align: center; color: #666; font-size: 14px;">
        <a href="https://www.mymentalarmor.com" style="color: #2563eb;">www.mymentalarmor.com</a>
      </p>
    </body>
    </html>
  `;

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: SENDER_EMAIL }],
    replyTo: { email: SENDER_EMAIL },
    htmlContent,
    subject: postData.title || 'Update from 49 North',
    recipients: { listIds: [LIST_ID] },
    inlineImageActivation: false,
    mirrorActive: false
  };

  const res = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Brevo API error: ${await res.text()}`);
  const out = await res.json();
  return { campaignId: out.id };
}

// Export for manual testing
exports.publishToFacebook = publishToFacebook;
exports.publishToLinkedIn = publishToLinkedIn;
exports.publishToWordPress = publishToWordPress;
exports.publishToBrevo = publishToBrevo;

