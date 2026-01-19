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
  // Pass through ALL fields from getBids.js without stripping
  return {
    // Core fields
    id: String(b.id ?? b.rowId ?? ''),
    recommendation: String(b.recommendation ?? ''),

    // Active_Bids fields (A-U)
    scoreDetails: b.scoreDetails ?? '',
    aiReasoning: String(b.aiReasoning ?? b.reasoning ?? ''),
    aiEmailSummary: String(b.aiEmailSummary ?? b.emailSummary ?? b.aiSummary ?? ''),
    emailDateReceived: b.emailDateReceived ? String(b.emailDateReceived) : '',
    emailFrom: String(b.emailFrom ?? ''),
    keywordsCategory: String(b.keywordsCategory ?? ''),
    keywordsFound: String(b.keywordsFound ?? ''),
    relevance: String(b.relevance ?? ''),
    emailSubject: String(b.emailSubject ?? b.subject ?? b.title ?? ''),
    emailBody: String(b.emailBody ?? ''),
    url: String(b.url ?? ''),
    dueDate: b.dueDate ? String(b.dueDate) : '',
    significantSnippet: String(b.significantSnippet ?? ''),
    emailDomain: String(b.emailDomain ?? ''),
    bidSystem: String(b.bidSystem ?? b.platform ?? ''),
    country: String(b.country ?? ''),
    entity: String(b.entity ?? b.agency ?? b.client ?? ''),
    status: String(b.status ?? ''),
    dateAdded: b.dateAdded ? String(b.dateAdded) : '',
    sourceEmailId: String(b.sourceEmailId ?? ''),

    // Submitted-specific
    submissionDate: b.submissionDate ?? '',
    reasoning: String(b.reasoning ?? ''),
    emailSummary: String(b.emailSummary ?? ''),

    // Back-compat
    subject: String(b.emailSubject ?? b.subject ?? b.title ?? ''),
    aiSummary: String(b.aiEmailSummary ?? b.emailSummary ?? b.aiSummary ?? ''),

    // Computed
    daysUntilDue: safeNum(b.daysUntilDue, null),

    // Debug
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
 * Accepts EITHER (bypassCache:boolean) OR ({ bypassCache?: boolean, force?: boolean, signal?: AbortSignal }).
 * Returns: { success: boolean, summary: Object, fromCache?: boolean }
 */
export async function fetchDashboardData(arg = false) {
  // normalize args
  const opts = typeof arg === 'object' ? arg : { bypassCache: !!arg };
  const { bypassCache = false, force = false, signal } = opts;

  // Force implies bypassCache
  const effectiveBypass = force || bypassCache;

  let url = `${API_BASE_URL}/getDashboardData`;
  if (effectiveBypass) url += `?noCache=1&_ts=${Date.now()}`;

  const cache = (!effectiveBypass) ? readCache(DASH_CACHE_KEY) : null;

  // IMPORTANT: when forcing, do NOT send If-None-Match (prevents 304)
  const headers = { 'Content-Type': 'application/json' };
  if (cache?.etag && !effectiveBypass) headers['If-None-Match'] = cache.etag;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers,
      signal,
      cache: effectiveBypass ? 'no-store' : 'default',
    });
  } catch (error) {
    console.error('Network error fetching dashboard data:', error);
    if (cache?.data) return { success: true, summary: cache.data.summary || {}, fromCache: true };
    throw error;
  }

  // If we forced, 304 should never be considered valid
  if (resp.status === 304) {
    if (cache?.data && !effectiveBypass) {
      return { success: true, summary: cache.data.summary || {}, fromCache: true };
    }
    // Force mode + 304 = treat as empty safe response so UI can't hold stale state
    return { success: true, summary: {}, fromCache: false };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `HTTP error! status: ${resp.status}`);
  }

  const etag = resp.headers.get('ETag') || '';
  const json = await resp.json().catch(() => ({}));
  const summary = json?.summary && typeof json.summary === 'object' ? json.summary : json || {};

  if (!effectiveBypass) {
    writeCache(DASH_CACHE_KEY, { etag, ts: Date.now(), data: { summary } });
  }

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
 *  - force: boolean (default false) -> bypass ALL caches and forbid 304 usage
 * Returns: { success, activeBids, submittedBids, disregardedBids, fromCache? }
 */
export async function fetchBids(opts = {}) {
  const {
    signal,
    status,
    q,
    since,
    until,
    limit,
    page,
    useCache = true,
    force = false,
  } = opts;

  // Force means: no localStorage cache + no If-None-Match + no-store + cache-buster
  const effectiveUseCache = !!useCache && !force;

  const cache = effectiveUseCache ? readCache(BIDS_CACHE_KEY) : null;

  const headers = { 'Content-Type': 'application/json' };

  // Only send If-None-Match for default (unfiltered) pulls AND not force
  const isDefaultPull = !status && !q && !since && !until && !page;
  if (cache?.etag && isDefaultPull && !force) {
    headers['If-None-Match'] = cache.etag;
  }

  const baseParams = { status, q, since, until, limit, page };
  const extraParams = force ? { noCache: 1, _ts: Date.now() } : {};
  const url = `${API_BASE_URL}/getBids${qs({ ...baseParams, ...extraParams })}`;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers,
      signal,
      cache: force ? 'no-store' : 'default',
    });
  } catch (error) {
    console.error('Network error fetching bids:', error);
    if (cache?.data) return { success: true, ...normalizeSets(cache.data), fromCache: true };
    throw error;
  }

  // 304 handling:
  // - if force: NEVER use cache, return empty safe payload
  // - else: use localStorage cache if present
  if (resp.status === 304) {
    if (!force && cache?.data) {
      return { success: true, ...normalizeSets(cache.data), fromCache: true };
    }
    return {
      success: true,
      activeBids: [],
      submittedBids: [],
      disregardedBids: [],
      fromCache: false,
      meta: { forced304: true },
    };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `HTTP error! status: ${resp.status}`);
  }

  const etag = resp.headers.get('ETag') || '';
  const json = await resp.json().catch(() => ({}));
  if (!json?.success) throw new Error(json?.error || 'Failed to fetch bids');

  const sets = normalizeSets(json);

  // Only write local cache for default unfiltered pull when NOT forcing
  if (effectiveUseCache && isDefaultPull) {
    writeCache(BIDS_CACHE_KEY, { etag, ts: Date.now(), data: json });
  }

  return { success: true, ...sets, fromCache: false, meta: json?.meta || undefined };
}

/** Manual refresh for convenience */
export async function refreshBids() {
  return fetchBids({ useCache: false, force: true });
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
