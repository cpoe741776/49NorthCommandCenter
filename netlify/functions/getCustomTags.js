// netlify/functions/getCustomTags.js
// Fetches unique CUSTOM_TAG values from Brevo contacts for dropdown

const { corsHeaders, methodGuard, ok } = require('./_utils/http');

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Cache tags for 15 minutes
let tagCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    if (!BREVO_API_KEY) {
      return ok(headers, { success: false, error: 'BREVO_API_KEY not configured' });
    }

    // Check cache
    const now = Date.now();
    if (tagCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[GetCustomTags] Returning cached tags');
      return ok(headers, { success: true, tags: tagCache, cached: true });
    }

    console.log('[GetCustomTags] Fetching custom tags from Brevo...');

    // Fetch first 5000 contacts to get a good sample of tags
    const tags = new Set();
    const maxPages = 5; // 5000 contacts should cover most tags
    
    for (let page = 0; page < maxPages; page++) {
      const offset = page * 1000;
      const res = await fetch(`https://api.brevo.com/v3/contacts?limit=1000&offset=${offset}`, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY
        }
      });

      if (!res.ok) {
        console.error('[GetCustomTags] Brevo API error:', res.status);
        break;
      }

      const data = await res.json();
      
      // Extract CUSTOM_TAG values
      (data.contacts || []).forEach(contact => {
        const customTag = contact.attributes?.CUSTOM_TAG;
        if (customTag && customTag.trim()) {
          // Handle comma-separated tags
          customTag.split(',').forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) tags.add(trimmed);
          });
        }
      });

      console.log('[GetCustomTags] Processed page', page + 1, '- Found', tags.size, 'unique tags so far');
      
      // Stop early if we've fetched all contacts
      if ((data.contacts || []).length < 1000) break;
    }

    const tagArray = Array.from(tags).sort();
    
    console.log('[GetCustomTags] Total unique tags found:', tagArray.length);

    // Cache the results
    tagCache = tagArray;
    cacheTimestamp = now;

    return ok(headers, {
      success: true,
      tags: tagArray,
      count: tagArray.length,
      cached: false
    });

  } catch (err) {
    console.error('[GetCustomTags] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

