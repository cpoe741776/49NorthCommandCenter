// netlify/functions/publishSocialPost.js
const { google } = require('googleapis');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const SHEET_TAB = 'MainPostData';

const LI_ORG_URN = process.env.LINKEDIN_ORG_URN || 'urn:li:organization:107582691';
const WP_URL = process.env.WP_POSTS_URL || 'https://mymentalarmor.com/wp-json/wp/v2/posts';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON body');

  const postId = body?.postId;
  let postData = body?.postData;

  try {
    const auth = getGoogleAuth();
    await auth.getClient(); // Use getClient() instead of deprecated authorize()
    const sheets = google.sheets({ version: 'v4', auth });

    // Load from sheet if postData not provided
    let rowIndex = null;
    if (!postData) {
      if (!postId) return bad(headers, 'postId is required when postData is not supplied');
      const rowsResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A2:R`
      });
      const rows = rowsResp.data.values || [];
      const row = rows.find(r => r[0] === postId);
      if (!row) return ok(headers, { success: false, error: 'Post not found' });

      postData = {
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
        // K..Q skipped here
        tags: row[17] // R
      };

      rowIndex = await findRowIndexById(sheets, SHEET_ID, SHEET_TAB, postId);
    }

    // Parse target platforms
    const platforms = String(postData.platforms || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    if (!platforms.length) return bad(headers, 'No target platforms provided');

    // Publish per platform
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
        console.error(`publish ${platform} error:`, e);
        results[platform.toLowerCase()] = { error: e.message || 'publish failed' };
      }
    }

    const finalRowIndex = rowIndex ?? (await findRowIndexById(sheets, SHEET_ID, SHEET_TAB, postId || postData.postId));
    if (finalRowIndex) {
      // Write ONLY the columns we intend to modify: B, J..P
      const data = [
        {
          range: `${SHEET_TAB}!B${finalRowIndex}`, // status
          values: [['Published']]
        },
        {
          range: `${SHEET_TAB}!J${finalRowIndex}`, // publishedDate
          values: [[new Date().toISOString()]]
        },
        {
          range: `${SHEET_TAB}!K${finalRowIndex}`, // postPermalink
          values: [[results.wordpress?.permalink || '']]
        },
        {
          range: `${SHEET_TAB}!L${finalRowIndex}`, // facebookPostId
          values: [[results.facebook?.postId || '']]
        },
        {
          range: `${SHEET_TAB}!M${finalRowIndex}`, // linkedInPostId
          values: [[results.linkedin?.postId || '']]
        },
        {
          range: `${SHEET_TAB}!N${finalRowIndex}`, // wordPressPostId
          values: [[results.wordpress?.postId || '']]
        },
        {
          range: `${SHEET_TAB}!O${finalRowIndex}`, // brevoEmailId
          values: [[results.brevo?.campaignId || '']]
        },
        {
          range: `${SHEET_TAB}!P${finalRowIndex}`, // analytics json
          values: [[JSON.stringify(results)]]
        }
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody: { data }
      });
    }

    return ok(headers, { success: true, results });
  } catch (e) {
    console.error('publishSocialPost fatal:', e);
    return serverErr(headers);
  }
};

// ---- helpers ----
async function findRowIndexById(sheets, sheetId, tab, postId) {
  if (!postId) return null;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A2:A`
  });
  const rows = resp.data.values || [];
  const idx = rows.findIndex(r => r[0] === postId);
  return idx >= 0 ? idx + 2 : null;
}

/**
 * Convert Google Drive share links to direct download URLs
 * Handles various Drive link formats
 */
function convertGoogleDriveUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  
  // Extract file ID from various Google Drive URL formats
  let fileId = null;
  
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const viewMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (viewMatch) fileId = viewMatch[1];
  
  // Format: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) fileId = openMatch[1];
  
  // Format: https://drive.google.com/uc?id=FILE_ID (already direct)
  const ucMatch = url.match(/\/uc\?.*?id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return url; // Already in direct format
  
  if (fileId) {
    console.log('[GoogleDrive] Converting share link to direct URL. File ID:', fileId);
    // Return direct download URL
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  
  console.warn('[GoogleDrive] Could not extract file ID from:', url);
  return url; // Return original if we can't parse it
}

/**
 * Download image from URL and return as buffer
 * Handles Google Drive links automatically
 */
async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    // Convert Google Drive links to direct download URLs
    const directUrl = convertGoogleDriveUrl(imageUrl);
    
    console.log('[Image] Downloading from:', directUrl);
    const response = await fetch(directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 49NorthBot/1.0)'
      }
    });
    
    if (!response.ok) {
      console.error('[Image] Download failed:', response.status, response.statusText);
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    console.log('[Image] Content-Type:', contentType);
    
    // Check if it's actually an image
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn('[Image] Not an image content-type:', contentType);
      // Still try to download, might be a Google Drive quirk
    }
    
    const buffer = await response.arrayBuffer();
    console.log('[Image] Downloaded:', buffer.byteLength, 'bytes');
    
    return {
      buffer,
      contentType: contentType || 'image/jpeg'
    };
  } catch (error) {
    console.error('[Image] Download error:', error.message);
    return null;
  }
}

async function publishToFacebook(postData) {
  const FB_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  if (!FB_TOKEN || !FB_PAGE_ID) throw new Error('Facebook credentials not configured');

  const message = `${postData.title || ''}\n\n${postData.body || ''}`.trim();

  // If we have an image, upload it natively with the post
  if (postData.imageUrl) {
    try {
      const imageData = await downloadImage(postData.imageUrl);
      
      if (imageData && imageData.buffer) {
        // Upload image as photo post
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
          console.log('[Facebook] Photo post successful:', out.id);
          return { postId: out.id, type: 'photo' };
        } else {
          console.error('[Facebook] Photo upload failed:', await res.text());
          // Fall back to link post
        }
      }
    } catch (err) {
      console.error('[Facebook] Image upload error:', err.message);
      // Fall back to link post
    }
  }

  // Text-only or fallback link post
  const payload = {
    message,
    access_token: FB_TOKEN
  };
  if (postData.imageUrl) {
    // Use direct Google Drive URL if it's a Drive link
    payload.link = convertGoogleDriveUrl(postData.imageUrl);
  }

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
  const LI_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
  const ORG_URN = process.env.LINKEDIN_ORG_URN || LI_ORG_URN;
  if (!LI_TOKEN) throw new Error('LinkedIn token not configured');

  let assetUrn = null;

  // If image URL provided, upload it as a native LinkedIn image
  if (postData.imageUrl) {
    try {
      // Step 1: Register the upload
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
            owner: ORG_URN,
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
          // Step 2: Download and upload the image (handles Google Drive links)
          const imageData = await downloadImage(postData.imageUrl);
          if (imageData && imageData.buffer) {
            const imageBuffer = imageData.buffer;
            
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${LI_TOKEN}`,
                'Content-Type': 'application/octet-stream'
              },
              body: Buffer.from(imageBuffer)
            });

            if (!uploadRes.ok) {
              console.warn('LinkedIn image upload failed:', await uploadRes.text());
              assetUrn = null; // Fall back to text-only post
            }
          }
        }
      }
    } catch (err) {
      console.warn('LinkedIn image upload error:', err.message);
      // Continue with text-only post
    }
  }

  // Build the share content
  const shareContent = {
    shareCommentary: { text: `${postData.title || ''}\n\n${postData.body || ''}`.trim() }
  };

  // Add image if we successfully uploaded it
  if (assetUrn) {
    shareContent.shareMediaCategory = 'IMAGE';
    shareContent.media = [{
      status: 'READY',
      media: assetUrn
    }];
  } else {
    shareContent.shareMediaCategory = 'NONE';
  }

  // Use the stable v2 ugcPosts API
  const payload = {
    author: ORG_URN,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent
    },
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

  if (!res.ok) {
    const errorText = await res.text();
    console.error('LinkedIn API full error:', errorText);
    throw new Error(`LinkedIn API error: ${errorText}`);
  }
  
  const out = await res.json();
  return { postId: out.id, uploadedImage: !!assetUrn };
}

async function publishToWordPress(postData) {
  const WP_USER = process.env.WP_USERNAME;
  const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
  const WP_BASE = WP_URL.replace('/wp-json/wp/v2/posts', '');
  if (!WP_USER || !WP_PASS) throw new Error('WordPress credentials not configured');

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const authHeaders = { 
    Authorization: `Basic ${auth}`, 
    'Content-Type': 'application/json' 
  };

  let featuredMediaId = null;

  // If image URL provided, upload to WordPress Media Library first
  if (postData.imageUrl) {
    try {
      // Download image (handles Google Drive links)
      const imageData = await downloadImage(postData.imageUrl);
      
      if (imageData && imageData.buffer) {
        const imageBuffer = imageData.buffer;
        const contentType = imageData.contentType || 'image/jpeg';
        
        // Get filename from URL or use default
        let filename = 'featured-image.jpg';
        try {
          const urlPath = new URL(postData.imageUrl).pathname;
          filename = urlPath.split('/').pop() || filename;
          // For Google Drive links, create a meaningful filename
          if (postData.imageUrl.includes('drive.google.com')) {
            const fileId = postData.imageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
            if (fileId) filename = `drive-${fileId.substring(0, 8)}.jpg`;
          }
        } catch (e) {
          // Use default filename if URL parsing fails
        }
        
        // Upload to WordPress Media Library
        const mediaRes = await fetch(`${WP_BASE}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          },
          body: Buffer.from(imageBuffer)
        });

        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          featuredMediaId = mediaData.id;
          console.log('[WordPress] Featured image uploaded:', featuredMediaId);
        } else {
          console.error('[WordPress] Media upload failed:', await mediaRes.text());
        }
      }
    } catch (err) {
      console.warn('[WordPress] Failed to upload featured image:', err.message);
      // Continue without featured image rather than failing the whole post
    }
  }

  // Create the post
  const payload = {
    title: postData.title || '',
    content: postData.body || '',
    status: 'publish',
    categories: [1], // Default "Uncategorized"
    excerpt: postData.body ? postData.body.substring(0, 150) + '...' : ''
  };

  // Add featured image if we successfully uploaded it
  if (featuredMediaId) {
    payload.featured_media = featuredMediaId;
  }

  const res = await fetch(WP_URL, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) throw new Error(`WordPress API error: ${await res.text()}`);
  const out = await res.json();
  
  return { 
    postId: out.id, 
    permalink: out.link,
    featuredImageId: featuredMediaId,
    hasFeaturedImage: !!featuredMediaId
  };
}

