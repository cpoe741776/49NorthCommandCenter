const fetch = require('node-fetch');

function getPresentedToken(event = {}) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || '';
  const bearer = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (bearer && bearer[1]) return bearer[1].trim();

  return String(headers['x-app-token'] || headers['X-App-Token'] || '').trim();
}

async function verifyIdentityToken(token) {
  if (!token) return null;

  const siteUrl = String(process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '');
  if (!siteUrl) return null;

  try {
    const response = await fetch(`${siteUrl}/.netlify/identity/user`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;
    const user = await response.json().catch(() => null);
    return user && user.id ? user : null;
  } catch (error) {
    console.warn('[auth] Identity token verification failed:', error.message);
    return null;
  }
}

async function requireAuth(event, context) {
  if (context?.clientContext?.user) {
    return { ok: true, user: context.clientContext.user };
  }

  const token = getPresentedToken(event);
  const user = await verifyIdentityToken(token);
  if (user) return { ok: true, user };

  return {
    ok: false,
    response: {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    },
  };
}

module.exports = { requireAuth, getPresentedToken, verifyIdentityToken };
