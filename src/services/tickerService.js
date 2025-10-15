// src/services/tickerService.js
// Centralized ticker utilities: fetching, pushing, and generating
// items from multiple data sources. Defensive, normalized outputs.

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

/** Map existing urgency -> priority (App.jsx expects "priority") */
function mapUrgencyToPriority(u) {
  const v = String(u || '').toLowerCase();
  if (v === 'critical' || v === 'high') return 'high';
  if (v === 'med' || v === 'medium' || v === 'warn') return 'medium';
  if (v === 'info' || v === 'low' || v === '') return 'low';
  return 'low';
}

/** Ensure an item has the keys the UI expects */
function normalizeForUI(item = {}) {
  const priority = item.priority || mapUrgencyToPriority(item.urgency);
  return {
    message: String(item.message || '').trim(),
    priority,
    category: item.category || 'General',
    source: item.source || 'unknown',
    createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
    link: item.link || '',
    target: item.target || item.route || null, // App checks either
    status: item.status || 'active',
    // keep original in case other views use it
    ...item,
  };
}

export async function fetchTickerItems() {
  try {
    const res = await fetch('/.netlify/functions/getTickerFeed', withAuthHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = normalizeItems(data)
      .map(normalizeForUI)
      .filter(i => i.status.toLowerCase() !== 'archived' && i.message.length > 0);

    items.sort((a, b) => {
      const aTs = Date.parse(a.createdAt) || 0;
      const bTs = Date.parse(b.createdAt) || 0;
      return bTs - aTs;
    });

    return items;
  } catch (err) {
    console.error('Error fetching ticker items:', err);
    return [];
  }
}

export async function pushAutoTickerItems(items, source = 'auto') {
  try {
    const safeItems = (Array.isArray(items) ? items : []).map(normalizeForUI);
    const payload = { items: safeItems, source };
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

/** ---------- Generators (AI Insights) ---------- */
export function generateAIInsightsTickerItems(insights) {
  if (!insights || typeof insights !== 'object') return [];
  const nowIso = new Date().toISOString();
  const out = [];

  if (insights.executiveSummary) {
    out.push(
      normalizeForUI({
        createdAt: nowIso,
        message: truncate(`Executive Summary: ${insights.executiveSummary}`, 220),
        category: 'AI',
        source: 'auto-ai',
        priority: 'medium',
        target: 'dashboard',
      })
    );
  }

  if (Array.isArray(insights.topPriorities)) {
    insights.topPriorities.slice(0, 3).forEach((p) => {
      const title = p?.title ? `Priority: ${p.title}` : 'Priority';
      const action = p?.action ? ` → ${p.action}` : '';
      out.push(
        normalizeForUI({
          createdAt: nowIso,
          message: truncate(`${title}${action}`, 180),
          category: 'Priority',
          source: 'auto-ai',
          priority: mapUrgencyToPriority(p?.urgency || 'medium'),
          target: 'dashboard',
        })
      );
    });
  }

  if (Array.isArray(insights.priorityBids)) {
    insights.priorityBids.slice(0, 3).forEach((b) => {
      const dueTxt = b?.dueDate ? ` (Due: ${b.dueDate})` : '';
      const lead = b?.entity || b?.bidSystem || 'Opportunity';
      const pr =
        b?.daysUntilDue != null && b.daysUntilDue <= 3 ? 'high' :
        b?.daysUntilDue != null && b.daysUntilDue <= 7 ? 'medium' : 'low';
      out.push(
        normalizeForUI({
          createdAt: nowIso,
          message: truncate(`${lead}: ${b?.subject || 'No subject'}${dueTxt}`, 180),
          category: 'Bids',
          source: 'auto-ai',
          priority: pr,
          link: b?.url || '',
          target: 'bids',
        })
      );
    });
  }

  if (Array.isArray(insights.newsArticles)) {
    insights.newsArticles.slice(0, 2).forEach((n) => {
      out.push(
        normalizeForUI({
          createdAt: nowIso,
          message: truncate(`News: ${n?.title || 'Untitled'}`, 180),
          category: 'News',
          source: 'auto-ai',
          priority: 'low',
          link: n?.link || '',
          target: 'dashboard',
        })
      );
    });
  }

  return out;
}

/** ---------- Generators (System Admin) ---------- */
export function generateSystemAdminTickerItems(input) {
  const nowIso = new Date().toISOString();
  const mk = (count) =>
    normalizeForUI({
      createdAt: nowIso,
      message: `System Admin: ${count} new alert${count > 1 ? 's' : ''}`,
      category: 'System',
      source: 'auto-admin',
      priority: count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low',
      target: 'bid-systems',
    });

  if (input && !Array.isArray(input) && typeof input === 'object') {
    const count = Number(input.newAdminEmailsCount ?? input?.systemAdmin?.newCount ?? 0) || 0;
    return count > 0 ? [mk(count)] : [];
  }
  if (Array.isArray(input)) {
    const fresh = input.filter(e => String(e?.status || '').toLowerCase() === 'new');
    const count = fresh.length;
    return count > 0 ? [mk(count)] : [];
  }
  return [];
}

/** ---------- Generators (Bids: Respond) ---------- */
export function generateTickerItemsFromBids(bids, limit = 5) {
  if (!Array.isArray(bids) || bids.length === 0) return [];
  const nowIso = new Date().toISOString();

  const normalized = bids
    .filter(b => (String(b?.recommendation || '')).toLowerCase() === 'respond')
    .sort((a, b) => toSafeDays(a?.daysUntilDue) - toSafeDays(b?.daysUntilDue))
    .slice(0, limit);

  return normalized.map((b) => {
    const dueTxt = b?.dueDate ? ` (Due: ${b.dueDate})` : '';
    const lead = b?.entity || b?.bidSystem || 'Opportunity';
    const priority =
      b?.daysUntilDue != null && b.daysUntilDue <= 3 ? 'high' :
      b?.daysUntilDue != null && b.daysUntilDue <= 7 ? 'medium' : 'low';

    return normalizeForUI({
      createdAt: nowIso,
      message: truncate(`${lead}: ${b?.subject || 'No subject'}${dueTxt}`, 180),
      category: 'Bids',
      source: 'auto-bids',
      priority,
      link: b?.url || '',
      target: 'bids',
    });
  });
}

/** ---------- Generators (Bids: Submitted) ---------- */
export function generateSubmittedBidItems(bids, limit = 5) {
  if (!Array.isArray(bids) || bids.length === 0) return [];
  const nowIso = new Date().toISOString();

  const submitted = bids
    .filter(b => (String(b?.status || '')).toLowerCase() === 'submitted')
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
    return normalizeForUI({
      createdAt: nowIso,
      message: truncate(`${lead}: ${b?.subject || 'Untitled submission'}${when}`, 180),
      category: 'Submitted',
      source: 'auto-bids',
      priority: 'low', // informational
      link: b?.url || '',
      target: 'bids',
    });
  });
}

/** ---------- Generators (Bids: Disregarded) ---------- */
export function generateDisregardedBidItems(bids, limit = 5) {
  if (!Array.isArray(bids) || bids.length === 0) return [];
  const nowIso = new Date().toISOString();
  return bids
    .filter(b => (String(b?.status || '')).toLowerCase() === 'disregarded')
    .slice(0, limit)
    .map(b =>
      normalizeForUI({
        createdAt: nowIso,
        message: truncate(`Disregarded: ${b?.subject || 'Opportunity'} — ${b?.aiReasoning || 'No reason'}`, 180),
        category: 'Bids',
        source: 'auto-bids',
        priority: 'low',
        link: b?.url || '',
        target: 'bids',
      })
    );
}

/** ---------- Generators (Webinars) ---------- */
export function generateWebinarTickerItems(webinars, limit = 3) {
  if (!Array.isArray(webinars) || webinars.length === 0) return [];
  const nowIso = new Date().toISOString();
  return webinars
    .sort((a, b) => Date.parse(a?.startTime || a?.date || 0) - Date.parse(b?.startTime || b?.date || 0))
    .slice(0, limit)
    .map(w =>
      normalizeForUI({
        createdAt: nowIso,
        message: truncate(`Webinar: ${w?.title || 'Untitled'} (${(w?.startTime || w?.date || 'TBA').toString().slice(0, 10)})`, 180),
        category: 'Webinar',
        source: 'auto-webinars',
        priority: 'low',
        target: 'webinars',
        link: w?.registrationUrl || '',
      })
    );
}

/** ---------- Generators (News) ---------- */
export function generateNewsTickerItems(articles, limit = 3) {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  const nowIso = new Date().toISOString();
  return articles.slice(0, limit).map(n =>
    normalizeForUI({
      createdAt: nowIso,
      message: truncate(`News: ${n?.title || 'Untitled'}`, 180),
      category: 'News',
      source: 'auto-news',
      priority: 'low',
      link: n?.link || '',
      target: 'dashboard',
    })
  );
}

/** ---------- Generators (Social - NEW) ---------- */
export function generateSocialMediaTickerItems(posts, limit = 5) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const nowIso = new Date().toISOString();
  return posts
    .slice(0, limit)
    .map(p =>
      normalizeForUI({
        createdAt: nowIso,
        message: truncate(
          `Social: ${p?.platform ? `[${p.platform}] ` : ''}${p?.title || p?.text || 'New post'}`,
          180
        ),
        category: 'Social',
        source: 'auto-social',
        priority: 'medium',
        link: p?.url || p?.permalink || '',
        target: 'social',
      })
    );
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
