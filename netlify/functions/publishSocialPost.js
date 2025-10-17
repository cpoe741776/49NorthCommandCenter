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
