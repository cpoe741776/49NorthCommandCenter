# Social Media Credentials Setup Guide

## 📋 **Required Netlify Environment Variables**

Based on your old Google Apps Script variables, here's what you need to configure in Netlify:

---

## **1. Facebook (Meta)**

### **Variables to Add in Netlify**:
```
FACEBOOK_PAGE_ACCESS_TOKEN
FACEBOOK_PAGE_ID
```

### **Where to Get Them**:

**FACEBOOK_PAGE_ACCESS_TOKEN**:
- You had this as `FACEBOOK_KEY` in your old script
- Go to: https://developers.facebook.com/tools/explorer/
- Select your app
- Click "Get Token" → "Get Page Access Token"
- **Important**: Generate a **long-lived token** (60 days+) or use a **system user token** (never expires)
  - To convert short-lived → long-lived: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived

**FACEBOOK_PAGE_ID**:
- You already have this (`FACEBOOK_PAGE_ID` from old script)
- Find it at: https://www.facebook.com/your-page/about → "Page ID"
- Or use Graph API Explorer: `GET /me/accounts`

---

## **2. LinkedIn**

### **Variables to Add in Netlify**:
```
LINKEDIN_ACCESS_TOKEN
LINKEDIN_ORG_URN
```

### **Where to Get Them**:

**LINKEDIN_ACCESS_TOKEN**:
- You had this as `LINKEDIN_KEY` in your old script
- Go to: https://www.linkedin.com/developers/apps
- Select your app → "Auth" tab
- Request token with scopes: `w_member_social`, `w_organization_social`
- **Note**: LinkedIn tokens expire after 60 days - consider implementing OAuth refresh flow

**LINKEDIN_ORG_URN**:
- You may already have this in your old variables (`LINKEDIN_CLIENT_ID`)
- Format: `urn:li:organization:XXXXXXXXX`
- Find your organization ID:
  1. Go to your company page: `https://www.linkedin.com/company/YOUR-COMPANY`
  2. The number in the URL is your org ID
  3. Format as: `urn:li:organization:YOUR_ORG_ID`
- **Current default in code**: `urn:li:organization:107582691`

**Optional (for OAuth refresh - not needed initially)**:
```
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
```
- You already have these from your old script

---

## **3. WordPress (MyMentalArmor.com Blog)**

### **Variables to Add in Netlify**:
```
WP_USERNAME
WP_APPLICATION_PASSWORD
WP_POSTS_URL
```

### **Where to Get Them**:

**WP_USERNAME**:
- You already have this (`WORDPRESS_USERNAME` from old script)
- Your WordPress admin username

**WP_APPLICATION_PASSWORD**:
- You had this as `MENTAL_ARMOR_BLOG_POST` or `MA_BLOG_POST` in old script
- Generate at: https://mymentalarmor.com/wp-admin/profile.php
- Scroll to "Application Passwords" section
- Create new password with name like "Netlify API Access"
- **Save the generated password** (you can only see it once!)

**WP_POSTS_URL** (optional - already defaults to correct value):
```
https://mymentalarmor.com/wp-json/wp/v2/posts
```

---

## **4. Brevo (Email Marketing)**

### **Variables to Add in Netlify**:
```
BREVO_API_KEY
BREVO_SENDER_NAME
BREVO_SENDER_EMAIL
BREVO_LIST_ID
```

### **Where to Get Them**:

**BREVO_API_KEY**:
- You already have this in your old script
- Get it at: https://app.brevo.com/settings/keys/api
- Create new API key with name "Netlify Social Media"

**BREVO_SENDER_NAME**:
- You already have this (`BREVO_SENDER_NAME` from old script)
- Example: `"49 North"`

**BREVO_SENDER_EMAIL**:
- You already have this (`BREVO_SENDER_EMAIL` from old script)
- Must be a verified sender in Brevo
- Example: `"info@49north.com"`

**BREVO_LIST_ID** (NEW - required for sending emails):
- Go to: https://app.brevo.com/contact/list
- Find or create a list (e.g., "Webinar Registrants")
- Click the list → URL will show list ID
- Example: `2`, `5`, `12` (just a number)

---

## **5. Optional: Google Drive (Media Library)**

### **Variables to Add in Netlify** (for Phase 8):
```
GOOGLE_DRIVE_MEDIA_FOLDER_ID
```

### **Where to Get It**:
- Create a folder in Google Drive for social media assets
- Share it with your service account email
- Copy folder ID from URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

---

## **📝 Summary: Copy This to Netlify**

Go to: **Netlify Dashboard → Site → Site Settings → Environment Variables**

Click "Add a variable" and paste these (replace `YOUR_VALUE_HERE` with actual values):

```bash
# Facebook
FACEBOOK_PAGE_ACCESS_TOKEN=YOUR_VALUE_HERE
FACEBOOK_PAGE_ID=YOUR_VALUE_HERE

# LinkedIn
LINKEDIN_ACCESS_TOKEN=YOUR_VALUE_HERE
LINKEDIN_ORG_URN=urn:li:organization:107582691

# WordPress
WP_USERNAME=YOUR_VALUE_HERE
WP_APPLICATION_PASSWORD=YOUR_VALUE_HERE
WP_POSTS_URL=https://mymentalarmor.com/wp-json/wp/v2/posts

# Brevo
BREVO_API_KEY=YOUR_VALUE_HERE
BREVO_SENDER_NAME=49 North
BREVO_SENDER_EMAIL=YOUR_VALUE_HERE
BREVO_LIST_ID=YOUR_VALUE_HERE

# Optional: Media Library
GOOGLE_DRIVE_MEDIA_FOLDER_ID=YOUR_VALUE_HERE
```

---

## **🔍 Where to Find Your Old Values**

**In Google Apps Script**:
1. Open your old script: https://script.google.com
2. Go to: **Project Settings** (gear icon)
3. Scroll to **Script Properties**
4. Copy the values for:
   - `FACEBOOK_KEY` → Use as `FACEBOOK_PAGE_ACCESS_TOKEN`
   - `FACEBOOK_PAGE_ID` → Use as `FACEBOOK_PAGE_ID`
   - `LINKEDIN_KEY` → Use as `LINKEDIN_ACCESS_TOKEN`
   - `WORDPRESS_USERNAME` → Use as `WP_USERNAME`
   - `MENTAL_ARMOR_BLOG_POST` or `MA_BLOG_POST` → Use as `WP_APPLICATION_PASSWORD`
   - `BREVO_API_KEY` → Use as `BREVO_API_KEY`
   - `BREVO_SENDER_NAME` → Use as `BREVO_SENDER_NAME`
   - `BREVO_SENDER_EMAIL` → Use as `BREVO_SENDER_EMAIL`

---

## **⚠️ Important Notes**

1. **Token Expiration**:
   - Facebook long-lived tokens: ~60 days (need refresh)
   - LinkedIn tokens: 60 days (need OAuth refresh flow)
   - WordPress app passwords: Never expire
   - Brevo API keys: Never expire

2. **Security**:
   - Never commit these to Git
   - Only store in Netlify environment variables
   - Regenerate tokens if accidentally exposed

3. **Testing**:
   - Start with one platform at a time
   - Test in Netlify Functions log viewer
   - Check each platform's API dashboard for errors

---

## **✅ Next Steps**

1. Copy values from Google Apps Script Properties
2. Add all variables to Netlify
3. Let me know when done, and I'll fix the code + test each platform!

