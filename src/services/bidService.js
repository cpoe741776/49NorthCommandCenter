// src/services/bidService.js

const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? '/.netlify/functions'
    : 'http://localhost:8888/.netlify/functions';

// ---- small utils ----
function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) v.forEach(x => sp.append(k, x));
    else sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function safeNum(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

// ---- normalization (defensive) ----
function normalizeBid(b = {}) {
  return {
    id: String(b.id ?? b.rowId ?? ''),
    subject: String(b.subject ?? b.title ?? 'Untitled'),
    entity: String(b.entity ?? b.agency ?? b.client ?? ''),
    bidSystem: String(b.bidSystem ?? b.platform ?? ''),
    status: String(b.status ?? '').toLowerCase(), // e.g., 'active','submitted','disregarded'
    recommendation: String(b.recommendation ?? '').toLowerCase(), // 'respond' | 'disregard' | ''
    dueDate: b.dueDate ? String(b.dueDate) : '',
    daysUntilDue: safeNum(b.daysUntilDue, null),
    dateAdded: b.dateAdded ? String(b.dateAdded) : '',
    emailDateReceived: b.emailDateReceived ? String(b.emailDateReceived) : '',
    url: String(b.url ?? ''),
    aiReasoning: String(b.aiReasoning ?? ''),
    // keep original for debugging
    _raw: b,
  };
}

function normalizeSets(data = {}) {
  // server may send {activeBids, submittedBids, disregardedBids}
  const active = Array.isArray(data.activeBids) ? data.activeBids.map(normalizeBid) : [];
  const submitted = Array.isArray(data.submittedBids) ? data.submittedBids.map(normalizeBid) : [];
  const disregarded = Array.isArray(data.disregardedBids) ? data.disregardedBids.map(normalizeBid) : [];
  return { activeBids: active, submittedBids: submitted, disregardedBids: disregarded };
}

const DASH_CACHE_KEY = 'bids.dashboard.v1';
const BIDS_CACHE_KEY = 'bids.full.v1';

// ---- cache helpers ----
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}
function writeCache(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

/**
 * Fetches FAST dashboard data (KPI counts).
 * Accepts EITHER (bypassCache:boolean) OR ({ bypassCache?: boolean, signal?: AbortSignal }).
 * Returns: { success: boolean, summary: Object, fromCache?: boolean }
 */
export async function fetchDashboardData(arg = false) {
  // normalize args
  const opts = typeof arg === 'object' ? arg : { bypassCache: !!arg };
  const { bypassCache = false, signal } = opts;

  let url = `${API_BASE_URL}/getDashboardData`;
  if (bypassCache) url += `?t=${Date.now()}`;

  const cache = readCache(DASH_CACHE_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (cache?.etag && !bypassCache) headers['If-None-Match'] = cache.etag;

  let resp;
  try {
    resp = await fetch(url, { method: 'GET', headers, signal });
  } catch (error) {
    console.error('Network error fetching dashboard data:', error);
    if (cache?.data) return { success: true, summary: cache.data.summary || {}, fromCache: true };
    throw error;
  }

  if (resp.status === 304 && cache?.data) {
    return { success: true, summary: cache.data.summary || {}, fromCache: true };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `HTTP error! status: ${resp.status}`);
  }

  const etag = resp.headers.get('ETag') || '';
  const json = await resp.json().catch(() => ({}));
  const summary = json?.summary && typeof json.summary === 'object' ? json.summary : json || {};

  writeCache(DASH_CACHE_KEY, { etag, ts: Date.now(), data: { summary } });
  return { success: true, summary, fromCache: false };
}

/**
 * Fetch bids with optional filters.
 * @param {Object} opts
 *  - signal: AbortSignal
 *  - status: 'active'|'submitted'|'disregarded' (server should filter)
 *  - q: search term
 *  - since/until: ISO dates
 *  - limit/page: pagination hints
 *  - useCache: boolean (default true)
 * Returns: { success, activeBids, submittedBids, disregardedBids, fromCache? }
 */
export async function fetchBids(opts = {}) {
  const { signal, status, q, since, until, limit, page, useCache = true } = opts;

  const cache = useCache ? readCache(BIDS_CACHE_KEY) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (cache?.etag && !status && !q && !since && !until && !page) {
    headers['If-None-Match'] = cache.etag; // only for default (unfiltered) pulls
  }

  const url = `${API_BASE_URL}/getBids${qs({ status, q, since, until, limit, page })}`;

  let resp;
  try {
    resp = await fetch(url, { method: 'GET', headers, signal });
  } catch (error) {
    console.error('Network error fetching bids:', error);
    if (cache?.data) return { success: true, ...normalizeSets(cache.data), fromCache: true };
    throw error;
  }

  if (resp.status === 304 && cache?.data) {
    return { success: true, ...normalizeSets(cache.data), fromCache: true };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `HTTP error! status: ${resp.status}`);
  }

  const etag = resp.headers.get('ETag') || '';
  const json = await resp.json().catch(() => ({}));
  if (!json?.success) throw new Error(json?.error || 'Failed to fetch bids');

  const sets = normalizeSets(json);
  if (useCache && !status && !q && !since && !until && !page) {
    writeCache(BIDS_CACHE_KEY, { etag, ts: Date.now(), data: json });
  }

  return { success: true, ...sets, fromCache: false };
}

/** Manual refresh for convenience */
export async function refreshBids() {
  return fetchBids({ useCache: false });
}

/* ===== Mutations you can wire on the server (optional, for Upload flows) ===== */

export async function updateBidStatus(id, status) {
  const res = await fetch(`${API_BASE_URL}/updateBidStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error(`updateBidStatus failed: ${res.status}`);
  return await res.json();
}

export async function addBidNote(id, note) {
  const res = await fetch(`${API_BASE_URL}/addBidNote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, note }),
  });
  if (!res.ok) throw new Error(`addBidNote failed: ${res.status}`);
  return await res.json();
}

/** Ask server to rebuild caches / reindex AI fields (if you implement it) */
export async function reindexBids() {
  const res = await fetch(`${API_BASE_URL}/reindexBids`, { method: 'POST' });
  if (!res.ok) throw new Error(`reindexBids failed: ${res.status}`);
  return await res.json();
}
