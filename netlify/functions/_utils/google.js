// netlify/functions/_utils/google.js
const { google } = require('googleapis');

function getGoogleAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
    : process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!raw) throw new Error('Missing Google service account credentials');

  const creds = JSON.parse(raw);
  return new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  );
}

function sheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

function driveClient(auth) {
  return google.drive({ version: 'v3', auth });
}

module.exports = { getGoogleAuth, sheetsClient, driveClient };
