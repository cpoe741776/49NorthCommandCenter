# Social Media Operations - Implementation Plan

## ✅ **What's Already Built**

### **Backend (Netlify Functions)**
1. **getSocialMediaContent.js** (should be getSocialPosts.js)
   - Reads `MainPostData!A2:R` (18 columns)
   - Filters by status, limits results
   - Returns posts with summary counts

2. **createSocialPost.js**
   - Creates draft posts in `MainPostData` sheet
   - Generates timestamp-based post IDs
   - Columns A-R fully mapped

3. **publishSocialPost.js**
   - Multi-platform publisher (Facebook, LinkedIn, WordPress, Brevo)
   - Updates sheet with platform-specific IDs
   - Already has API integration stubs

### **Frontend**
1. **SocialMediaOperations.jsx**
   - KPI cards (Total, Published, Scheduled, Drafts)
   - Filters (search, status, platform)
   - Export CSV
   - Basic post list display

2. **socialMediaService.js**
   - Client-side API wrapper
   - `fetchSocialMediaContent()`, `createSocialPost()`, `publishSocialPost()`

### **Data Schema (MainPostData A-R, 18 columns)**
- A: timestamp (post ID)
- B: status (Draft/Scheduled/Published)
- C: contentType (announcement/custom/etc)
- D: title
- E: body
- F: imageUrl
- G: videoUrl
- H: platforms (CSV: Facebook,LinkedIn,Website,Email)
- I: scheduleDate
- J: publishedDate
- K: postPermalink
- L: facebookPostId
- M: linkedInPostId
- N: wordPressPostId
- O: brevoEmailId
- P: analytics (JSON)
- Q: createdBy
- R: tags (CSV)

---

## 🔧 **Issues to Fix First**

### **1. File Naming Mismatch**
- File: `getSocialMediaContent.js`
- Should be: `getSocialPosts.js` (or rename function endpoint)
- **Action**: Rename file or update service to use correct endpoint

### **2. Deprecated Auth in publishSocialPost.js**
- Line 26: `await auth.authorize()` → `await auth.getClient()`

### **3. Missing getSocialMediaContent Function**
- UI calls `getSocialMediaContent` but file is named `getSocialPosts.js`
- Need to align naming

### **4. No Post Composer UI**
- "New Post" button shows alert, doesn't open composer
- Need to build composer modal

---

## 📋 **Phased Implementation Plan**

### **Phase 0: Fix Foundation (30 min)**
1. ✅ Rename `getSocialPosts.js` → `getSocialMediaContent.js` OR update service endpoint
2. ✅ Fix `auth.authorize()` → `auth.getClient()` in publishSocialPost
3. ✅ Add summary calculation to getSocialMediaContent
4. ✅ Test data loading

### **Phase 1: Build Post Composer (2 hours)**
1. Create `PostComposerModal.jsx` component
   - Title, body, content type fields
   - Platform checkboxes (Facebook, LinkedIn, Website, Email)
   - Image/video URL fields (later: file picker from Drive)
   - Schedule date/time picker
   - Tags input
   - Preview pane
2. Wire to `createSocialPost` function
3. Add "Save as Draft" and "Schedule" buttons
4. Validate required fields per platform

### **Phase 2: Facebook Integration (1 hour)**
**Required Netlify Variables**:
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `FACEBOOK_PAGE_ID`

**Steps**:
1. Test existing `publishToFacebook` function
2. Add image attachment support (currently only uses imageUrl as link)
3. Add error handling and retry logic
4. Test live post

### **Phase 3: LinkedIn Integration (1 hour)**
**Required Netlify Variables**:
- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_ORG_URN` (already defaults to `urn:li:organization:107582691`)

**Steps**:
1. Update LinkedIn API to use latest version (v2 → REST API 2.0)
2. Add image/video attachment support
3. Test organization posts
4. Handle token refresh

### **Phase 4: WordPress Blog Integration (1 hour)**
**Required Netlify Variables**:
- `WP_USERNAME`
- `WP_APPLICATION_PASSWORD`
- `WP_POSTS_URL` (already defaults to `https://mymentalarmor.com/wp-json/wp/v2/posts`)

**Steps**:
1. Test existing `publishToWordPress` function
2. Add featured image support
3. Add categories/tags
4. Handle draft vs publish status

### **Phase 5: Brevo Email Integration (1.5 hours)**
**Required Netlify Variables**:
- `BREVO_API_KEY`
- `BREVO_SENDER_NAME`
- `BREVO_SENDER_EMAIL`
- `BREVO_LIST_ID` (recipient list)

**Steps**:
1. Update `publishToBrevo` to:
   - Accept recipient list ID
   - Support HTML templates
   - Handle webinar invitation format
2. Add email preview
3. Test campaign creation

### **Phase 6: Scheduling System (2 hours)**
1. Create scheduled post processor (cron-triggered Netlify function)
2. Check `MainPostData` for posts where `scheduleDate <= now` AND `status === 'Scheduled'`
3. Auto-publish and update status
4. Add Netlify scheduled function trigger

### **Phase 7: Reminders & Alerts (1.5 hours)**
1. Create webinar email reminder system
   - 1 week before
   - 1 day before  
   - 1 hour before
2. Weekly social post reminder
3. Store reminder state to avoid duplicates

### **Phase 8: Media Library (2 hours)**
1. Create Google Drive folder for images/videos
2. Build media picker component
3. List files from Drive folder
4. Insert URLs into composer

### **Phase 9: Post Template Library (1.5 hours)**
1. Add "Save as Template" button
2. Store templates in separate sheet tab or mark with flag
3. Build template picker in composer
4. One-click reuse with customization

---

## 🎯 **Immediate Next Steps**

**Today's Focus**: Let's start with Phase 0 (Foundation fixes) and Phase 1 (Post Composer), then test with Facebook (Phase 2).

**Required from you**:
1. Facebook Page Access Token
2. Facebook Page ID
3. Confirm you want to proceed with this phased approach

**Estimated time**: 3-4 hours for Phases 0-2 (Foundation + Composer + Facebook)

Ready to proceed?

