// netlify/functions/updateBidSystem.js
const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;
const APP_TOKEN = process.env.APP_TOKEN; // optional shared secret

const norm = (v) => (typeof v === 'string' ? v.trim() : (v ?? ''));
const yesNo = (v) => {
  const s = norm(v).toLowerCase();
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return 'Yes';
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return 'No';
  return norm(v);
};
const withHttp = (url) => {
  const u = norm(url);
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
};
const ymd = (v) => norm(v);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    if (APP_TOKEN) {
      const provided = event.headers['x-app-token'] || event.headers['X-App-Token'];
      if (provided !== APP_TOKEN) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
      }
    }

    // Auth
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const { systemId, fields = {} } = JSON.parse(event.body || '{}');
    if (!systemId) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'systemId is required' }) };
    }

    // Find row by System ID in col A (A2:A to skip header)
    const idCol = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A2:A',
    });
    const ids = idCol.data.values || [];
    const idx = ids.findIndex((r) => (r[0] || '') === systemId);
    if (idx === -1) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'System not found' }) };
    }
    const rowNumber = idx + 2; // 1-based row; +1 for header offset, +1 to convert to sheet row

    // Fetch full row A:U to merge
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `BidSystemsRegistry!A${rowNumber}:U${rowNumber}`,
    });
    const row = (rowRes.data.values && rowRes.data.values[0]) || Array(21).fill('');

    // Map existing row to object (indexes match your getBidSystems mapping)
    const obj = {
      systemId: row[0] || '',
      systemName: row[1] || '',
      category: row[2] || '',
      status: row[3] || '',
      websiteUrl: row[4] || '',
      loginUrl: row[5] || '',
      username: row[6] || '',
      password: row[7] || '',
      registrationDate: row[8] || '',
      lastLoginDate: row[9] || '',
      emailAlertsEnabled: row[10] || '',
      alertEmailAddress: row[11] || '',
      codeType: row[12] || '',
      codeNumbers: row[13] || '',
      geographicCoverage: row[14] || '',
      subscriptionType: row[15] || '',
      renewalDate: row[16] || '',
      annualCost: row[17] || '',
      notes: row[18] || '',
      dateAdded: row[19] || '',
      lastUpdated: row[20] || '',
    };

    // Merge incoming fields (normalize selective columns)
    const merged = {
      ...obj,
      ...(fields.systemName !== undefined ? { systemName: norm(fields.systemName) } : {}),
      ...(fields.category !== undefined ? { category: norm(fields.category) } : {}),
      ...(fields.status !== undefined ? { status: norm(fields.status) } : {}),
      ...(fields.websiteUrl !== undefined ? { websiteUrl: withHttp(fields.websiteUrl) } : {}),
      ...(fields.loginUrl !== undefined ? { loginUrl: withHttp(fields.loginUrl) } : {}),
      ...(fields.username !== undefined ? { username: norm(fields.username) } : {}),
      ...(fields.password !== undefined ? { password: norm(fields.password) } : {}),
      ...(fields.registrationDate !== undefined ? { registrationDate: ymd(fields.registrationDate) } : {}),
      ...(fields.lastLoginDate !== undefined ? { lastLoginDate: ymd(fields.lastLoginDate) } : {}),
      ...(fields.emailAlertsEnabled !== undefined ? { emailAlertsEnabled: yesNo(fields.emailAlertsEnabled) } : {}),
      ...(fields.alertEmailAddress !== undefined ? { alertEmailAddress: norm(fields.alertEmailAddress) } : {}),
      ...(fields.codeType !== undefined ? { codeType: norm(fields.codeType) } : {}),
      ...(fields.codeNumbers !== undefined ? { codeNumbers: norm(fields.codeNumbers) } : {}),
      ...(fields.geographicCoverage !== undefined ? { geographicCoverage: norm(fields.geographicCoverage) } : {}),
      ...(fields.subscriptionType !== undefined ? { subscriptionType: norm(fields.subscriptionType) } : {}),
      ...(fields.renewalDate !== undefined ? { renewalDate: ymd(fields.renewalDate) } : {}),
      ...(fields.annualCost !== undefined ? { annualCost: norm(fields.annualCost) } : {}),
      ...(fields.notes !== undefined ? { notes: norm(fields.notes) } : {}),
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    // Back to array A..U
    const updatedRow = [
      merged.systemId,
      merged.systemName,
      merged.category,
      merged.status,
      merged.websiteUrl,
      merged.loginUrl,
      merged.username,
      merged.password,
      merged.registrationDate,
      merged.lastLoginDate,
      merged.emailAlertsEnabled,
      merged.alertEmailAddress,
      merged.codeType,
      merged.codeNumbers,
      merged.geographicCoverage,
      merged.subscriptionType,
      merged.renewalDate,
      merged.annualCost,
      merged.notes,
      merged.dateAdded,
      merged.lastUpdated,
    ];

    // Write
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `BidSystemsRegistry!A${rowNumber}:U${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [updatedRow] },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, system: merged }),
    };
  } catch (error) {
    console.error('Error updating bid system:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