async function publishToBrevo(postData) {
  const BREVO_KEY = process.env.BREVO_API_KEY;
  const BREVO_URL = 'https://api.brevo.com/v3/emailCampaigns';
  const BREVO_LIST_ID = process.env.BREVO_LIST_ID;
  
  if (!BREVO_KEY) throw new Error('Brevo API key not configured');
  if (!BREVO_LIST_ID) throw new Error('Brevo list ID not configured (BREVO_LIST_ID)');

  // Build HTML with better formatting
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #003049; margin-bottom: 20px; }
        p { margin-bottom: 15px; }
        img { max-width: 100%; height: auto; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <h1>${postData.title || 'Update from 49 North'}</h1>
      ${postData.imageUrl ? `<img src="${postData.imageUrl}" alt="${postData.title || ''}" style="margin-bottom: 20px;">` : ''}
      <div>${(postData.body || '').replace(/\n/g, '<br>')}</div>
      <div class="footer">
        <p>49 North | Mental Armor Training</p>
        <p><a href="https://mymentalarmor.com">Visit our website</a></p>
      </div>
    </body>
    </html>
  `.trim();

  const payload = {
    name: `[DRAFT] ${postData.title || 'Email Campaign'}`,
    subject: postData.title || 'Update from 49 North',
    sender: {
      name: process.env.BREVO_SENDER_NAME || '49 North',
      email: process.env.BREVO_SENDER_EMAIL
    },
    htmlContent: htmlContent,
    // IMPORTANT: Always create as draft for manual review before sending
    // User has 28K contacts - no auto-sending!
    recipients: {
      listIds: [parseInt(BREVO_LIST_ID, 10)]
    },
    inlineImageActivation: false, // Must be false for lists > 5000 contacts
    mirrorActive: false, // Disable mirror to avoid image embedding issues
    // Leave as draft - user will manually send from Brevo dashboard
    // (No scheduledAt, no status: 'queued')
  };

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo API error: ${errText}`);
  }
  
  const out = await res.json();
  
  // Return campaign ID and dashboard link for easy access
  return { 
    campaignId: out.id,
    dashboardLink: `https://app.brevo.com/campaign/id/${out.id}`,
    status: 'draft',
    message: 'Email campaign created as DRAFT. Review and send manually from Brevo dashboard.'
  };
}
