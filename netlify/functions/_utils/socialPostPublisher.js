// netlify/functions/_utils/socialPostPublisher.js
// Shared platform publishing logic used by publishSocialPost.js and
// publishScheduledPosts.js.  Previously duplicated ~300 lines in each file.

const { fetchWithTimeout } = require('./http');

const LI_ORG_URN = process.env.LINKEDIN_ORG_URN || 'urn:li:organization:107582691';
const WP_URL = process.env.WP_POSTS_URL || 'https://mymentalarmor.com/wp-json/wp/v2/posts';
const WP_BASE = WP_URL.replace('/wp-json/wp/v2/posts', '');

// ── Google Drive URL normalisation ───────────────────────────────────────────
function convertGoogleDriveUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;

  const viewMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (viewMatch) return `https://drive.google.com/uc?export=download&id=${viewMatch[1]}`;

  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;

  return url;
}

// ── Download image (handles Drive links) ────────────────────────────────────
async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    const directUrl = convertGoogleDriveUrl(imageUrl);
    const res = await fetchWithTimeout(directUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 49NorthBot/1.0)' },
    }, 15000);

    if (!res.ok) {
      console.warn('[Image] Download failed:', res.status, directUrl);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    console.log('[Image] Downloaded', buffer.byteLength, 'bytes, type:', contentType);
    return { buffer, contentType };
  } catch (err) {
    console.error('[Image] Download error:', err.message);
    return null;
  }
}

// ── Facebook ─────────────────────────────────────────────────────────────────
async function publishToFacebook(postData) {
  const FB_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  if (!FB_TOKEN || !FB_PAGE_ID) throw new Error('Facebook credentials not configured');

  const message = `${postData.title || ''}\n\n${postData.body || ''}`.trim();

  // Try photo post first
  if (postData.imageUrl) {
    try {
      const form = new URLSearchParams();
      form.append('message', message);
      form.append('access_token', FB_TOKEN);
      form.append('url', convertGoogleDriveUrl(postData.imageUrl));

      const res = await fetchWithTimeout(
        `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`,
        { method: 'POST', body: form },
        15000
      );
      if (res.ok) {
        const out = await res.json();
        console.log('[Facebook] Photo post OK:', out.id);
        return { postId: out.id, type: 'photo' };
      }
      console.warn('[Facebook] Photo post failed, falling back to feed post');
    } catch (err) {
      console.warn('[Facebook] Photo error:', err.message);
    }
  }

  // Feed post (text or link)
  const payload = { message, access_token: FB_TOKEN };
  if (postData.imageUrl) payload.link = convertGoogleDriveUrl(postData.imageUrl);

  const res = await fetchWithTimeout(
    `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    15000
  );
  if (!res.ok) throw new Error(`Facebook API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id };
}

