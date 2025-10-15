// netlify/functions/addTickerItem.js
const { getGoogleAuth, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TICKER_TAB = process.env.TICKER_TAB || 'TickerFeed'; // A:timestamp B:message C:priority D:source E:active F:expiresOn

function normalizePriority(u = 'low') {
  const s = String(u).trim().toLowerCase();
  if (['high', 'urgent', 'critical'].includes(s)) return 'high';
  if (['medium', 'med', 'normal'].includes(s)) return 'medium';
  return 'low';
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON body');

  const {
    message,
    urgency = 'low',
    source = '',
    createdAt,
    ttlDays,
    // optional extras you may append into the message if desired:
    category,
    link,
    newRecommendation
  } = body || {};

  if (!message) return bad(headers, 'Missing required field: message');

  const timestamp = createdAt || new Date().toISOString();
  const priority = normalizePriority(urgency);
  const active = 'TRUE';

  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 7;
  const expiresOn = new Date(Date.now() + days * 86400000).toISOString();

  const decoratedMessage = [message,
    category ? `(cat: ${category})` : '',
    link ? `(link: ${link})` : '',
    newRecommendation ? `(rec: ${newRecommendation})` : ''
  ].filter(Boolean).join(' ');

  try {
    const auth = getGoogleAuth();
    await auth.authorize();
    const sheets = sheetsClient(auth);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TICKER_TAB}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, decoratedMessage, priority, source, active, expiresOn]]
      }
    });

    return ok(headers, { success: true });
  } catch (e) {
    console.error('addTickerItem error:', e);
    return serverErr(headers);
  }
};
