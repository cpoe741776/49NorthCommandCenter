# Temporary Fix for Google Credentials

## Quick Solution

Add this to Netlify as `GOOGLE_SERVICE_ACCOUNT_KEY`:

```json
{"type":"service_account","project_id":"default-project","private_key_id":"key-id","private_key":"YOUR_GOOGLE_PRIVATE_KEY_VALUE_HERE","client_email":"YOUR_GOOGLE_CLIENT_EMAIL_HERE","client_id":"0","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/YOUR_ENCODED_EMAIL"}
```

Replace:
- `YOUR_GOOGLE_PRIVATE_KEY_VALUE_HERE` with your `GOOGLE_PRIVATE_KEY` value  
- `YOUR_GOOGLE_CLIENT_EMAIL_HERE` with your `GOOGLE_CLIENT_EMAIL` value (appears twice)

This manually builds the JSON that the old functions expect, using your split variables' values.

## Why This Works

- Old functions expect `GOOGLE_SERVICE_ACCOUNT_KEY` as JSON
- By building a minimal JSON with only required fields, it's smaller (~2KB vs ~2.5KB)
- You keep `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` as backup
- Still under 4KB total

