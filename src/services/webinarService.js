// src/services/webinarService.js

/**
 * Webinar Service
 * - Fetch with query options (status, q, since/until, paging)
 * - Abortable requests
 * - ETag + localStorage caching (SWR-lite)
 * - Light schema validation (defensive)
 */

const BASE = '/.netlify/functions/getWebinars';
const CACHE_KEY = 'webinars.cache.v1';

/** Build query string safely */
function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach(x => search.append(k, x));
    else search.set(k, String(v));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Light shape validation to avoid UI crashes */
function normalizeWebinar(raw = {}) {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Untitled'),
    startTime: raw.startTime ? String(raw.startTime) : null, // ISO string
    endTime: raw.endTime ? String(raw.endTime) : null,       // ISO string
    status: String(raw.status ?? 'scheduled'),               // scheduled|live|completed|canceled
    platform: String(raw.platform ?? ''),                    // Zoom/Teams/etc
    host: String(raw.host ?? ''),
    registrationUrl: raw.registrationUrl ? String(raw.registrationUrl) : '',
    description: String(raw.description ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
  };
}

function validateArray(data) {
  if (!Array.isArray(data)) return [];
  return data.map(normalizeWebinar);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { etag, ts, data } = JSON.parse(raw);
    return { etag, ts, data: validateArray(data) };
  } catch {
    return null;
  }
}

function writeCache(etag, data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ etag: etag || '', ts: Date.now(), data })
    );
  } catch {
    // ignore quota errors
  }
}

/**
 * Fetch webinars with options
 * @param {Object} opts
 * @param {AbortSignal} opts.signal
 * @param {'scheduled'|'live'|'completed'|'canceled'|undefined} opts.status
 * @param {string} opts.q - search term
 * @param {string} opts.since - ISO date
 * @param {string} opts.until - ISO date
 * @param {number} opts.limit
 * @param {number} opts.page
 * @param {boolean} opts.useCache - default true
 */
export async function fetchWebinars(opts = {}) {
  const {
    signal,
    status,
    q,
    since,
    until,
    limit,
    page,
    useCache = true,
  } = opts;

  const cache = useCache ? readCache() : null;
  const headers = { 'Content-Type': 'application/json' };

  // If we have an ETag, ask server if changed
  if (cache?.etag) headers['If-None-Match'] = cache.etag;

  // Optional: include a simple anti-spoof header (rotate value on server)
  // headers['X-Client'] = '49N-CommandCenter';

  const url = `${BASE}${toQuery({ status, q, since, until, limit, page })}`;

  let resp;
  try {
    resp = await fetch(url, { method: 'GET', headers, signal });
  } catch (err) {
    // Network error → fall back to cache if available
    if (cache?.data?.length) return { success: true, fromCache: true, items: cache.data };
    throw err;
  }

  // 304 Not Modified → use cache
  if (resp.status === 304 && cache?.data?.length) {
    return { success: true, fromCache: true, items: cache.data };
  }

  // Non-2xx with useful message
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const msg = text || `Failed to fetch webinars (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  // Parse + validate
  const etag = resp.headers.get('ETag') || '';
  const json = await resp.json().catch(() => ({}));
  const items = validateArray(json?.items || json?.webinars || json);

  // Write cache
  if (useCache) writeCache(etag, items);

  return { success: true, fromCache: false, items, etag };
}

/** Convenience: get next N upcoming webinars (client-side filter) */
export async function fetchUpcomingWebinars({ days = 14, now = new Date(), signal } = {}) {
  const res = await fetchWebinars({ signal, status: 'scheduled' });
  if (!res?.success) return res;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);

  const items = res.items
    .filter(w => w.startTime)
    .filter(w => {
      const t = new Date(w.startTime);
      return t >= now && t <= cutoff;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return { success: true, items, fromCache: res.fromCache };
}

/** Helpers for analysis (counts for dashboard cards) */
export function summarizeWebinars(items = []) {
  const out = { total: items.length, scheduled: 0, live: 0, completed: 0, canceled: 0 };
  for (const w of items) {
    if (out[w.status] !== undefined) out[w.status]++;
  }
  return out;
}
