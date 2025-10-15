// netlify/functions/getBidSystems.js
const { google } = require('googleapis');

const SHEET_ID = process.env.BID_SYSTEMS_SHEET_ID;

const normalize = (v) => (typeof v === 'string' ? v.trim() : v || '');
const normalizeYesNo = (v) => (normalize(v).toLowerCase() === 'yes' ? 'Yes' : (normalize(v).toLowerCase() === 'no' ? 'No' : normalize(v)));
const withHttp = (url) => {
  const u = normalize(url);
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // small CDN cache; adjust to taste
    'Cache-Control': 'public, max-age=60, s-maxage=60',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    // Service account credentials (either JSON or base64)
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // A..U (21 columns) starting at row 2
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'BidSystemsRegistry!A2:U',
    });

    const rows = response.data.values || [];

    const systemsRaw = rows.map((row, index) => {
      // index + 2 → actual sheet row
      return {
        id: index + 2,                          // keep as sheet row for future updates
        systemId:           normalize(row[0]),
        systemName:         normalize(row[1]),
        category:           normalize(row[2]),
        status:             normalize(row[3]),
        websiteUrl:         withHttp(row[4]),
        loginUrl:           withHttp(row[5]),
        username:           normalize(row[6]),
        password:           normalize(row[7]),
        registrationDate:   normalize(row[8]),
        lastLoginDate:      normalize(row[9]),
        emailAlertsEnabled: normalizeYesNo(row[10]),
        alertEmailAddress:  normalize(row[11]),
        codeType:           normalize(row[12]),   // NEW: Code Type
        codeNumbers:        normalize(row[13]),   // NEW: Code Numbers
        geographicCoverage: normalize(row[14]),
        subscriptionType:   normalize(row[15]),
        renewalDate:        normalize(row[16]),
        annualCost:         normalize(row[17]),
        notes:              normalize(row[18]),
        dateAdded:          normalize(row[19]),
        lastUpdated:        normalize(row[20]),
      };
    });

    // Filter out rows without a systemName
    const systems = systemsRaw.filter(s => s.systemName);

    // Summary (fixed keys used by UI + generic byCategoryAll)
    const summary = {
      total: systems.length,
      active: systems.filter(s => s.status === 'Active').length,
      pending: systems.filter(s => s.status === 'Pending Registration').length,
      byCategory: {
        international: systems.filter(s => s.category === 'International').length,
        usState: systems.filter(s => s.category === 'US State').length,
        localCounty: systems.filter(s => s.category === 'Local/County').length,
        privateCommercial: systems.filter(s => s.category === 'Private/Commercial').length,
        usFederal: systems.filter(s => s.category === 'US Federal').length,
        usTerritory: systems.filter(s => s.category === 'US Territory').length,
      },
      byCategoryAll: systems.reduce((acc, s) => {
        const key = s.category || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, systems, summary }),
    };
  } catch (error) {
    console.error('Error fetching bid systems:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
