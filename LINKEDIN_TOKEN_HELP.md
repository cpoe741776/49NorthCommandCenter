# How to Get LinkedIn Access Token

## Option 1: Manual Token Generation (Testing Only - 60 Day Expiry)

### Step 1: Get Authorization Code
Visit this URL in your browser (replace YOUR_CLIENT_ID with your actual client ID `78on1lis2vgj2w`):

```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://script.google.com/macros/s/AKfycbzgBtY1bxhW6gNf2kEXJvPdyzQWNekwCOzWaaR19Squa7Aq6AysdvWNwCfus0PUW9l6/exec&scope=w_member_social,w_organization_social
```

**This will redirect you to your redirect URL with a code parameter:**
```
https://script.google.com/macros/s/AKfycbz...?code=AQT...&state=...
```

**Copy the `code` value from the URL.**

### Step 2: Exchange Code for Access Token

Use curl (in terminal) to exchange the code for an access token:

```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_CODE_FROM_STEP_1" \
  -d "client_id=78on1lis2vgj2w" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://script.google.com/macros/s/AKfycbzgBtY1bxhW6gNf2kEXJvPdyzQWNekwCOzWaaR19Squa7Aq6AysdvWNwCfus0PUW9l6/exec"
```

**Response will contain:**
```json
{
  "access_token": "AQV...",
  "expires_in": 5184000
}
```

**Copy the `access_token` value** → This is your `LINKEDIN_ACCESS_TOKEN` for Netlify!

---

## Option 2: Check Your Old Google Apps Script

You mentioned you have old variables. Check if `LINKEDIN_KEY` in your Google Apps Script is an access token.

**Access tokens look like**: `AQV...` or `AQX...` (long random string)  
**Client secrets look like**: Random alphanumeric, shorter

If you have `LINKEDIN_KEY` in your old script properties, that might already be the access token!

---

## Option 3: I Can Build an OAuth Helper Function

If you want, I can create a Netlify function that does the OAuth flow for you automatically. But for now, the manual method above is fastest.

---

## Summary

**You need:**
- `LINKEDIN_ACCESS_TOKEN` (not client secret)
- This is the token used to make API calls
- It expires every 60 days
- You can get it via OAuth flow or LinkedIn Developer Console

**Check your old Google Apps Script first** - you might already have this as `LINKEDIN_KEY`!

