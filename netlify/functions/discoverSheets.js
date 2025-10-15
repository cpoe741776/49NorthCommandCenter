// netlify/functions/discoverSheets.js
// Script to discover all sheet structures and column mappings

const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const CFG = {
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '8000', 10),
  SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
  BID_SYSTEMS_SHEET_ID: process.env.BID_SYSTEMS_SHEET_ID || '',
  WEBINAR_SHEET_ID: process.env.WEBINAR_SHEET_ID || '',
  SOCIAL_MEDIA_SHEET_ID: process.env.SOCIAL_MEDIA_SHEET_ID || '',
  COMPANY_DATA_SHEET_ID: process.env.COMPANY_DATA_SHEET_ID || ''
};

async function withTimeout(promise, label, ms) {
  const timer = setTimeout(() => console.warn(`[Timeout] ${label} > ${ms}ms`), ms + 1);
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms))
    ]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if ((err?.message || '').includes('timeout')) {
      console.warn(`[Timeout] ${label} hit timeout`);
      return null;
    }
    throw err;
  }
}

async function discoverSheet(sheets, spreadsheetId, sheetName) {
  try {
    console.log(`[Discover] Fetching ${sheetName} from ${spreadsheetId}`);
    
    // Get sheet metadata first
    const metadataRes = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });
    
    const sheetInfo = metadataRes.data.sheets.find(sheet => 
      sheet.properties.title === sheetName
    );
    
    if (!sheetInfo) {
      return {
        exists: false,
        error: `Sheet '${sheetName}' not found`
      };
    }
    
    // Get first few rows to see structure
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A1:Z10` // First 10 rows
    });
    
    const rows = dataRes.data.values || [];
    const headers = rows[0] || [];
    const sampleData = rows.slice(1, 4); // First 3 data rows
    
    return {
      exists: true,
      sheetId: sheetInfo.properties.sheetId,
      rowCount: sheetInfo.properties.gridProperties.rowCount,
      columnCount: sheetInfo.properties.gridProperties.columnCount,
      headers: headers.map((header, index) => ({
        column: String.fromCharCode(65 + index), // A, B, C, etc.
        header: header || `Column ${index + 1}`,
        index: index
      })),
      sampleData: sampleData.map((row, rowIndex) => 
        row.map((cell, colIndex) => ({
          column: String.fromCharCode(65 + colIndex),
          value: cell || '',
          row: rowIndex + 2 // +2 because we skip header row
        }))
      ),
      totalRows: rows.length
    };
    
  } catch (err) {
    return {
      exists: false,
      error: err.message
    };
  }
}

async function discoverAllSheets(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const results = {};
  
  // Main sheet tabs
  if (CFG.SHEET_ID) {
    results.mainSheet = {
      sheetId: CFG.SHEET_ID,
      tabs: {}
    };
    
    const mainTabs = ['Active_Bids', 'Submitted', 'Disregarded', 'Active_Admin'];
    for (const tabName of mainTabs) {
      results.mainSheet.tabs[tabName] = await discoverSheet(sheets, CFG.SHEET_ID, tabName);
    }
  }
  
  // Bid Systems sheet
  if (CFG.BID_SYSTEMS_SHEET_ID) {
    results.bidSystemsSheet = {
      sheetId: CFG.BID_SYSTEMS_SHEET_ID,
      tabs: {}
    };
    
    const bidSystemTabs = ['Active_Admin', 'BidSystems', 'Systems', 'Admin'];
    for (const tabName of bidSystemTabs) {
      results.bidSystemsSheet.tabs[tabName] = await discoverSheet(sheets, CFG.BID_SYSTEMS_SHEET_ID, tabName);
    }
  }
  
  // Webinar sheet
  if (CFG.WEBINAR_SHEET_ID) {
    results.webinarSheet = {
      sheetId: CFG.WEBINAR_SHEET_ID,
      tabs: {}
    };
    
    const webinarTabs = ['Webinars', 'Registrations', 'Survey_Responses'];
    for (const tabName of webinarTabs) {
      results.webinarSheet.tabs[tabName] = await discoverSheet(sheets, CFG.WEBINAR_SHEET_ID, tabName);
    }
  }
  
  // Social Media sheet
  if (CFG.SOCIAL_MEDIA_SHEET_ID) {
    results.socialMediaSheet = {
      sheetId: CFG.SOCIAL_MEDIA_SHEET_ID,
      tabs: {}
    };
    
    const socialTabs = ['MainPostData', 'SocialMedia', 'Posts'];
    for (const tabName of socialTabs) {
      results.socialMediaSheet.tabs[tabName] = await discoverSheet(sheets, CFG.SOCIAL_MEDIA_SHEET_ID, tabName);
    }
  }
  
  // Company Data sheet
  if (CFG.COMPANY_DATA_SHEET_ID) {
    results.companyDataSheet = {
      sheetId: CFG.COMPANY_DATA_SHEET_ID,
      tabs: {}
    };
    
    const companyTabs = ['CompanyData', 'Data', 'Info'];
    for (const tabName of companyTabs) {
      results.companyDataSheet.tabs[tabName] = await discoverSheet(sheets, CFG.COMPANY_DATA_SHEET_ID, tabName);
    }
  }
  
  return results;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('[DiscoverSheets] Starting sheet discovery...');

  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    // Authenticate with Google
    let auth;
    try {
      auth = getGoogleAuth();
      await auth.getClient();
    } catch (err) {
      console.error('[DiscoverSheets] Google auth failure:', err?.message);
      return ok(headers, { success: false, error: 'Google authentication failed.' });
    }

    console.log('[DiscoverSheets] Environment variables:', {
      GOOGLE_SHEET_ID: CFG.SHEET_ID ? 'SET' : 'NOT SET',
      BID_SYSTEMS_SHEET_ID: CFG.BID_SYSTEMS_SHEET_ID ? 'SET' : 'NOT SET',
      WEBINAR_SHEET_ID: CFG.WEBINAR_SHEET_ID ? 'SET' : 'NOT SET',
      SOCIAL_MEDIA_SHEET_ID: CFG.SOCIAL_MEDIA_SHEET_ID ? 'SET' : 'NOT SET',
      COMPANY_DATA_SHEET_ID: CFG.COMPANY_DATA_SHEET_ID ? 'SET' : 'NOT SET'
    });

    const results = await discoverAllSheets(auth);

    return ok(headers, {
      success: true,
      environmentVariables: {
        GOOGLE_SHEET_ID: CFG.SHEET_ID ? 'SET' : 'NOT SET',
        BID_SYSTEMS_SHEET_ID: CFG.BID_SYSTEMS_SHEET_ID ? 'SET' : 'NOT SET',
        WEBINAR_SHEET_ID: CFG.WEBINAR_SHEET_ID ? 'SET' : 'NOT SET',
        SOCIAL_MEDIA_SHEET_ID: CFG.SOCIAL_MEDIA_SHEET_ID ? 'SET' : 'NOT SET',
        COMPANY_DATA_SHEET_ID: CFG.COMPANY_DATA_SHEET_ID ? 'SET' : 'NOT SET'
      },
      sheets: results,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('[DiscoverSheets] Fatal error:', e?.message || e);
    return ok(headers, { 
      success: false, 
      error: 'Unexpected error during sheet discovery: ' + (e?.message || 'Unknown error')
    });
  }
};
