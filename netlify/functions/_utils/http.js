// Lightweight HTTP helpers + auth guard used across functions

const APP_TOKEN = process.env.APP_TOKEN || '';

function corsHeaders(origin) {
  // You can tighten this by whitelisting your domain
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

function methodGuard(event, headers, ...allowed) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!allowed.includes(event.httpMethod)) {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }
  return null;
}

function safeJson(str) {
  try {
    return [str ? JSON.parse(str) : null, null];
  } catch (e) {
    return [null, e];
  }
}

function ok(headers, payload) {
  return {
    statusCode: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function bad(headers, message = 'Bad Request') {
  return {
    statusCode: 400,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error: message }),
  };
}

function unauth(headers, message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error: message }),
  };
}

function serverErr(headers, message = 'Internal Server Error') {
  return {
    statusCode: 500,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error: message }),
  };
}

/**
 * Simple shared-secret header check.
 * - If APP_TOKEN is unset, allow all (no auth required).
 * - If APP_TOKEN is set, require header `X-App-Token` to match.
 */
function checkAuth(event) {
  if (!APP_TOKEN) return true;
  const provided = event.headers?.['x-app-token'] || event.headers?.['X-App-Token'];
  return provided === APP_TOKEN;
}

/**
 * fetch() with an explicit timeout. Throws on timeout or network error.
 * Default 10s — override per call.
 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    throw err;
  }
}

module.exports = {
  corsHeaders,
  methodGuard,
  safeJson,
  ok,
  bad,
  unauth,
  serverErr,
  checkAuth,
  fetchWithTimeout,
};
