// netlify/functions/getBrevoSegments.js
// Fetches list of Brevo segments (lists) for dropdown selection

const { corsHeaders, methodGuard, ok } = require('./_utils/http');

const BREVO_API_KEY = process.env.BREVO_API_KEY;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    if (!BREVO_API_KEY) {
      return ok(headers, { success: false, error: 'BREVO_API_KEY not configured' });
    }

    console.log('[GetSegments] Fetching Brevo lists and segments...');

    // Fetch all lists from Brevo
    const listsRes = await fetch('https://api.brevo.com/v3/contacts/lists?limit=50&sort=desc', {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    if (!listsRes.ok) {
      throw new Error(`Brevo Lists API error: ${listsRes.status}`);
    }

    const listsData = await listsRes.json();
    
    // Also fetch segments (different from lists in Brevo)
    const segmentsRes = await fetch('https://api.brevo.com/v3/contacts/segments?limit=50', {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    let segmentsData = { segments: [] };
    if (segmentsRes.ok) {
      segmentsData = await segmentsRes.json();
    }
    
    // Combine lists and segments, exclude DATABASE MASTER (it's the full list)
    const allSegments = [
      ...(listsData.lists || []).filter(list => list.name !== 'DATABASE MASTER').map(list => ({
        id: list.id,
        name: list.name,
        totalContacts: list.totalSubscribers || list.totalBlacklisted || 0,
        type: 'list'
      })),
      ...(segmentsData.segments || []).map(seg => ({
        id: seg.id,
        name: seg.name,
        totalContacts: seg.categoryCount || 0,
        type: 'segment'
      }))
    ];

    console.log('[GetSegments] Found', listsData.lists?.length || 0, 'lists and', segmentsData.segments?.length || 0, 'segments');
    console.log('[GetSegments] Returning', allSegments.length, 'total segments (excluding DATABASE MASTER)');

    return ok(headers, {
      success: true,
      segments: allSegments,
      count: allSegments.length
    });

  } catch (err) {
    console.error('[GetSegments] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

