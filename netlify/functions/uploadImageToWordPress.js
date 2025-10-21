// netlify/functions/uploadImageToWordPress.js
// Uploads images to WordPress Media Library and returns the URL

const { corsHeaders, methodGuard, ok, bad, serverErr } = require('./_utils/http');

const WP_URL = process.env.WP_POSTS_URL || 'https://mymentalarmor.com/wp-json/wp/v2/posts';
const WP_BASE = WP_URL.replace('/wp-json/wp/v2/posts', '');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const WP_USER = process.env.WP_USERNAME;
    const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
    if (!WP_USER || !WP_PASS) {
      return bad(headers, 'WordPress credentials not configured');
    }

    // Parse multipart form data (base64 encoded image from client)
    const body = JSON.parse(event.body || '{}');
    const { imageData, filename, mimeType } = body;

    if (!imageData || !filename) {
      return bad(headers, 'imageData and filename are required');
    }

    console.log('[WP Upload] Uploading:', filename, 'Type:', mimeType);

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('[WP Upload] Buffer size:', buffer.length, 'bytes');

    // Upload to WordPress Media Library
    const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
    const mediaRes = await fetch(`${WP_BASE}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': mimeType || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      body: buffer
    });

    if (!mediaRes.ok) {
      const errorText = await mediaRes.text();
      console.error('[WP Upload] Failed:', errorText);
      throw new Error(`WordPress upload failed: ${errorText}`);
    }

    const mediaData = await mediaRes.json();
    console.log('[WP Upload] Success! Media ID:', mediaData.id);

    return ok(headers, {
      success: true,
      mediaId: mediaData.id,
      url: mediaData.source_url,
      title: mediaData.title?.rendered || filename,
      alt: mediaData.alt_text || '',
      caption: mediaData.caption?.rendered || '',
      width: mediaData.media_details?.width || 0,
      height: mediaData.media_details?.height || 0,
      filesize: mediaData.media_details?.filesize || buffer.length,
      mimeType: mediaData.mime_type || mimeType
    });

  } catch (err) {
    console.error('[WP Upload] Error:', err);
    return serverErr(headers, err.message);
  }
};

