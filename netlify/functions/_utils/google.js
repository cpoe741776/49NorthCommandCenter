// Shared Google auth + client factories

const { google } = require('googleapis');

function loadServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
  return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
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
};
