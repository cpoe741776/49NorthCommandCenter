// netlify/functions/addTickerItem.js
const { getGoogleAuth, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TICKER_TAB = 'TickerFeed';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) return unauth(headers);

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON body');

  const {
    message,
    category,
    source = '',
    link = '',
    newRecommendation = '',
    urgency = 'low',
    createdAt
  } = body || {};

  if (!message || !category) {
    return bad(headers, 'Missing required fields: message, category');
  }
  if (newRecommendation && !['Respond', 'Gather More Information'].includes(newRecommendation)) {
    return bad(headers, 'Invalid recommendation');
  }
  if (!['low', 'medium', 'high', ''].includes(urgency)) {
    return bad(headers, 'Invalid urgency');
  }

  try {
    const auth = getGoogleAuth();
    await auth.authorize();
    const sheets = sheetsClient(auth);

    const values = [[
      createdAt || new Date().toISOString(),
      message,
      category,
      source,
      link,
      newRecommendation,
      urgency
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TICKER_TAB}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    return ok(headers, { success: true });
  } catch (e) {
    console.error('addTickerItem error:', e);
    return serverErr(headers);
  }
};
