// src/services/tickerService.js
// Normalizes backend responses, avoids .filter() on non-arrays,
// and provides generators to create ticker items from data snapshots.

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
 * @param {Array} items - array of { message, category, source, link?, recommendation?, urgency?, createdAt? }
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

/**
 * Generate ticker items from AI insights payload
 * (used by Dashboard after /getAIInsights).
 *
 * @param {object} insights - response from getAIInsights
 * @returns {Array<{message:string, category:string, source:string, link?:string, urgency?:string, createdAt:string}>}
 */
export function generateAIInsightsTickerItems(insights) {
  if (!insights || typeof insights !== 'object') return [];

  const nowIso = new Date().toISOString();
  const items = [];

  // Executive summary headline
  if (insights.executiveSummary) {
    items.push({
      createdAt: nowIso,
      message: truncate(`Executive Summary: ${insights.executiveSummary}`, 220),
      category: 'AI',
      source: 'auto-ai',
      urgency: 'info'
    });
  }

  // Top priorities (limit 3 to keep ticker tidy)
  if (Array.isArray(insights.topPriorities)) {
    insights.topPriorities.slice(0, 3).forEach((p, idx) => {
      const title = p?.title ? `Priority: ${p.title}` : 'Priority';
      const action = p?.action ? ` → ${p.action}` : '';
      const msg = `${title}${action}`;
      items.push({
        createdAt: nowIso,
        message: truncate(msg, 180),
        category: 'Priority',
        source: 'auto-ai',
        urgency: p?.urgency || 'medium'
      });
    });
  }

  // Priority bids (surface the first few with due dates)
  if (Array.isArray(insights.priorityBids)) {
    insights.priorityBids.slice(0, 3).forEach((b) => {
      const dueTxt = b?.dueDate ? ` (Due: ${b.dueDate})` : '';
      const lead = b?.entity || b?.bidSystem || 'Opportunity';
      const msg = `${lead}: ${b?.subject || 'No subject'}${dueTxt}`;
      items.push({
        createdAt: nowIso,
        message: truncate(msg, 180),
        category: 'Bids',
        source: 'auto-ai',
        urgency: (b?.daysUntilDue != null && b.daysUntilDue <= 3) ? 'high'
              : (b?.daysUntilDue != null && b.daysUntilDue <= 7) ? 'medium'
              : 'low',
        link: b?.url || ''
      });
    });
  }

  // News opportunities (limit 2)
  if (Array.isArray(insights.newsArticles)) {
    insights.newsArticles.slice(0, 2).forEach((n) => {
      items.push({
        createdAt: nowIso,
        message: truncate(`News: ${n?.title || 'Untitled'}`, 180),
        category: 'News',
        source: 'auto-ai',
        urgency: 'info',
        link: n?.link || ''
      });
    });
  }

  return items;
}

/**
 * Generate ticker items for System Admin feed (e.g., “X new admin alerts”).
 * You can call this with either:
 *  - the `summary` block (containing newAdminEmailsCount), or
 *  - a raw admin emails array.
 *
 * @param {object|Array} input
 * @returns {Array}
 */
export function generateSystemAdminTickerItems(input) {
  const nowIso = new Date().toISOString();
  const items = [];

  // If summary-style object
  if (input && !Array.isArray(input) && typeof input === 'object') {
    const count = Number(input.newAdminEmailsCount ?? input?.systemAdmin?.newCount ?? 0) || 0;
    if (count > 0) {
      items.push({
        createdAt: nowIso,
        message: `System Admin: ${count} new alert${count > 1 ? 's' : ''}`,
        category: 'System',
        source: 'auto-admin',
        urgency: count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low'
      });
    }
    return items;
  }

  // If raw array of admin emails
  if (Array.isArray(input)) {
    const fresh = input.filter(e => String(e?.status || '').toLowerCase() === 'new');
    const count = fresh.length;
    if (count > 0) {
      items.push({
        createdAt: nowIso,
        message: `System Admin: ${count} new alert${count > 1 ? 's' : ''}`,
        category: 'System',
        source: 'auto-admin',
        urgency: count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low'
      });
    }
  }

  return items;
}

// -------- helpers --------
function truncate(s, n) {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}
