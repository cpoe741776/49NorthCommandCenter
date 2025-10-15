// netlify/functions/addBidSystem.js
const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;
const APP_TOKEN = process.env.APP_TOKEN; // optional: set to enable a simple shared-secret check

const norm = (v) => (typeof v === 'string' ? v.trim() : (v ?? ''));
const yesNo = (v) => {
  const s = norm(v).toLowerCase();
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return 'Yes';
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return 'No';
  return norm(v) || 'No';
};
const withHttp = (url) => {
  const u = norm(url);
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
};

// YYYY-MM-DD (or blank)
const ymd = (v) => {
  const s = norm(v);
  if (!s) return '';
  // allow "Dec 31, 2025" or "2025-12-31" to pass to USER_ENTERED; Sheets will parse
  return s;
};

// normalize currency-ish strings; still leave parsing to Sheets formatting
const money = (v) => {
  const s = norm(v);
  if (!s) return '$0';
  return s.startsWith('$') ? s : `$${s}`;
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    // simple shared-secret check (optional)
    if (APP_TOKEN) {
      const provided = event.headers['x-app-token'] || event.headers['X-App-Token'];
      if (provided !== APP_TOKEN) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
      }
    }

    // auth
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // payload
    const incoming = JSON.parse(event.body || '{}');

    // required fields
    if (!norm(incoming.systemName) || !norm(incoming.geographicCoverage)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'System Name and Geographic Coverage are required' }),
      };
    }

    // generate ID: read A2:A to get current count (ignore header at A1), then build a stable ID
    // generate ID: scan existing SYS### and pick the next highest number (robust to deletions)
const idRes = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'BidSystemsRegistry!A2:A',
});
const nums = (idRes.data.values || [])
  .map(r => (r[0] || '').match(/^SYS(\d+)$/))
  .filter(Boolean)
  .map(m => parseInt(m[1], 10));
const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
const newSystemId = `SYS${String(nextNum).padStart(3, '0')}`;


    const todayISO = new Date().toISOString().split('T')[0];

    // columns A..U
    const row = [
      newSystemId,                              // A: System ID
      norm(incoming.systemName),                // B: System Name
      norm(incoming.category || 'US State'),    // C: Category
      norm(incoming.status || 'Pending Registration'), // D: Status
      withHttp(incoming.websiteUrl),            // E: Website URL
      withHttp(incoming.loginUrl),              // F: Login URL
      norm(incoming.username),                  // G: Username
      norm(incoming.password),                  // H: Password
      ymd(incoming.registrationDate),           // I: Registration Date (USER ENTERED)
      '',                                       // J: Last Login Date
      yesNo(incoming.emailAlertsEnabled || 'No'), // K: Email Alerts Enabled
      norm(incoming.alertEmailAddress || ''),   // L: Alert Email Address
      norm(incoming.codeType || ''),            // M: Code Type
      norm(incoming.codeNumbers || ''),         // N: Code Numbers
      norm(incoming.geographicCoverage),        // O: Geographic Coverage
      norm(incoming.subscriptionType || 'Free'),// P: Subscription Type
      ymd(incoming.renewalDate),                // Q: Renewal Date
      money(incoming.annualCost || '$0'),       // R: Annual Cost
      norm(incoming.notes || ''),               // S: Notes
      todayISO,                                 // T: Date Added
      todayISO,                                 // U: Last Updated
    ];

    // append
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A:U',
      valueInputOption: 'USER_ENTERED', // let Sheets parse dates/currency
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, systemId: newSystemId, message: 'System added successfully' }),
    };
  } catch (error) {
    console.error('Error adding bid system:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
