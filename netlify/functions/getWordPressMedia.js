// netlify/functions/getWordPressMedia.js
// Fetches media library from WordPress

const { corsHeaders, methodGuard, ok, bad, serverErr } = require('./_utils/http');

const WP_URL = process.env.WP_POSTS_URL || 'https://mymentalarmor.com/wp-json/wp/v2/posts';
const WP_BASE = WP_URL.replace('/wp-json/wp/v2/posts', '');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    const WP_USER = process.env.WP_USERNAME;
    const WP_PASS = process.env.WP_APPLICATION_PASSWORD;
    if (!WP_USER || !WP_PASS) {
      return bad(headers, 'WordPress credentials not configured');
    }

    // Parse query params for pagination
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '50', 10);
    const search = url.searchParams.get('search') || '';

    console.log('[WP Media] Fetching page', page, 'per_page', perPage);

    const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
    
    let fetchUrl = `${WP_BASE}/wp-json/wp/v2/media?page=${page}&per_page=${perPage}&orderby=date&order=desc`;
    if (search) {
      fetchUrl += `&search=${encodeURIComponent(search)}`;
    }

    const mediaRes = await fetch(fetchUrl, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    if (!mediaRes.ok) {
      const errorText = await mediaRes.text();
      console.error('[WP Media] Failed:', errorText);
      throw new Error(`WordPress fetch failed: ${errorText}`);
    }

    const mediaItems = await mediaRes.json();
    
    // Get total count from headers
    const totalItems = parseInt(mediaRes.headers.get('x-wp-total') || '0', 10);
    const totalPages = parseInt(mediaRes.headers.get('x-wp-totalpages') || '1', 10);

    console.log('[WP Media] Retrieved', mediaItems.length, 'items. Total:', totalItems);

    // Map to simpler format
    const media = mediaItems.map(item => ({
      id: item.id,
      url: item.source_url,
      title: item.title?.rendered || 'Untitled',
      alt: item.alt_text || '',
      caption: item.caption?.rendered || '',
      width: item.media_details?.width || 0,
      height: item.media_details?.height || 0,
      filesize: item.media_details?.filesize || 0,
      mimeType: item.mime_type || '',
      date: item.date,
      thumbnail: item.media_details?.sizes?.thumbnail?.source_url || item.source_url,
      medium: item.media_details?.sizes?.medium?.source_url || item.source_url
    }));

    return ok(headers, {
      success: true,
      media,
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages
      }
    });

  } catch (err) {
    console.error('[WP Media] Error:', err);
    return serverErr(headers, err.message);
  }
};

