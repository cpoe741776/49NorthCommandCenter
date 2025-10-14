// src/services/tickerService.js
// Normalizes backend responses and avoids .filter() on non-arrays.
// Also (optionally) sends X-App-Token if window.__APP_TOKEN is set.

function withAuthHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  // Optional inbound token support (set window.__APP_TOKEN in your app if you enabled APP_INBOUND_TOKEN on Netlify)
  if (typeof window !== 'undefined' && window.__APP_TOKEN) {
    headers.set('X-App-Token', window.__APP_TOKEN);
  }
  return { ...init, headers };
}

function normalizeItems(data) {
  // Accept either an array or an object like { items: [...] }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Fetch ticker items from Netlify function.
 * Always returns an array (possibly empty). Never throws into UI code.
 */
export async function fetchTickerItems() {
  try {
    const res = await fetch('/.netlify/functions/getTickerFeed', withAuthHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = normalizeItems(data);

    // Defensive filtering/sorting with safe defaults
    const active = items.filter(i => (String(i?.status || '')).toLowerCase() !== 'archived');

    active.sort((a, b) => {
      const aTs = Date.parse(a?.createdAt || a?.timestamp || 0) || 0;
      const bTs = Date.parse(b?.createdAt || b?.timestamp || 0) || 0;
      return bTs - aTs;
    });

    return active;
  } catch (err) {
    console.error('Error fetching ticker items:', err);
    return []; // keep UI alive
  }
}

/**
 * Push auto-generated ticker items (from AI, etc.).
 * @param {Array} items - array of { message, category, source, link?, newRecommendation?, urgency?, createdAt? }
 * @param {string} source - e.g., 'auto-ai'
 */
export async function pushAutoTickerItems(items, source = 'auto') {
  try {
    const payload = { items: Array.isArray(items) ? items : [], source };
    const res = await fetch('/.netlify/functions/refreshAutoTickerItems', withAuthHeaders({
      method: 'POST',
      body: JSON.stringify(payload)
    }));
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`refreshAutoTickerItems failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data?.success === true;
  } catch (err) {
    console.error('pushAutoTickerItems error:', err);
    return false;
  }
}
