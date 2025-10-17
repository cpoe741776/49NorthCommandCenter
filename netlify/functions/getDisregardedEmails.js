// netlify/functions/getDisregardedEmails.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = 'Disregarded!A2:U'; // A–U (21 cols)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not configured');

    const { loadServiceAccount } = require('./_utils/google');
    const credentials = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Optional query params
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const limitParam = parseInt(url.searchParams.get('limit') || '0', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];

    const mapRow = (row, index) => {
      const get = (i) => (row[i] ?? '').toString().trim();
      return {
        id: `disregarded-${index + 2}`,
        rowNumber: index + 2,
        recommendation: get(0) || 'Disregard',
        scoreDetails: get(1),
        aiReasoning: get(2),
        aiSummary: get(3),
        emailDateReceived: get(4),
        emailFrom: get(5),
        keywordsCategory: get(6),
        keywordsFound: get(7),
        relevance: get(8) || 'Low',
        emailSubject: get(9),
        emailBody: get(10),
        url: get(11),
        dueDate: get(12),
        significantSnippet: get(13),
        emailDomain: get(14),
        bidSystem: get(15) || 'Unknown',
        country: get(16),
        entity: get(17),
        status: get(18) || 'Disregarded',
        dateAdded: get(19),
        sourceEmailId: get(20),
      };
    };

    let emails = rows.map(mapRow);

    // Simple search filter across a few fields
    if (q) {
      emails = emails.filter((e) =>
        [e.emailSubject, e.emailFrom, e.bidSystem, e.entity, e.keywordsFound].some((v) =>
          (v || '').toLowerCase().includes(q)
        )
      );
    }

    // Sort newest first by dateAdded (fallback to emailDateReceived)
    const toTime = (s) => {
      const t = Date.parse(s || '');
      return Number.isNaN(t) ? 0 : t;
    };
    emails.sort((a, b) => (toTime(b.dateAdded) || toTime(b.emailDateReceived)) - (toTime(a.dateAdded) || toTime(a.emailDateReceived)));

    if (limit) emails = emails.slice(0, limit);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, emails, count: emails.length }),
    };
  } catch (error) {
    console.error('Error fetching disregarded emails:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
