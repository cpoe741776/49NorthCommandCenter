// src/services/aiInsightsService.js

const BASE = '/.netlify/functions/getAIInsights';
const CACHE_KEY_FAST = 'ai.insights.v1.fast';
const CACHE_KEY_FULL = 'ai.insights.v1.full';

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { etag, ts, data } = JSON.parse(raw);
    return { etag, ts, data };
  } catch {
    return null;
  }
}
function writeCache(key, etag, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ etag: etag || '', ts: Date.now(), data }));
  } catch {}
}

function withTimeout(signal, ms = 15000) {
  if (!ms) return { signal, cancel: () => {} };
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const t = setTimeout(() => ctrl.abort(), ms);
  const cancel = () => {
    clearTimeout(t);
    signal?.removeEventListener?.('abort', onAbort);
  };
  return { signal: ctrl.signal, cancel };
}

function normalizeInsights(json = {}) {
  const safeArray = (a) => (Array.isArray(a) ? a : []);
  const toStr = (v, def = '') => (v == null ? def : String(v));

  const topPriorities = safeArray(json.topPriorities).map(p => ({
    title: toStr(p.title, 'Priority'),
    action: toStr(p.action, ''),
    urgency: toStr(p.urgency, 'medium'),
  }));

  const priorityBids = safeArray(json.priorityBids).map(b => ({
    subject: toStr(b.subject, ''),
    entity: toStr(b.entity, ''),
    bidSystem: toStr(b.bidSystem, ''),
    url: toStr(b.url, ''),
    dueDate: toStr(b.dueDate, ''),
    daysUntilDue: Number.isFinite(Number(b.daysUntilDue)) ? Number(b.daysUntilDue) : null,
  }));

  const newsArticles = safeArray(json.newsArticles).map(n => ({
    title: toStr(n.title, 'Untitled'),
    link: toStr(n.link, ''),
    source: toStr(n.source, ''),
    publishedAt: toStr(n.publishedAt, ''),
  }));

  return {
    mode: json.mode === 'full' ? 'full' : 'fast',
    generatedAt: toStr(json.generatedAt, new Date().toISOString()),
    executiveSummary: toStr(json.executiveSummary, ''),
    topPriorities,
    priorityBids,
    newsArticles,
  };
}

/**
 * Fetch AI insights (fast or full), with abort, timeout, ETag cache, and graceful fallback.
 * @param {boolean|object} arg  - if boolean, interpreted as bypassCache. If object, options below.
 * @param {object} opts2        - legacy second arg for { full } support.
 * Options:
 *  - bypassCache: boolean
 *  - full: boolean (default false → fast)
 *  - signal: AbortSignal
 *  - timeoutMs: number (default 15000 fast / 30000 full)
 *  - retries: number (network retry attempts, default 1)
 */
export async function fetchAIInsights(arg = false, opts2 = {}) {
  // Backward-compat with (bypassCache, { full })
  const opts = typeof arg === 'object'
    ? arg
    : { bypassCache: !!arg, ...opts2 };

  const {
    bypassCache = false,
    full = false,
    signal,
    timeoutMs = full ? 30000 : 15000,
    retries = 1,
  } = opts;

  const cacheKey = full ? CACHE_KEY_FULL : CACHE_KEY_FAST;
  const cache = readCache(cacheKey);

  const qs = [];
  if (!full) qs.push('fast=1');
  if (bypassCache) qs.push(`t=${Date.now()}`);
  const url = `${BASE}${qs.length ? `?${qs.join('&')}` : ''}`;

  const headers = { 'Content-Type': 'application/json' };
  if (cache?.etag && !bypassCache) headers['If-None-Match'] = cache.etag;

  const attempt = async () => {
    const { signal: timedSignal, cancel } = withTimeout(signal, timeoutMs);
    try {
      let res = await fetch(url, { method: 'GET', headers, signal: timedSignal });

      // If full times out or svc unavailable, fall back to fast path immediately
      if ((res.status === 504 || res.status === 503) && full) {
        const fastUrl = `${BASE}?fast=1&t=${Date.now()}`;
        console.warn(`[AI] Full analysis failed (${res.status}). Falling back to fast: ${fastUrl}`);
        res = await fetch(fastUrl, { headers, signal: timedSignal });
      }

      if (res.status === 304 && cache?.data) {
        cancel();
        return { ok: true, etag: cache.etag, json: cache.data, fromCache: true };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Failed to fetch AI insights (HTTP ${res.status})`);
      }

      const etag = res.headers.get('ETag') || '';
      const json = await res.json().catch(() => ({}));
      cancel();
      return { ok: true, etag, json, fromCache: false };
    } catch (e) {
      cancel();
      throw e;
    }
  };

  // simple retry loop
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await attempt();
      const normalized = normalizeInsights(result.json);
      if (!result.fromCache) writeCache(cacheKey, result.etag, normalized);
      return normalized;
    } catch (err) {
      const last = i === retries;
      console.warn(`[AI] attempt ${i + 1} failed:`, err?.message || err);
      if (last) {
        // Final fallback: return cached (if any), else throw
        if (cache?.data) {
          console.info('[AI] using cached insights due to failures');
          return cache.data;
        }
        throw err;
      }
      // brief backoff
      await new Promise(r => setTimeout(r, 300 + i * 300));
    }
  }
}
