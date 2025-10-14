// netlify/functions/_utils/google.js
const { google } = require('googleapis');

function loadServiceAccount() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!b64 && !raw) {
    throw new Error('No key or keyFile set.');
  }

  let json;
  try {
    const txt = b64 ? Buffer.from(b64, 'base64').toString('utf-8') : raw;
    json = JSON.parse(txt);
  } catch (e) {
    throw new Error('Invalid service account JSON');
  }

  // Fix escaped newlines in private key if needed
  if (json.private_key && json.private_key.includes('\\n')) {
    json.private_key = json.private_key.replace(/\\n/g, '\n');
  }
  return json;
}

/**
 * getGoogleAuth(scopes?)
 * Default scopes: Sheets read-only
 */
function getGoogleAuth(
  scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly']
) {
  const creds = loadServiceAccount();
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes
  });
}

module.exports = { getGoogleAuth };