// ── LinkedIn ─────────────────────────────────────────────────────────────────
async function publishToLinkedIn(postData) {
  const LI_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
  const ORG_URN = process.env.LINKEDIN_ORG_URN || LI_ORG_URN;
  if (!LI_TOKEN) throw new Error('LinkedIn token not configured');

  let assetUrn = null;

  if (postData.imageUrl) {
    try {
      // 1. Register upload
      const regRes = await fetchWithTimeout(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LI_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: ORG_URN,
              serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
            },
          }),
        },
        15000
      );

      if (regRes.ok) {
        const regData = await regRes.json();
        const uploadUrl = regData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
        assetUrn = regData.value?.asset;

        if (uploadUrl && assetUrn) {
          const imageData = await downloadImage(postData.imageUrl);
          if (imageData?.buffer) {
            const upRes = await fetchWithTimeout(
              uploadUrl,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${LI_TOKEN}`, 'Content-Type': 'application/octet-stream' },
                body: Buffer.from(imageData.buffer),
              },
              20000
            );
            if (!upRes.ok) {
              console.warn('[LinkedIn] Image upload failed:', upRes.status);
              assetUrn = null;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[LinkedIn] Image error:', err.message);
      assetUrn = null;
    }
  }

  const shareContent = {
    shareCommentary: { text: `${postData.title || ''}\n\n${postData.body || ''}`.trim() },
    shareMediaCategory: assetUrn ? 'IMAGE' : 'NONE',
    ...(assetUrn ? { media: [{ status: 'READY', media: assetUrn }] } : {}),
  };

  const res = await fetchWithTimeout(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LI_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: ORG_URN,
        lifecycleState: 'PUBLISHED',
        specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    },
    15000
  );

  if (!res.ok) throw new Error(`LinkedIn API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id, uploadedImage: !!assetUrn };
}

// ── WordPress ────────────────────────────────────────────────────────────────
async function publishToWordPress(postData) {
  const WP_USER = process.env.WP_USERNAME;
  const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
  if (!WP_USER || !WP_PASS) throw new Error('WordPress credentials not configured');

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const authHeader = { Authorization: `Basic ${auth}` };
  let featuredMediaId = null;

  if (postData.imageUrl) {
    try {
      const imageData = await downloadImage(postData.imageUrl);
      if (imageData?.buffer) {
        let filename = 'featured-image.jpg';
        if (postData.imageUrl.includes('drive.google.com')) {
          const m = postData.imageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (m) filename = `drive-${m[1].substring(0, 8)}.jpg`;
        } else {
          try { filename = new URL(postData.imageUrl).pathname.split('/').pop() || filename; } catch {}
        }

        const mediaRes = await fetchWithTimeout(
          `${WP_BASE}/wp-json/wp/v2/media`,
          {
            method: 'POST',
            headers: {
              ...authHeader,
              'Content-Type': imageData.contentType,
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
            body: Buffer.from(imageData.buffer),
          },
          20000
        );
        if (mediaRes.ok) {
          const m = await mediaRes.json();
          featuredMediaId = m.id;
        } else {
          console.warn('[WordPress] Media upload failed:', mediaRes.status);
        }
      }
    } catch (err) {
      console.warn('[WordPress] Image error:', err.message);
    }
  }

  const payload = {
    title: postData.title || '',
    content: postData.body || '',
    status: 'publish',
    categories: [1],
    excerpt: (postData.body || '').substring(0, 150) + '...',
    ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
  };

  const res = await fetchWithTimeout(
    WP_URL,
    { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    20000
  );
  if (!res.ok) throw new Error(`WordPress API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id, permalink: out.link, featuredImageId: featuredMediaId };
}

// ── Brevo email campaign (created as draft — no auto-send to 28K contacts) ───
async function publishToBrevo(postData) {
  const BREVO_KEY = process.env.BREVO_API_KEY;
  const LIST_ID = parseInt(process.env.BREVO_LIST_ID || '108', 10);
  const SENDER_NAME = process.env.BREVO_SENDER_NAME || '49 North';
  const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@49northresearch.com';

  if (!BREVO_KEY) throw new Error('Brevo API key not configured');

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #003049; }
    img { max-width: 100%; height: auto; margin: 16px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>${postData.title || 'Update from 49 North'}</h1>
  ${postData.imageUrl ? `<img src="${postData.imageUrl}" alt="${postData.title || ''}">` : ''}
  <div>${(postData.body || '').replace(/\n/g, '<br>')}</div>
  <div class="footer">
    <p>49 North | Mental Armor™ Training</p>
    <a href="https://www.mymentalarmor.com">www.mymentalarmor.com</a>
  </div>
</body>
</html>`.trim();

  const res = await fetchWithTimeout(
    'https://api.brevo.com/v3/emailCampaigns',
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        name: `[DRAFT] ${postData.title || 'Email Campaign'}`,
        subject: postData.title || 'Update from 49 North',
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        htmlContent,
        recipients: { listIds: [LIST_ID] },
        inlineImageActivation: false,
        mirrorActive: false,
      }),
    },
    15000
  );

  if (!res.ok) throw new Error(`Brevo API error: ${await res.text()}`);
  const out = await res.json();
  return {
    campaignId: out.id,
    dashboardLink: `https://app.brevo.com/campaign/id/${out.id}`,
    status: 'draft',
    message: 'Draft created — review & send manually from Brevo dashboard.',
  };
}

// ── Dispatch to the right platform ───────────────────────────────────────────
async function publishToPlatform(platform, postData) {
  switch (platform) {
    case 'Facebook': return publishToFacebook(postData);
    case 'LinkedIn': return publishToLinkedIn(postData);
    case 'Website':  return publishToWordPress(postData);
    case 'Email':    return publishToBrevo(postData);
    default: throw new Error(`Unknown platform: ${platform}`);
  }
}

module.exports = {
  publishToPlatform,
  publishToFacebook,
  publishToLinkedIn,
  publishToWordPress,
  publishToBrevo,
  convertGoogleDriveUrl,
  downloadImage,
};
