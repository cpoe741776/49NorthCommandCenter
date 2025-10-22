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

    console.log('[GetSegments] Fetching Brevo segments...');

    // Fetch all lists from Brevo
    const res = await fetch('https://api.brevo.com/v3/contacts/lists?limit=50', {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    if (!res.ok) {
      throw new Error(`Brevo API error: ${res.status}`);
    }

    const data = await res.json();
    
    // Map to simpler format
    const segments = (data.lists || []).map(list => ({
      id: list.id,
      name: list.name,
      totalContacts: list.totalSubscribers || 0,
      uniqueSubscribers: list.uniqueSubscribers || 0
    }));

    console.log('[GetSegments] Found', segments.length, 'segments');

    return ok(headers, {
      success: true,
      segments,
      count: segments.length
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

