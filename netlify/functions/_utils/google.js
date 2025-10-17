// Shared Google auth + client factories

const { google } = require('googleapis');

function loadServiceAccount() {
  // Try full JSON formats first (backwards compatibility)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  }
  
  // NEW: Construct from individual env vars (much smaller - ~500 bytes total)
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID || 'default-project',
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || 'key-id',
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID || '0',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL)}`
    };
  }
  
  throw new Error('Google Service Account credentials not configured. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY, or GOOGLE_SERVICE_ACCOUNT_KEY');
}

/**
 * Returns a GoogleAuth instance (JWT) suitable for both Sheets & Drive.
 * Use `.getClient()` to get the auth client.
 */
function getGoogleAuth(scopes) {
  const credentials = loadServiceAccount();
  const usedScopes = scopes && scopes.length
    ? scopes
    : [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ];
  return new google.auth.GoogleAuth({ 
    credentials, 
    scopes: usedScopes 
  });
}

/** Convenience: Sheets API client */
function sheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

/** Convenience: Drive API client */
function driveClient(auth) {
  return google.drive({ version: 'v3', auth });
}

module.exports = {
  getGoogleAuth,
  sheetsClient,
  driveClient,
  loadServiceAccount, // Export for functions that parse credentials inline
};
