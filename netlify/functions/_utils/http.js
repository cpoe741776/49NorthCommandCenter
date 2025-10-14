// netlify/functions/_utils/http.js
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function corsHeaders(origin) {
  const allow =
    ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
      ? (origin || '*')
      : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

function ok(headers, data)   { return { statusCode: 200, headers, body: JSON.stringify(data) }; }
function bad(headers, msg)   { return { statusCode: 400, headers, body: JSON.stringify({ error: msg }) }; }
function unauth(headers)     { return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }; }
function notAllowed(headers) { return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }; }
function serverErr(headers)  { return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }; }

function methodGuard(event, headers, ...allowed) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!allowed.includes(event.httpMethod)) return notAllowed(headers);
  return null; // proceed
}

function safeJson(body) {
  try { return [JSON.parse(body || '{}'), null]; }
  catch (e) { return [null, e]; }
}

// Simple shared-secret check (set APP_INBOUND_TOKEN in Netlify env); no secret → allow
function checkAuth(event) {
  const required = process.env.APP_INBOUND_TOKEN;
  if (!required) return true;
  const h = event.headers || {};
  const token = h['x-app-token'] || h['X-App-Token'] || h['authorization'] || h['Authorization'] || '';
  const clean = token.replace(/^Bearer\s+/i, '');
  return clean === required;
}

module.exports = {
  corsHeaders, ok, bad, unauth, notAllowed, serverErr,
  methodGuard, safeJson, checkAuth
};
