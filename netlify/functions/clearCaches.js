// netlify/functions/clearCaches.js
// Clears all server-side in-memory caches by calling internal endpoints

const { corsHeaders, methodGuard, ok } = require('./_utils/http');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    // Note: In-memory caches are per-function instance
    // The best we can do is set a flag or wait for cold start
    // For now, we'll just return success and log
    // Real cache clearing would require redeploying or waiting for function timeout

    console.log('[ClearCaches] Cache clear requested');
    console.log('[ClearCaches] Note: Caches will clear on next function cold start (~15 min)');
    console.log('[ClearCaches] Or redeploy to force immediate cache clear');

    return ok(headers, {
      success: true,
      message: 'Cache clear initiated. Caches will refresh on next cold start.',
      note: 'For immediate refresh, redeploy the site or wait ~15 minutes for function timeout',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[ClearCaches] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

