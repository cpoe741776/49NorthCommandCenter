const { requireAuth } = require('./_utils/auth');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const auth = await requireAuth(event, context);
  if (!auth.ok) return { ...auth.response, headers: { ...headers, ...(auth.response.headers || {}) } };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      authenticated: true,
      user: {
        id: auth.user.id || null,
        email: auth.user.email || null,
      },
    }),
  };
};
