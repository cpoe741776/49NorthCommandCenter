// src/services/tickerService.js
// Centralized ticker utilities: fetching, pushing, and generating
// items from multiple data sources. Safe, defensive, and exhaustive
// exports so builds don't fail on missing named exports.

function withAuthHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined' && window.__APP_TOKEN) {
    headers.set('X-App-Token', window.__APP_TOKEN);
  }
  return { ...init, headers };
}

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export async function fetchTickerItems() {
  try {
    const res = await fetch('/.netlify/functions/getTickerFeed', withAuthHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = normalizeItems(data);

    const active = items.filter(i => (String(i?.status || '')).toLowerCase() !== 'archived');

    active.sort((a, b) => {
      const aTs = Date.parse(a?.createdAt || a?.timestamp || 0) || 0;
      const bTs = Date.parse(b?.createdAt || b?.timestamp || 0) || 0;
      return bTs - aTs;
    });

    return active;
  } catch (err) {
    console.error('Error fetching ticker items:', err);
    return [];
  }
}

export async function pushAutoTickerItems(items, source = 'auto') {
  try {
    const payload = { items: Array.isArray(items) ? items : [], source };
    const res = await fetch(
      '/.netlify/functions/refreshAutoTickerItems',
      withAuthHeaders({ method: 'POST', body: JSON.stringify(payload) })
    );
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

/** ===== Generators (AI Insights) ===== */
export function generateAIInsightsTickerItems(insights) {
  if (!insights || typeof insights !== 'object') return [];
  const nowIso = new Date().toISOString();
  const items = [];

  if (insights.executiveSummary) {
    items.push({
      createdAt: nowIso,
      message: truncate(`Executive Summary: ${insights.executiveSummary}`, 220),
      category: 'AI',
      source: 'auto-ai',
      urgency: 'info'
    });
  }

  if (Array.isArray(insights.topPriorities)) {
    insights.topPriorities.slice(0, 3).forEach((p) => {
      const title = p?.title ? `Priority: ${p.title}` : 'Priority';
      const action = p?.action ? ` → ${p.action}` : '';
      items.push({
        createdAt: nowIso,
        message: truncate(`${title}${action}`, 180),
        category: 'Priority',
        source: 'auto-ai',
        urgency: p?.urgency || 'medium'
      });
    });
  }

  if (Array.isArray(insights.priorityBids)) {
    insights.priorityBids.slice(0, 3).forEach((b) => {
      const dueTxt = b?.dueDate ? ` (Due: ${b.dueDate})` : '';
      const lead = b?.entity || b?.bidSystem || 'Opportunity';
      items.push({
        createdAt: nowIso,
        message: truncate(`${lead}: ${b?.subject || 'No subject'}${dueTxt}`, 180),
        category: 'Bids',
        source: 'auto-ai',
        urgency: (b?.daysUntilDue != null && b.daysUntilDue <= 3) ? 'high'
              : (b?.daysUntilDue != null && b.daysUntilDue <= 7) ? 'medium'
              : 'low',
        link: b?.url || ''
      });
    });
  }

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

/** ===== Generators (System Admin) ===== */
export function generateSystemAdminTickerItems(input) {
  const nowIso = new Date().toISOString();
  const items = [];
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

/** ===== Generators (Bids: Respond) ===== */
export function generateTickerItemsFromBids(bids, limit = 5) {
  if (!Array.isArray(bids) || bids.length === 0) return [];
  const nowIso = new Date().toISOString();

  const normalized = bids
    .filter(b => (b?.recommendation || '').toLowerCase() === 'respond')
    .sort((a, b) => toSafeDays(a?.daysUntilDue) - toSafeDays(b?.daysUntilDue))
    .slice(0, limit);

  return normalized.map((b) => {
    const dueTxt = b?.dueDate ? ` (Due: ${b.dueDate})` : '';
    const lead = b?.entity || b?.bidSystem || 'Opportunity';
    return {
      createdAt: nowIso,
      message: truncate(`${lead}: ${b?.subject || 'No subject'}${dueTxt}`, 180),
      category: 'Bids',
      source: 'auto-bids',
      urgency: (b?.daysUntilDue != null && b.daysUntilDue <= 3) ? 'high'
            : (b?.daysUntilDue != null && b.daysUntilDue <= 7) ? 'medium'
            : 'low',
      link: b?.url || ''
    };
  });
}

/** ===== Generators (Bids: Submitted) ===== */
export function generateSubmittedBidItems(bids, limit = 5) {
  if (!Array.isArray(bids) || bids.length === 0) return [];
  const nowIso = new Date().toISOString();

  const submitted = bids
    .filter(b => (b?.status || '').toLowerCase() === 'submitted')
    .sort((a, b) => {
      const aTs = Date.parse(a?.dateAdded || a?.emailDateReceived || 0) || 0;
      const bTs = Date.parse(b?.dateAdded || b?.emailDateReceived || 0) || 0;
      return bTs - aTs;
    })
    .slice(0, limit);

  return submitted.map((b) => {
    const when =
      b?.dateAdded || b?.emailDateReceived
        ? ` (Sent: ${(b.dateAdded || b.emailDateReceived).slice(0, 10)})`
        : '';
    const lead = b?.entity || b?.bidSystem || 'Submission';
    return {
      createdAt: nowIso,
      message: truncate(`${lead}: ${b?.subject || 'Untitled submission'}${when}`, 180),
      category: 'Submitted',
      source: 'auto-bids',
      urgency: 'info',
      link: b?.url || ''
    };
  });
}

/** ===== Optional Generators (to avoid future “missing export”s) ===== */
export function generateDisregardedBidItems(bids, limit = 5) {
  if (!Array.isArray(bids) || bids.length === 0) return [];
  const nowIso = new Date().toISOString();
  return bids
    .filter(b => (b?.status || '').toLowerCase() === 'disregarded')
    .slice(0, limit)
    .map(b => ({
      createdAt: nowIso,
      message: truncate(`Disregarded: ${b?.subject || 'Opportunity'} — ${b?.aiReasoning || 'No reason'}`, 180),
      category: 'Bids',
      source: 'auto-bids',
      urgency: 'low',
      link: b?.url || ''
    }));
}

export function generateWebinarTickerItems(webinars, limit = 3) {
  if (!Array.isArray(webinars) || webinars.length === 0) return [];
  const nowIso = new Date().toISOString();
  return webinars
    .sort((a, b) => Date.parse(a?.date || 0) - Date.parse(b?.date || 0))
    .slice(0, limit)
    .map(w => ({
      createdAt: nowIso,
      message: truncate(`Webinar: ${w?.title || 'Untitled'} (${w?.date || 'TBA'})`, 180),
      category: 'Webinar',
      source: 'auto-webinars',
      urgency: 'info'
    }));
}

export function generateNewsTickerItems(articles, limit = 3) {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  const nowIso = new Date().toISOString();
  return articles.slice(0, limit).map(n => ({
    createdAt: nowIso,
    message: truncate(`News: ${n?.title || 'Untitled'}`, 180),
    category: 'News',
    source: 'auto-news',
    urgency: 'info',
    link: n?.link || ''
  }));
}

/* ---------- helpers ---------- */
function truncate(s, n) {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}
function toSafeDays(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 9999;
}
