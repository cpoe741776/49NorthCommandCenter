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
    
    console.log('[GetSegments] Lists data sample:', listsData.lists?.[0]);
    
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
      console.log('[GetSegments] Segments raw response:', JSON.stringify(segmentsData, null, 2));
      if (segmentsData.segments && segmentsData.segments.length > 0) {
        console.log('[GetSegments] First segment keys:', Object.keys(segmentsData.segments[0]));
      }
    } else {
      console.log('[GetSegments] Segments API returned:', segmentsRes.status);
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
        name: seg.segmentName || seg.segment_name || seg.name || `Segment ${seg.id}`,
        // Segments are dynamic queries - count not available from API
        // We'll show count after loading the segment
        totalContacts: '?', // Dynamic segments don't have pre-calculated counts
        categoryName: seg.categoryName || '',
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

