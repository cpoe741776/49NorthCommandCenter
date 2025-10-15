// netlify/functions/getCommodityCodes.js
const { google } = require('googleapis');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const creds = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8'))
      : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Commodity_Codes!A2:G',
    });

    const normalize = (s='') => String(s).trim();
    const normYesNo = (s='') => (/^y(es)?$/i.test(s) ? 'Yes' : /^no?$/i.test(s) ? 'No' : normalize(s));
    const normCodeType = (s='') => normalize(s).toUpperCase();

    const rows = resp.data.values || [];
    const codes = rows.map((row, idx) => ({
      id: idx + 2,
      codeType: normCodeType(row[0] || ''),
      codeNumber: normalize(row[1] || ''),
      description: normalize(row[2] || ''),
      category: normalize(row[3] || ''),
      priority: normalize(row[4] || ''),
      active: normYesNo(row[5] || ''),
      notes: normalize(row[6] || '')
    }));

    // Optional filters
    const url = new URL(event.rawUrl || `http://local${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const typeFilter = (url.searchParams.get('type') || '').trim().toUpperCase();
    const activeFilter = (url.searchParams.get('active') || '').trim().toLowerCase(); // 'yes' | 'no'
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    let filtered = codes;
    if (typeFilter)  filtered = filtered.filter(c => c.codeType === typeFilter);
    if (activeFilter) filtered = filtered.filter(c => c.active.toLowerCase() === activeFilter);
    if (q) {
      filtered = filtered.filter(c =>
        c.codeNumber.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    }

    const grouped = filtered.reduce((acc, item) => {
      (acc[item.codeType || ''] ||= []).push(item);
      return acc;
    }, {});

    const summary = {
      total: filtered.length,
      byType: {
        NAICS: filtered.filter(c => c.codeType === 'NAICS').length,
        NIGP: filtered.filter(c => c.codeType === 'NIGP').length,
        PSC: filtered.filter(c => c.codeType === 'PSC').length,
        UNSPSC: filtered.filter(c => c.codeType === 'UNSPSC').length,
        CPV: filtered.filter(c => c.codeType === 'CPV').length,
        FSC: filtered.filter(c => c.codeType === 'FSC').length,
        SIC: filtered.filter(c => c.codeType === 'SIC').length,
      },
      primary: filtered.filter(c => c.priority === 'Primary').length
    };

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({ success: true, codes: filtered, grouped, summary })
    };
  } catch (error) {
    console.error('Error fetching commodity codes:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
