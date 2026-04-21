// netlify/functions/_utils/brevo.js
// Shared Brevo CRM helpers used across multiple functions.
// All HTTP calls go through fetchWithTimeout so Lambda never hangs on slow API responses.

const { fetchWithTimeout } = require('./http');

const BASE = 'https://api.brevo.com/v3';
const TIMEOUT_MS = 10000;

function headers(apiKey) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'api-key': apiKey,
  };
}

// ── Single contact lookup by email (O(1) vs scanning 1000s of contacts) ──────
async function getContact(email, apiKey) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const res = await fetchWithTimeout(
    `${BASE}/contacts/${encodeURIComponent(email)}`,
    { headers: headers(key) },
    TIMEOUT_MS
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Brevo getContact error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Update contact attributes ─────────────────────────────────────────────────
async function updateContact(email, attributes, apiKey) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const res = await fetchWithTimeout(
    `${BASE}/contacts/${encodeURIComponent(email)}`,
    {
      method: 'PUT',
      headers: headers(key),
      body: JSON.stringify({ attributes }),
    },
    TIMEOUT_MS
  );

  if (!res.ok) throw new Error(`Brevo updateContact error ${res.status}: ${await res.text()}`);
  // PUT returns 204 No Content on success
  return true;
}

// ── Add contact to a list ─────────────────────────────────────────────────────
async function addContactToList(email, listId, apiKey) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const res = await fetchWithTimeout(
    `${BASE}/contacts/lists/${listId}/contacts/add`,
    {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ emails: [email] }),
    },
    TIMEOUT_MS
  );

  if (!res.ok) {
    const txt = await res.text();
    // Brevo returns 400 "Contact already in list" — treat as success
    if (res.status === 400 && txt.includes('already')) return true;
    throw new Error(`Brevo addToList error ${res.status}: ${txt}`);
  }
  return true;
}

// ── Create or update a contact ────────────────────────────────────────────────
async function upsertContact(email, attributes, listIds = [], apiKey) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const body = { email, attributes, updateEnabled: true };
  if (listIds.length) body.listIds = listIds;

  const res = await fetchWithTimeout(
    `${BASE}/contacts`,
    { method: 'POST', headers: headers(key), body: JSON.stringify(body) },
    TIMEOUT_MS
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Brevo upsertContact error ${res.status}: ${txt}`);
  }
  return res.status === 204 ? {} : res.json();
}

// ── Fetch all contacts with pagination (up to maxPages * 1000 records) ────────
// Use sparingly — prefer getContact() for single lookups.
async function fetchAllContacts(apiKey, { maxPages = 5, attributes = [] } = {}) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  let all = [];
  let total = 0;

  for (let page = 0; page < maxPages; page++) {
    const offset = page * 1000;
    let url = `${BASE}/contacts?limit=1000&offset=${offset}`;
    if (attributes.length) url += `&attributes=${attributes.join(',')}`;

    const res = await fetchWithTimeout(url, { headers: headers(key) }, TIMEOUT_MS);
    if (!res.ok) {
      console.warn(`[Brevo] fetchAllContacts page ${page} failed:`, res.status);
      break;
    }

    const data = await res.json();
    if (page === 0) total = data.count || 0;
    const batch = data.contacts || [];
    all = all.concat(batch);
    if (batch.length < 1000) break; // reached end
  }

  return { contacts: all, total };
}

// ── Send a transactional email (single recipient) ─────────────────────────────
async function sendTransactionalEmail({ to, subject, htmlContent, replyTo, params = {} }, apiKey) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const senderName = process.env.BREVO_SENDER_NAME || '49 North';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'info@49northresearch.com';

  const body = {
    sender: { name: senderName, email: senderEmail },
    to: Array.isArray(to) ? to : [{ email: to }],
    replyTo: replyTo ? { email: replyTo } : { email: senderEmail },
    subject,
    htmlContent,
    params,
  };

  const res = await fetchWithTimeout(
    `${BASE}/smtp/email`,
    { method: 'POST', headers: headers(key), body: JSON.stringify(body) },
    TIMEOUT_MS
  );

  if (!res.ok) throw new Error(`Brevo transactional error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Create an email campaign draft (for bulk sends via Brevo dashboard) ───────
async function createCampaignDraft({ name, subject, htmlContent, listIds }, apiKey) {
  const key = apiKey || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const senderName = process.env.BREVO_SENDER_NAME || '49 North';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'info@49northresearch.com';

  const body = {
    name,
    subject,
    sender: { name: senderName, email: senderEmail },
    htmlContent,
    recipients: { listIds: listIds.map(Number) },
    inlineImageActivation: false,
    mirrorActive: false,
  };

  const res = await fetchWithTimeout(
    `${BASE}/emailCampaigns`,
    { method: 'POST', headers: headers(key), body: JSON.stringify(body) },
    TIMEOUT_MS
  );

  if (!res.ok) throw new Error(`Brevo createCampaign error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    campaignId: data.id,
    dashboardLink: `https://app.brevo.com/campaign/id/${data.id}`,
  };
}

module.exports = {
  getContact,
  updateContact,
  addContactToList,
  upsertContact,
  fetchAllContacts,
  sendTransactionalEmail,
  createCampaignDraft,
};
