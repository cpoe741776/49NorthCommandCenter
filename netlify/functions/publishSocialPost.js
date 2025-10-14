// netlify/functions/publishSocialPost.js
// Hardened: CORS/auth, safe JSON, platform-by-platform error capture, Sheets updates

const { google } = require('googleapis');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const SHEET_ID = process.env.SOCIAL_MEDIA_SHEET_ID;
const SHEET_TAB = 'MainPostData';

// Defaults can be overridden by env
const LI_ORG_URN = process.env.LINKEDIN_ORG_URN || 'urn:li:organization:107582691';
const WP_URL = process.env.WP_POSTS_URL || 'https://mymentalarmor.com/wp-json/wp/v2/posts';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON body');

  // We allow either { postId } or a full { postData } payload.
  const postId = body?.postId;
  let postData = body?.postData;

  try {
    // Google auth
    const auth = getGoogleAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Pull postData from Sheets if necessary
    let rowIndex = null;
    if (!postData) {
      if (!postId) return bad(headers, 'postId is required when postData is not supplied');

      const rowsResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A2:R`
      });
      const rows = rowsResp.data.values || [];
      const row = rows.find((r) => r[0] === postId);
      if (!row) return ok(headers, { success: false, error: 'Post not found' });

      postData = {
        timestamp: row[0],
        status: row[1],
        contentType: row[2],
        title: row[3],
        body: row[4],
        imageUrl: row[5],
        videoUrl: row[6],
        platforms: row[7],
        scheduleDate: row[8],
        publishedDate: row[9],
        tags: row[17]
      };

      // Find row index for later update
      const idsResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A2:A`
      });
      const idRows = idsResp.data.values || [];
      rowIndex = idRows.findIndex((r) => r[0] === postId) + 2; // +2 for header + 0-index
      if (rowIndex < 2) rowIndex = null;
    }

    // Validate platforms
    const platforms = String(postData.platforms || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (!platforms.length) return bad(headers, 'No target platforms provided');

    const results = {};

    // Publish per platform with isolation
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

    // Update sheet status if we have a rowIndex or can find it now
    const finalRowIndex = rowIndex ?? (await findRowIndexById(sheets, SHEET_ID, SHEET_TAB, postId));
    if (finalRowIndex) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!B${finalRowIndex}:P${finalRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              'Published', // B status
              '', // C contentType (unchanged)
              '', // D title (unchanged)
              '', // E body (unchanged)
              '', // F imageUrl (unchanged)
              '', // G videoUrl (unchanged)
              '', // H platforms (unchanged)
              '', // I scheduleDate (unchanged)
              new Date().toISOString(), // J publishedDate
              results.wordpress?.permalink || '', // K postPermalink
              results.facebook?.postId || '', // L facebookPostId
              results.linkedin?.postId || '', // M linkedInPostId
              results.wordpress?.postId || '', // N wordPressPostId
              results.brevo?.campaignId || '', // O brevoEmailId
              JSON.stringify(results) // P analytics
            ]
          ]
        }
      });
    }

    return ok(headers, { success: true, results });
  } catch (e) {
    console.error('publishSocialPost fatal:', e);
    return serverErr(headers);
  }
};

// ------- Helpers -------

async function findRowIndexById(sheets, sheetId, tab, postId) {
  if (!postId) return null;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A2:A`
  });
  const rows = resp.data.values || [];
  const idx = rows.findIndex((r) => r[0] === postId);
  return idx >= 0 ? idx + 2 : null;
}

async function publishToFacebook(postData) {
  const FB_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  if (!FB_TOKEN || !FB_PAGE_ID) throw new Error('Facebook credentials not configured');

  const payload = {
    message: `${postData.title || ''}\n\n${postData.body || ''}`.trim(),
    access_token: FB_TOKEN
  };
  if (postData.imageUrl) payload.link = postData.imageUrl;

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
  const ORG_URN = LI_ORG_URN;
  if (!LI_TOKEN) throw new Error('LinkedIn token not configured');

  const payload = {
    author: ORG_URN,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: `${postData.title || ''}\n\n${postData.body || ''}`.trim() },
        shareMediaCategory: 'NONE'
      }
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
  if (!res.ok) throw new Error(`LinkedIn API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id };
}

async function publishToWordPress(postData) {
  const WP_USER = process.env.WP_USERNAME;
  const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
  const url = WP_URL;
  if (!WP_USER || !WP_PASS) throw new Error('WordPress credentials not configured');

  const payload = {
    title: postData.title || '',
    content: postData.body || '',
    status: 'publish'
  };

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`WordPress API error: ${await res.text()}`);
  const out = await res.json();
  return { postId: out.id, permalink: out.link };
}

async function publishToBrevo(postData) {
  const BREVO_KEY = process.env.BREVO_API_KEY;
  const BREVO_URL = 'https://api.brevo.com/v3/emailCampaigns';
  if (!BREVO_KEY) throw new Error('Brevo API key not configured');

  const payload = {
    name: `Campaign: ${postData.title || ''}`.trim(),
    subject: postData.title || '',
    sender: {
      name: process.env.BREVO_SENDER_NAME || '49 North',
      email: process.env.BREVO_SENDER_EMAIL
    },
    htmlContent: `<h1>${postData.title || ''}</h1><p>${(postData.body || '').replace(/\n/g, '<br>')}</p>`,
    status: 'draft'
  };

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Brevo API error: ${await res.text()}`);
  const out = await res.json();
  return { campaignId: out.id };
}
