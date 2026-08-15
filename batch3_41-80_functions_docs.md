# 49 North Command Center - Serverless Functions Documentation

## Table of Contents
1. [Overview](#overview)
2. [Bid Management Functions](#bid-management-functions)
3. [Webinar Management Functions](#webinar-management-functions)
4. [Social Media Functions](#social-media-functions)
5. [Executive Assistant (Secretary) Functions](#executive-assistant-secretary-functions)
6. [Utility & Helper Functions](#utility--helper-functions)
7. [Environment Variables](#environment-variables)

---

## Overview

This document covers 20 Netlify serverless functions that power the 49 North Command Center platform. These functions handle bid intelligence, webinar management, social media automation, and executive assistant workflows.

---

## Bid Management Functions

### 1. `getSystemAdminEmails.js`
**Purpose:** Fetches system administration correspondence from the Active_Admin sheet.

**Endpoint:** `GET /.netlify/functions/getSystemAdminEmails`

**Returns:**
- List of admin emails with metadata
- Count of total and new (unread) items
- Status tracking

**Sheet Columns (Active_Admin):**
- A: Recommendation
- B: Email Date Received
- C: Email From
- D: Email Subject
- E: Email Body
- F: Bid System
- G: Email Domain
- H: Date Added
- I: Source Email ID
- J: Status

---

### 2. `moveBidToSystemAdmin.js`
**Purpose:** Moves a bid from Active_Bids to Active_Admin for system correspondence tracking.

**Endpoint:** `POST /.netlify/functions/moveBidToSystemAdmin`

**Request Body:**
```json
{
  "bidId": "123"
}
```

**Process:**
1. Fetches bid from Active_Bids (row by ID)
2. Maps relevant columns to Active_Admin format
3. Appends to Active_Admin
4. Deletes original row from Active_Bids

**Column Mapping:**
- Active_Bids (A:U) → Active_Admin (A:J)
- Recommendation → "Systems Administration"
- Status → "New"

---

### 3. `reviveDisregardedEmail.js`
**Purpose:** Moves emails from Disregarded sheet back to Active_Bids with new recommendation.

**Endpoint:** `POST /.netlify/functions/reviveDisregardedEmail`

**Request Body:**
```json
{
  "rowNumber": 5,
  "newRecommendation": "Respond",
  "emailData": {
    "emailSubject": "...",
    "emailBody": "...",
    "emailFrom": "...",
    "bidSystem": "...",
    ...
  }
}
```

**Valid Recommendations:**
- "Respond"
- "Gather More Information"

**Process:**
1. Validates recommendation
2. Builds new row for Active_Bids (A:U)
3. Appends to Active_Bids
4. Deletes from Disregarded sheet

---

## Webinar Management Functions

### 4. `getWebinars.js`
**Purpose:** Fetches webinar data with 3-minute caching.

**Endpoint:** `GET /.netlify/functions/getWebinars`

**Returns:**
- Webinars list (deduplicated by ID+date)
- Survey responses
- Registrations
- Summary statistics

**Sheet Tabs:**
- `Webinars!A2:L` (12 columns)
- `Survey_Responses!A2:L` (12 columns)
- `Registrations!A2:F` (6 columns)

**Cache:** 3-minute TTL in-memory cache

**Webinar Columns (A:L):**
- A: ID
- B: Title
- C: Date
- D: Time
- E: Platform Link
- F: Registration Form URL
- G: Status
- H: Capacity
- I: Registration Count
- J: Attendance Count
- K: Survey Link
- L: Created Date

---

### 5. `getWebinarAnalysis.js`
**Purpose:** AI-powered analysis of webinar performance and lead generation.

**Endpoint:** `GET /.netlify/functions/getWebinarAnalysis`

**Requires Authentication**

**Returns:**
- Executive summary (AI-generated)
- Top priorities
- Hot leads (scored by engagement)
- Webinar KPIs (30-day and 90-day)
- Content insights
- Recent and upcoming webinars

**Lead Scoring System:**
- Requested Contact: +100 points
- Wants 3-Month Reminder: +30 points
- Attended 3+ Webinars: +30 per webinar (after first)
- Attended 2 Webinars: +30
- Attended 1 Webinar: +15
- Completed Survey: +25
- Detailed Comments: +20

**Lead Segmentation:**
- **Hot Leads:** Score ≥100 OR requested contact
- **Warm Leads:** Score 40-99, no contact request
- **Cold Leads:** Registered but never attended

**Data Sources:**
1. `Webinars!A2:L` - Webinar metadata
2. `Survey_Responses!A2:L` - Feedback surveys
3. `Registrations!A2:F` - Registration data
4. `Attendance!A2:M` - Attendance tracking

**AI Model:** GPT-4o (configurable via `OPENAI_MODEL`)

---

## Social Media Functions

### 6. `publishSocialPost.js`
**Purpose:** Publishes social media content to multiple platforms.

**Endpoint:** `POST /.netlify/functions/publishSocialPost`

**Requires Authentication**

**Request Body:**
```json
{
  "postId": "post-123",
  "postData": {
    "title": "...",
    "body": "...",
    "imageUrl": "...",
    "platforms": "Facebook,LinkedIn,Website,Email"
  }
}
```

**Supported Platforms:**
1. **Facebook** - Posts with native image upload
2. **LinkedIn** - Organization posts with image upload
3. **Website** - WordPress posts with featured image
4. **Email** - Brevo email campaigns (draft mode)

**Features:**
- Google Drive URL conversion for images
- Automatic image download and upload
- Multi-platform error handling
- Sheet updates with platform IDs

**Sheet Updates (MainPostData):**
- B: Status → "Published"
- J: Published Date
- K: Post Permalink (WordPress)
- L: Facebook Post ID
- M: LinkedIn Post ID
- N: WordPress Post ID
- O: Brevo Email ID
- P: Analytics JSON

---

### 7. `publishScheduledPosts.js`
**Purpose:** Automated cron job that publishes scheduled social posts.

**Trigger:** Hourly via Netlify scheduled functions

**Process:**
1. Fetches all posts from MainPostData tab
2. Filters for status="Scheduled" with due scheduleDate
3. Publishes to configured platforms
4. Updates sheet with results

**No Manual Invocation Required** - Runs automatically

---

### 8. `getTickerFeed.js`
**Purpose:** Returns normalized ticker items for dashboard notifications.

**Endpoint:** `GET /.netlify/functions/getTickerFeed?limit=200`

**Query Parameters:**
- `limit` (default: 200) - Max items to return

**Optional Authentication:** Controlled by `REQUIRE_TICKER_AUTH` env var

**Sheet Columns (TickerFeed!A2:F):**
- A: Timestamp
- B: Message
- C: Priority (high/medium/low)
- D: Source
- E: Active (boolean)
- F: Expires On

**Features:**
- Filters inactive/expired items
- Deduplicates by message
- Sorts by priority then timestamp
- Timeout protection (7s default)

---

### 9. `populateReminderTracking.js`
**Purpose:** Auto-generates reminder entries for upcoming webinars.

**Endpoint:** `POST /.netlify/functions/populateReminderTracking`

**Process:**
1. Fetches upcoming webinars from Webinars sheet
2. Calculates reminder dates (1 week, 1 day, 1 hour)
3. Generates 6 reminder types per webinar:
   - `webinar-1week`
   - `webinar-social-1week`
   - `webinar-1day`
   - `webinar-social-1day`
   - `webinar-1hour`
   - `webinar-social-1hour`
4. Appends to ReminderTracking tab
5. Skips duplicates

**Target Sheet:** `SOCIAL_MEDIA_SHEET_ID` → ReminderTracking tab

---

### 10. `getWordPressMedia.js`
**Purpose:** Fetches media library from WordPress for image selection.

**Endpoint:** `GET /.netlify/functions/getWordPressMedia?page=1&per_page=50`

**Query Parameters:**
- `page` (default: 1)
- `per_page` (default: 50)
- `search` (optional) - Search media titles

**Returns:**
- Media items with URLs, thumbnails, metadata
- Pagination info (total items, pages)

**Use Case:** Browse WordPress media library to select featured images for social posts

---

## Executive Assistant (Secretary) Functions

### 11. `secretaryLoop.js`
**Purpose:** Hourly executive assistant that generates focus tasks based on workload.

**Trigger:** Scheduled (hourly)

**Manual Endpoint:** `GET /.netlify/functions/secretaryLoopManual?dryRun=true`

**Generated Tasks:**
1. **focus-bids** - When active bids exist
2. **focus-social** - When social queue has scheduled/draft posts
3. **focus-webinars** - When upcoming webinars exist

**Priority Assignment:**
- Code Red: Respond-priority bids exist
- Code Yellow: Standard workload
- Code Green: Lower priority items

**Features:**
- Idempotent (upserts by task ID, no duplicates)
- Integrates with bidRules for submission tracking
- Uses task indexes to avoid duplicate submission reminders
- Reads from Bids Intelligence and Dashboard endpoints

**Dependencies:**
- `SECRETARY_TASKS_SHEET_ID` - Destination for tasks
- `GOOGLE_SHEET_ID` - Bids Intelligence source
- Endpoints: getBids, getSocialMediaContent, getWebinars

---

### 12. `secretaryRemindDue2.js`
**Purpose:** Phase-based reminder system with quiet hours support.

**Trigger:** Every 5 minutes via scheduled function

**Manual Endpoint:** `GET /.netlify/functions/secretaryRemindDue2Manual?dryRun=true`

**Phase Windows (by days until due):**

| Days Until Due | Phase | Reminder Schedule |
|---------------|-------|-------------------|
| > 30 days | Dormant | No reminders |
| 30-15 days | White Phase | Mondays 09:00 only |
| 14-8 days | Green Phase | Every day at 12:00 |
| 7-4 days | Yellow Phase | 09:00, 12:00, 15:00 |
| 3-0 days | Red Phase | Every 2 hours from 08:00 |

**Overdue Handling:**
- 1-13 days past due: `dueStatus = "overdue"`
- 14-29 days past due: `dueStatus = "way-overdue"`
- ≥30 days past due: Auto-close (status = "closed", dueStatus = "auto-removed")

**Quiet Hours Settings** (from ExecutiveAssistant_Settings tab):
- `quietHoursEnabled` (true/false)
- `quietStart` (HH:MM, default: 21:00)
- `quietEnd` (HH:MM, default: 08:00)
- `quietTimeZone` (default: Europe/London)
- `quietMode`: 
  - `silent` - Still sends, but sound=none
  - `suppress` - Sends nothing during quiet hours

**Pushover Priority Mapping:**
- Code Red → Priority 1 (high)
- Code Yellow/Green → Priority 0 (normal)
- Code White → Priority -1 (low)

**Sound Mapping:**
- Code Red → "siren"
- Others → "pushover"
- Quiet Hours + Silent → "none"

**Features:**
- No cap on red-priority reminders
- Max 8 non-red reminders per run
- Updates `lastNotifiedAt` after sending
- Updates `dueStatus` column automatically

---

### 13. `secretaryCaptureTask.js`
**Purpose:** Captures new tasks via external integrations.

**Endpoint:** `POST /.netlify/functions/secretaryCaptureTask`

**Delegates to:** `./secretary/capture-task.js`

---

### 14. `secretaryEnvCheck.js`
**Purpose:** Diagnostic endpoint to verify environment setup.

**Endpoint:** `GET /.netlify/functions/secretaryEnvCheck`

**Returns:**
- Bootstrap vars status (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
- Secrets status (SECRETARY_TASKS_SHEET_ID, PUSHOVER tokens)

**Use Case:** Troubleshooting deployment issues

---

## Utility & Helper Functions

### 15. `linkedinOAuthHelper.js`
**Purpose:** OAuth flow helper for generating LinkedIn access tokens.

**Endpoints:**
- `GET /.netlify/functions/linkedinOAuthHelper?step=1` - Start OAuth
- `GET /.netlify/functions/linkedinOAuthHelper?step=2&code=XXX` - Exchange code for token

**Process:**
1. User visits step=1, gets authorization URL
2. User authorizes on LinkedIn
3. LinkedIn redirects with code
4. User visits step=2 with code
5. Function exchanges code for access token
6. Token displayed for manual copying to Netlify env vars

**Required Scopes:**
- `r_organization_social`
- `w_organization_social`
- `rw_organization_admin`

**Token Expiry:** 60 days - requires periodic regeneration

---

### 16. `inspectLinkedInToken.js`
**Purpose:** Inspects LinkedIn token scopes and validity.

**Endpoint:** `GET /.netlify/functions/inspectLinkedInToken`

**Returns:** HTML page showing:
- Token status (active/expired)
- Granted scopes
- Expiration date
- Warnings if missing required scopes

**Use Case:** Debugging LinkedIn publishing issues

---

### 17. `listSheetTabs.js`
**Purpose:** Lists all tabs/sheets in configured Google Sheets.

**Endpoint:** `GET /.netlify/functions/listSheetTabs`

**Returns:** JSON with all spreadsheets and their tabs:
- Main Bids Sheet (`GOOGLE_SHEET_ID`)
- Webinars Sheet (`WEBINAR_SHEET_ID`)
- Company Data Sheet (`COMPANY_DATA_SHEET_ID`)
- Bid Systems Sheet (`BID_SYSTEMS_SHEET_ID`)

**Use Case:** Discovery and debugging of sheet structure

---

### 18-20. Debug & Manual Wrappers

#### `secretaryLoopManual.js`
Manual HTTP wrapper for secretaryLoop (scheduled function)

#### `secretaryRemindDue2Manual.js`
Manual wrapper with JSON error surfacing for secretaryRemindDue2

#### `secretaryRemindDueDebug.js`
Debug proxy that adds `x-secretary-debug-proxy` header to responses

---

## Environment Variables

### Google Sheets
- `GOOGLE_SHEET_ID` - Main Bids Intelligence sheet
- `WEBINAR_SHEET_ID` - Webinars data sheet
- `SOCIAL_MEDIA_SHEET_ID` - Social media content sheet
- `COMPANY_DATA_SHEET_ID` - Company data sheet
- `BID_SYSTEMS_SHEET_ID` - Bid systems reference
- `SECRETARY_TASKS_SHEET_ID` - Executive assistant tasks (secret)

### Google Authentication
- `GOOGLE_CLIENT_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key (base64 or raw)

### Social Media - Facebook
- `FACEBOOK_PAGE_ACCESS_TOKEN` - Page access token
- `FACEBOOK_PAGE_ID` - Target page ID

### Social Media - LinkedIn
- `LINKEDIN_ACCESS_TOKEN` - Organization access token (60-day expiry)
- `LINKEDIN_ORG_URN` - Organization URN (default: `urn:li:organization:107582691`)
- `LINKEDIN_CLIENT_ID` - OAuth app client ID
- `LINKEDIN_CLIENT_SECRET` - OAuth app secret
- `LINKEDIN_REDIRECT_URI` - OAuth callback URL

### Social Media - WordPress
- `WP_USERNAME` - WordPress admin username
- `WP_APPLICATION_PASSWORD` - WordPress application password
- `WP_POSTS_URL` - WordPress posts endpoint (default: `https://mymentalarmor.com/wp-json/wp/v2/posts`)

### Email - Brevo
- `BREVO_API_KEY` - Brevo API key
- `BREVO_LIST_ID` - Default recipient list ID
- `BREVO_SENDER_NAME` - Sender name (default: "49 North")
- `BREVO_SENDER_EMAIL` - Sender email

### AI Analysis
- `OPENAI_API_KEY` - OpenAI API key for webinar analysis
- `OPENAI_MODEL` - Model to use (default: `gpt-4o`)
- `OPENAI_TEMPERATURE` - Temperature setting (default: 0.7)
- `OPENAI_MAX_TOKENS` - Max tokens (default: 3000)
- `OPENAI_TIMEOUT_MS` - Timeout in milliseconds (default: 20000)

### Executive Assistant - Pushover
- `PUSHOVER_APP_TOKEN` - Pushover application token (secret)
- `PUSHOVER_USER_KEY` - Pushover user key (secret)

### Performance & Timeouts
- `GOOGLE_TIMEOUT_MS` - Google Sheets timeout (default: 7000-8000ms)
- `REQUIRE_TICKER_AUTH` - Require auth for ticker feed (default: true)

### Sheet Ranges
- `TICKER_RANGE` - Ticker feed range (default: `TickerFeed!A2:F`)

---

## Common Utilities

### `_utils/google.js`
- `loadServiceAccount()` - Loads Google service account credentials
- `getGoogleAuth()` - Returns authenticated Google client

### `_utils/http.js`
- `corsHeaders()` - CORS header generator
- `methodGuard()` - HTTP method validation
- `checkAuth()` - Authentication check (X-App-Token)
- `ok()`, `bad()`, `unauth()`, `serverErr()` - Response helpers

### `_utils/secrets.js`
- `getSecret()` - Retrieves secrets from 49N_Secrets sheet

### `_utils/bidRules.js`
- `evaluateBidRules()` - Generates bid-related tasks

### `_utils/taskIndex.js`
- `buildTaskIndexes()` - Builds task deduplication indexes

---

## Security Notes

1. **Authentication:** Most functions require `X-App-Token` header matching `APP_TOKEN` env var
2. **Service Account:** Google Sheets access uses service account (not OAuth)
3. **Secrets Sheet:** Sensitive values stored in `49N_Secrets` Google Sheet
4. **CORS:** All functions support CORS with configurable origins
5. **Rate Limiting:** Google Sheets operations have timeout protections

---

## Error Handling

All functions follow consistent error patterns:

```javascript
try {
  // Function logic
  return ok(headers, { success: true, data });
} catch (error) {
  console.error('Function error:', error);
  return serverErr(headers, error.message);
}
```

Common error responses:
- 400 - Bad Request (invalid input)
- 401 - Unauthorized (missing/invalid token)
- 404 - Not Found (resource missing)
- 405 - Method Not Allowed
- 500 - Internal Server Error

---

## Testing & Debugging

### Dry Run Mode
Many functions support `?dryRun=true` query parameter:
- `secretaryLoop.js?dryRun=true`
- `secretaryRemindDue2.js?dryRun=true`

### Manual Triggers
Scheduled functions have manual wrappers:
- `secretaryLoopManual.js`
- `secretaryRemindDue2Manual.js`

### Diagnostics
- `secretaryEnvCheck.js` - Check environment setup
- `listSheetTabs.js` - Inspect sheet structure
- `inspectLinkedInToken.js` - Verify LinkedIn token

---

## Deployment

All functions are deployed via Netlify:
1. Push to Git repository
2. Netlify builds and deploys automatically
3. Scheduled functions run via Netlify cron
4. Environment variables managed in Netlify dashboard

**Function URLs:**
```
https://49northcommandcenter.netlify.app/.netlify/functions/FUNCTION_NAME
```

---

## Maintenance

### Regular Tasks
1. **LinkedIn Token Renewal** - Every 60 days via OAuth helper
2. **Review Quiet Hours** - Adjust in ExecutiveAssistant_Settings
3. **Monitor Logs** - Check Netlify function logs for errors
4. **Update AI Prompts** - Refine in getWebinarAnalysis.js if needed

### Common Issues
1. **Google Sheets 403** - Service account needs sheet access
2. **LinkedIn 401** - Token expired, regenerate via OAuth helper
3. **Pushover Not Sending** - Check PUSHOVER tokens in secrets
4. **Tasks Not Generating** - Verify SECRETARY_TASKS_SHEET_ID exists

---

## Version History

**Current Version:** January 2026
- Bid rules integration with secretary loop
- Phase-based reminder system with quiet hours
- Webinar lead scoring enhancements
- Auto-removal of 30+ day overdue tasks

---

## Additional Functions (Part 2)

### 21. `setExecutiveAssistantSettings.js`
**Purpose:** Updates Executive Assistant quiet hours and notification settings.

**Endpoint:** `POST /.netlify/functions/setExecutiveAssistantSettings`

**Request Body:**
```json
{
  "settings": {
    "quietHoursEnabled": "true",
    "quietStart": "21:00",
    "quietEnd": "08:00",
    "quietTimeZone": "Europe/London",
    "quietMode": "silent"
  }
}
```

**Settings:**
- `quietHoursEnabled` - Enable/disable quiet hours (true/false)
- `quietStart` - Start time in HH:MM format (e.g., "21:00")
- `quietEnd` - End time in HH:MM format (e.g., "08:00")
- `quietTimeZone` - IANA timezone (e.g., "Europe/London", "America/New_York")
- `quietMode` - Behavior during quiet hours:
  - `silent` - Send notifications but with no sound
  - `suppress` - Don't send any notifications

**Target Sheet:** `SECRETARY_TASKS_SHEET_ID` → ExecutiveAssistant_Settings tab

**Validation:**
- Validates HH:MM time format
- Ensures quietMode is either "silent" or "suppress"

**Use Case:** Configure when and how the Executive Assistant sends Pushover notifications

---

### 22. `syncWebinarContactsToBrevo.js`
**Purpose:** Syncs webinar registrants and attendees to Brevo CRM with engagement tracking.

**Endpoint:** `POST /.netlify/functions/syncWebinarContactsToBrevo`

**Process:**
1. Fetches registrations, attendance, and surveys from webinar sheets
2. Groups data by email address
3. Calculates engagement metrics per contact
4. Batch imports to Brevo using import API (up to 1000 at once)
5. Falls back to sequential sync if batch fails

**Brevo Attributes Updated:**
- `FIRSTNAME`, `LASTNAME` - From registration name
- `ORGANIZATION_NAME` - From registration
- `PHONE_MOBILE` - From registration
- `WEBINARS_ATTENDED_COUNT` - Number of unique webinars attended
- `ATTENDED_WEBINAR` - Yes/No flag
- `WEB_CONTACT_REQ` - From survey response
- `SOURCED_FROM` - Set to "Webinar"
- `LAST_CHANGED` - Current timestamp
- `INITIAL_CONTACT_TIME` - First registration date
- `REGISTRATION_TIME`, `WEBINAR_ID`, `JOIN_TIME`, `DURATION_MINUTES`
- `RELEVANCE_RATING`, `SURVEY_SUBMITTED_TIME` - If survey completed

**Target List:** List ID 108 (DATABASE MASTER)

**Returns:**
```json
{
  "success": true,
  "synced": 245,
  "created": 73,
  "updated": 172,
  "errors": 0,
  "timestamp": "2026-01-08T12:00:00Z"
}
```

**Performance:** Batch API processes up to 1000 contacts simultaneously, falls back to parallel batches of 10 if needed.

---

### 23. `updateBidStatus.js`
**Purpose:** Updates bid status and moves bids between sheets (Active_Bids, Submitted, Disregarded, Active_Admin).

**Endpoint:** `POST /.netlify/functions/updateBidStatus`

**Request Body:**
```json
{
  "bidId": "5",
  "status": "submitted",
  "dueDate": "2026-02-15"
}
```

**Or batch mode:**
```json
{
  "bidIds": ["5", "7", "12"],
  "status": "disregard"
}
```

**Valid Statuses:**
- `respond` - Quick update: Sets Recommendation to "Respond" (column A only)
- `submitted` - Moves to Submitted sheet (A:V with submission date)
- `disregard` - Moves to Disregarded sheet (A:U)
- `system-admin` - Moves to Active_Admin for system correspondence tracking

**Features:**
- Single or batch mode (processes multiple bids)
- Updates Due Date (column M) when status is "submitted"
- Deletes row from Active_Bids after move
- Clears getBids cache automatically
- Maps columns correctly for each destination sheet

**Column Mappings:**

**To Submitted (A:V):**
- Copies all A:U columns from Active_Bids
- Adds column V: Submission Date (today)

**To Active_Admin (A:J):**
- A: "Systems Administration" (override)
- B: Email Date Received (from E)
- C: Email From (from F)
- D: Email Subject (from J)
- E: Email Body (from K)
- F: Bid System (from P)
- G: Email Domain (from O)
- H: Date Added (from T or today)
- I: Source Email ID (from U)
- J: Status = "New"

---

### 24. `updateBidSystem.js`
**Purpose:** Updates bid system registry entries (credentials, status, renewal dates).

**Endpoint:** `POST /.netlify/functions/updateBidSystem`

**Requires:** `X-App-Token` header (if APP_TOKEN env var is set)

**Request Body:**
```json
{
  "systemId": "SYS001",
  "fields": {
    "systemName": "SAM.gov",
    "status": "Active",
    "username": "user@example.com",
    "password": "newpassword123",
    "lastLoginDate": "2026-01-08",
    "renewalDate": "2026-12-31",
    "notes": "Updated credentials"
  }
}
```

**Updatable Fields (A:U):**
- System metadata: `systemName`, `category`, `status`
- URLs: `websiteUrl`, `loginUrl` (auto-adds https://)
- Credentials: `username`, `password`
- Dates: `registrationDate`, `lastLoginDate`, `renewalDate`
- Alerts: `emailAlertsEnabled` (Yes/No), `alertEmailAddress`
- Classification: `codeType`, `codeNumbers`, `geographicCoverage`
- Subscription: `subscriptionType`, `annualCost`
- Notes: `notes`

**Auto-Updates:**
- `lastUpdated` - Set to today's date automatically

**Target Sheet:** `BID_SYSTEMS_SHEET_ID` → BidSystemsRegistry tab

**Use Case:** Update bid system credentials, renewal dates, and status without editing sheet directly

---

### 25. `updateContact.js`
**Purpose:** Updates contact information in Brevo CRM.

**Endpoint:** `PUT /.netlify/functions/updateContact`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "jobTitle": "Director",
  "organization": "Example Corp",
  "city": "London",
  "phoneOffice": "+44 20 1234 5678",
  "areasOfInterest": "Mental Health Training",
  "notes": "Interested in webinar series"
}
```

**Updatable Fields:**

**Basic Info:**
- `firstName`, `lastName`, `jobTitle`, `credentials`

**Organization:**
- `organization`, `organizationType`, `organizationSize`, `organizationAddress`

**Location:**
- `city`, `state`, `county`, `zipCode`, `country`

**Contact Methods:**
- `phoneOffice`, `phoneMobile`, `phoneExtension`, `whatsapp`, `linkedin`

**Additional:**
- `areasOfInterest`, `customTag`, `sourcedFrom`, `notes`

**Auto-Updates:**
- `LAST_CHANGED` - Set to current timestamp

**Brevo Attribute Mapping:**
- Frontend field names → UPPERCASE_BREVO_ATTRIBUTES
- e.g., `firstName` → `FIRSTNAME`, `phoneOffice` → `PHONE_OFFICE`

---

### 26. `updateReminder.js`
**Purpose:** Completes or reschedules tasks in the Executive Assistant system.

**Endpoint:** `POST /.netlify/functions/updateReminder`

**Request Body:**

**Complete a task (deletes row):**
```json
{
  "id": "tsk_abc123",
  "action": "complete"
}
```

**Reschedule a task:**
```json
{
  "id": "tsk_abc123",
  "action": "reschedule",
  "dueAt": "2026-01-15T14:00:00Z"
}
```

**Actions:**
- `complete` - **Hard deletes** the row from Tasks sheet (permanent removal)
- `reschedule` - Updates `dueAt`, clears `lastNotifiedAt`, sets status to "open"

**Target Sheet:** `SECRETARY_TASKS_SHEET_ID` → Tasks tab

**Use Case:** 
- Mark tasks as done (removes from sheet entirely)
- Postpone tasks to a new date/time

**Note:** Complete action is a hard delete, not a status change. If you need task history, consider archiving to a separate sheet before implementing this.

---

### 27. `updateSystemAdminStatus.js`
**Purpose:** Archives (deletes) system admin emails from Active_Admin sheet.

**Endpoint:** `POST /.netlify/functions/updateSystemAdminStatus`

**Request Body:**
```json
{
  "sourceEmailId": "email123",
  "status": "archived"
}
```

**Process:**
1. Finds row in Active_Admin by Source Email ID (column I)
2. Deletes the row (hard delete, no archiving to another sheet)
3. Returns success confirmation

**Target Sheet:** `GOOGLE_SHEET_ID` → Active_Admin tab

**Use Case:** Remove processed system administration correspondence from active view

**Note:** This is a hard delete. Consider adding archiving to a "ProcessedAdmin" sheet if you need history.

---

### 28. `uploadDocument.js`
**Purpose:** Uploads documents to Google Drive and logs them in CompanyDocuments sheet.

**Endpoint:** `POST /.netlify/functions/uploadDocument`

**Requires:** `X-App-Token` header (optional, if APP_TOKEN set)

**Request Body:**
```json
{
  "filename": "contract.pdf",
  "mimeType": "application/pdf",
  "base64": "JVBERi0xLjQKJeLjz9MK...",
  "sheetRowMeta": {
    "category": "Contracts",
    "notes": "Q1 2026 service agreement"
  }
}
```

**Or legacy format:**
```json
{
  "fileName": "contract.pdf",
  "fileData": "JVBERi0xLjQKJeLjz9MK...",
  "category": "Contracts",
  "notes": "Q1 2026 service agreement"
}
```

**Allowed MIME Types:**
- `application/pdf`
- `image/jpeg`
- `image/png`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Size Limit:** 5MB (configurable via `MAX_UPLOAD_BYTES`)

**Process:**
1. Validates file type and size
2. Sanitizes filename
3. Uploads to Google Drive (into `GOOGLE_DRIVE_FOLDER_ID` if set)
4. Generates Document ID (DOC001, DOC002, etc.)
5. Logs to CompanyDocuments sheet

**CompanyDocuments Columns (A:H):**
- A: Document ID (DOC###)
- B: Category
- C: Document Name
- D: File Type (MIME)
- E: Upload Date (YYYY-MM-DD)
- F: Drive File ID
- G: File Size (human-readable)
- H: Notes

**Returns:**
```json
{
  "success": true,
  "file": {
    "id": "1abc123xyz",
    "name": "contract.pdf",
    "mimeType": "application/pdf",
    "webViewLink": "https://drive.google.com/file/d/...",
    "webContentLink": "https://drive.google.com/uc?id=...",
    "sizeBytes": 245678,
    "sizeReadable": "240.0 KB",
    "uploadedAt": "2026-01-08T12:00:00Z"
  }
}
```

---

### 29. `uploadImageToWordPress.js`
**Purpose:** Uploads images to WordPress Media Library and returns the URL.

**Endpoint:** `POST /.netlify/functions/uploadImageToWordPress`

**Request Body:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "filename": "team-photo.jpg",
  "mimeType": "image/jpeg"
}
```

**Process:**
1. Strips base64 prefix from imageData
2. Converts to buffer
3. Uploads to WordPress Media Library via REST API
4. Returns media details

**Returns:**
```json
{
  "success": true,
  "mediaId": 456,
  "url": "https://mymentalarmor.com/wp-content/uploads/2026/01/team-photo.jpg",
  "title": "team-photo",
  "alt": "",
  "caption": "",
  "width": 1920,
  "height": 1080,
  "filesize": 245678,
  "mimeType": "image/jpeg"
}
```

**Use Case:** Upload images from dashboard to WordPress before publishing social posts

---

## Utility Files (_utils/)

### 30. `bidRules.js`
**Purpose:** Pure JavaScript rule evaluation engine for bid task generation.

**Key Functions:**

**`evaluateBidRules({ activeBids, submittedBids, existingTaskIds, knownSubmissionSourceIds })`**
- Main export function
- Returns array of task objects to upsert

**Rule Categories:**

**Rule A: Due-Soon Bids (from Active_Bids)**
- Criteria:
  - Recommendation = "Respond"
  - Score > 12.0
  - Relevance = "High"
  - Added within last 30 days
- Priority based on days until due:
  - ≤3 days: Code Red 🔥
  - 4-7 days: Code Yellow 🟡
  - 8-14 days: Code Green 🟢
  - 15-30 days: Code White ⚪
- Task ID: `bid-due:<sourceEmailId>`

**Rule B: Submission Confirmations (from Submitted sheet)**
- Creates acknowledgment tasks for newly submitted bids
- Priority: Code White
- Only creates if not already in `knownSubmissionSourceIds`
- Task ID: `bid-submitted:<sourceEmailId>`

**Rule C: Bid Opening Pressure (from Submitted sheet)**
- Creates tasks for formal bid opening dates within 5 days
- Priority: 
  - ≤1 day: Code Red
  - 2-5 days: Code Yellow
- Task ID: `bid-opening:<sourceEmailId>`

**Date Handling:**
- Supports ISO strings, MM/DD/YYYY, M/D/YYYY, "Month Day, Year"
- Treats date-only values as end-of-day (23:59 UTC)
- Falls back to Email Date Received + 30 days if Due Date missing
- Further fallback to Date Added + 30 days

**Features:**
- No external dependencies
- Deterministic task IDs prevent duplicates
- Title trimming for readability (110 chars max)
- Comprehensive notes with all relevant bid metadata

---

### 31. `google.js`
**Purpose:** Shared Google authentication and client factory functions.

**Functions:**

**`loadServiceAccount()`**
- Loads service account credentials from env vars
- Supports 3 formats:
  1. `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` - Base64-encoded full JSON
  2. `GOOGLE_SERVICE_ACCOUNT_KEY` - Raw JSON string
  3. **NEW:** Individual env vars (recommended for size):
     - `GOOGLE_CLIENT_EMAIL`
     - `GOOGLE_PRIVATE_KEY`
     - Optional: `GOOGLE_PROJECT_ID`, `GOOGLE_PRIVATE_KEY_ID`, `GOOGLE_CLIENT_ID`
- Automatically handles `\n` replacement in private keys
- Returns full service account JSON object

**`getGoogleAuth(scopes)`**
- Returns `GoogleAuth` instance (JWT-based)
- Default scopes: Sheets, Drive, Drive.file
- Use `.getClient()` to get auth client (not deprecated `.authorize()`)

**`sheetsClient(auth)`**
- Returns Google Sheets API v4 client

**`driveClient(auth)`**
- Returns Google Drive API v3 client

**Example Usage:**
```javascript
const { getGoogleAuth, sheetsClient } = require('./_utils/google');

const auth = getGoogleAuth();
await auth.getClient();
const sheets = sheetsClient(auth);

const response = await sheets.spreadsheets.values.get({
  spreadsheetId: 'abc123',
  range: 'Sheet1!A:Z'
});
```

---

### 32. `http.js`
**Purpose:** Lightweight HTTP helpers for consistent responses and authentication.

**Functions:**

**`corsHeaders(origin)`**
- Returns CORS headers object
- Allows origin (or `*`), headers, and methods

**`methodGuard(event, headers, ...allowed)`**
- Handles OPTIONS preflight automatically
- Returns 405 error if method not in allowed list
- Returns `null` if method is allowed (proceed with function logic)

**`safeJson(str)`**
- Safe JSON parser
- Returns `[parsedObject, null]` on success
- Returns `[null, error]` on failure

**Response Helpers:**
- `ok(headers, payload)` - 200 OK with JSON body
- `bad(headers, message)` - 400 Bad Request
- `unauth(headers, message)` - 401 Unauthorized
- `serverErr(headers, message)` - 500 Internal Server Error

**`checkAuth(event)`**
- Simple shared-secret authentication
- If `APP_TOKEN` env var is unset, allows all requests
- If `APP_TOKEN` is set, requires matching `X-App-Token` header
- Returns boolean

**Example Usage:**
```javascript
const { corsHeaders, methodGuard, ok, unauth, checkAuth } = require('./_utils/http');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return unauth(headers);
  
  // Your function logic
  return ok(headers, { success: true, data: 'result' });
};
```

---

### 33. `limits.js`
**Purpose:** Upload size and MIME type restrictions.

**Constants:**

**`MAX_UPLOAD_BYTES`**
- Default: 5MB (5 * 1024 * 1024)
- Configurable via `MAX_UPLOAD_BYTES` env var

**`ALLOWED_MIME`**
- Default: `['application/pdf', 'image/png', 'image/jpeg']`
- Configurable via `ALLOWED_UPLOAD_MIME` env var (comma-separated)
- Auto-deduplicates and lowercases

**Example Usage:**
```javascript
const { MAX_UPLOAD_BYTES, ALLOWED_MIME } = require('./_utils/limits');

if (fileSize > MAX_UPLOAD_BYTES) {
  return error('File too large');
}
if (!ALLOWED_MIME.includes(mimeType)) {
  return error('File type not allowed');
}
```

---

### 34. `ramping.js`
**Purpose:** Phase calculation and reminder scheduling logic (legacy, mostly replaced by secretaryRemindDue2).

**Key Functions:**

**`computePhase(now, dueAt)`**
- Returns phase string based on days until/after due
- Phases: "dormant", "white", "green", "yellow", "red", "overdue", "wayOverdue", "expired"

**`computeNextRemindAt(phase, now)`**
- Calculates next reminder time based on phase
- Phase schedules:
  - Dormant: null (no reminders)
  - White: Next Monday 09:00
  - Green: Next day 12:00
  - Yellow: Next slot (09:00, 12:00, 15:00)
  - Red: Every 2 hours from 08:00 (08:00, 10:00, 12:00, etc.)
  - Overdue: Daily 09:00
  - Way Overdue: 3 days later 09:00
  - Expired: null

**`isExpired(now, dueAt)`**
- Returns true if 30+ days past due

**Helper Functions:**
- `diffInDays(a, b)` - Difference in whole days (UTC)
- `diffLateDays(dueAt, now)` - Days past due

**Note:** This module is largely superseded by the phase-based reminder logic in `secretaryRemindDue2.js`, which implements these concepts directly.

---

### 35. `secrets.js`
**Purpose:** Secure secret management via Google Sheets with 5-minute caching.

**Key Function:**

**`getSecret(key)`**
- Fetches secret from `COMPANY_DATA_SHEET_ID` → 49N_Secrets tab
- Returns secret value as string
- Throws error if key not found or disabled

**Sheet Structure (49N_Secrets tab):**
- Column A: `key` - Secret name (e.g., "SECRETARY_TASKS_SHEET_ID")
- Column B: `value` - Secret value
- Column C: `enabled` - TRUE/FALSE flag

**Caching:**
- 5-minute TTL in-memory cache per Lambda instance
- Reduces Google Sheets API calls
- Fresh load after TTL expires

**Security Features:**
- Only returns secrets with `enabled=TRUE`
- Service account authentication
- Read-only scope

**Example Usage:**
```javascript
const { getSecret } = require('./_utils/secrets');

const secretValue = await getSecret('PUSHOVER_APP_TOKEN');
const sheetId = await getSecret('SECRETARY_TASKS_SHEET_ID');
```

**Common Secrets:**
- `SECRETARY_TASKS_SHEET_ID` - Tasks sheet ID
- `PUSHOVER_APP_TOKEN` - Pushover application token
- `PUSHOVER_USER_KEY` - Pushover user key

---

### 36. `taskIndex.js`
**Purpose:** Builds idempotency indexes from Tasks sheet to prevent duplicate task generation.

**Main Function:**

**`buildTaskIndexes({ header, rows })`**

**Parameters:**
- `header` - Array of column names from Tasks!A1:Z1
- `rows` - Array of data rows (excluding header)

**Returns:**
```javascript
{
  existingTaskIds: Set<string>,           // All existing task IDs
  knownSubmissionSourceIds: Set<string>   // Source IDs with confirmed submissions
}
```

**Logic:**
1. Extracts all task IDs from the `id` column
2. Identifies submission confirmation tasks (`bid-submitted:<sourceId>`)
3. Extracts source email IDs from submission tasks
4. Ignores closed tasks for submission tracking

**Task ID Convention:**
- `bid-due:<sourceEmailId>` - Due-soon bid
- `bid-submitted:<sourceEmailId>` - Submission confirmation
- `bid-opening:<sourceEmailId>` - Bid opening reminder

**Use Case:** 
- `secretaryLoop.js` uses these indexes to avoid generating duplicate tasks
- Prevents re-creating submission confirmations for already-submitted bids

**Example:**
```javascript
const { buildTaskIndexes } = require('./_utils/taskIndex');

const { existingTaskIds, knownSubmissionSourceIds } = buildTaskIndexes({
  header: ['id', 'createdAt', 'title', ...],
  rows: [
    ['bid-due:email123', '2026-01-01T12:00:00Z', 'Bid Due', ...],
    ['bid-submitted:email456', '2026-01-02T10:00:00Z', 'Submitted', ...]
  ]
});

console.log(existingTaskIds.has('bid-due:email123')); // true
console.log(knownSubmissionSourceIds.has('email456')); // true
```

---

## Secretary Sub-Modules (secretary/)

### 37. `parseTask.js`
**Purpose:** Natural language parser for task capture from text input.

**Main Function:**

**`parseTask(rawText)`**

**Supported Patterns:**

**Time-based:**
- "in 30m" / "in 2h" - Relative time
- "at 2026-01-15 14:00" - Absolute datetime

**Examples:**
- "Remind me to call John in 30 minutes"
  - Due: 30 minutes from now
  - Notify every: 5 minutes
- "Remind me to review proposal at 2026-01-15 14:00"
  - Due: 2026-01-15 14:00 UTC
  - Notify every: 60 minutes
- "Submit quarterly report"
  - No due date
  - Default notify: 60 minutes

**Returns:**
```javascript
{
  title: "Call John",              // Cleaned title (max 120 chars)
  notes: "Remind me to call John in 30 minutes",  // Original text
  dueAtISO: "2026-01-08T12:30:00Z",  // ISO string or null
  tz: "Europe/London",             // Timezone
  notifyEveryMins: 5,              // Reminder interval
  priority: 3                      // Priority level
}
```

**Cleaning:**
- Removes "remind me to " prefix
- Truncates title to 120 characters
- Defaults to "Task" if empty

**Future Enhancement:** Proper timezone handling (currently uses Z/UTC)

---

### 38. `pushover.js`
**Purpose:** Send Pushover notifications via API.

**Main Function:**

**`sendPushover(message, title)`**

**Parameters:**
- `message` - Notification body text
- `title` - Notification title (default: "Diana – 49N Secretary")

**Credentials:**
- Fetches from secrets sheet:
  - `PUSHOVER_APP_TOKEN`
  - `PUSHOVER_USER_KEY`

**Error Handling:**
- Throws error with status and response text if API call fails

**Example Usage:**
```javascript
const { sendPushover } = require('./lib/pushover');

await sendPushover('Task completed: Review proposal');
await sendPushover('New high-priority bid', 'Urgent Task Alert');
```

---

### 39. `sheets.js`
**Purpose:** Secretary-specific Google Sheets operations.

**Functions:**

**`getTasksSheetId()`**
- Fetches `SECRETARY_TASKS_SHEET_ID` from secrets
- Returns sheet ID string

**`appendTaskRow(values)`**
- Appends a row to Tasks sheet
- Values array should match Tasks header schema (A:N)

**`getAllTasks()`**
- Fetches all tasks from Tasks sheet (range A:M)
- Returns `{ header: [], data: [] }`

**Example Usage:**
```javascript
const { appendTaskRow, getAllTasks } = require('./lib/sheets');

// Append new task
await appendTaskRow([
  'tsk_abc123',              // id
  '2026-01-08T12:00:00Z',   // createdAt
  'User',                    // createdBy
  'Call client',             // rawText
  'Call client',             // title
  'Follow up on proposal',   // notes
  '2026-01-10T09:00:00Z',   // dueAt
  'UTC',                     // tz
  '',                        // recurrence
  'code-yellow',             // priority
  'open',                    // status
  '',                        // lastNotifiedAt
  '60'                       // notifyEveryMins
]);

// Fetch all tasks
const { header, data } = await getAllTasks();
```

---

### 40. `capture-task.js`
**Purpose:** Main handler for task capture endpoint.

**Endpoint:** `POST /.netlify/functions/secretaryCaptureTask`

**Request Body:**
```json
{
  "rawText": "Remind me to review contract in 2 hours",
  "createdBy": "WebUI"
}
```

**Process:**
1. Parses rawText using `parseTask()`
2. Generates unique task ID (`tsk_<random>_<timestamp>`)
3. Appends to Tasks sheet via `appendTaskRow()`
4. Sends Pushover confirmation notification
5. Returns task ID

**Returns:**
```json
{
  "ok": true,
  "id": "tsk_a7b3c2_1jf89d"
}
```

**Task ID Format:**
- `tsk_` prefix
- 8-char random base36 string
- Underscore separator
- Timestamp in base36

**Use Case:** Capture tasks from web UI, Slack, or other integrations

---

## Environment Variables (Complete List)

### Core Google Services
- `GOOGLE_CLIENT_EMAIL` - Service account email (**required**)
- `GOOGLE_PRIVATE_KEY` - Service account private key (**required**)
- `GOOGLE_PROJECT_ID` - GCP project ID (optional)
- `GOOGLE_PRIVATE_KEY_ID` - Key ID (optional)
- `GOOGLE_CLIENT_ID` - Client ID (optional)

### Legacy Google Auth (deprecated)
- `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` - Base64-encoded full JSON
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Raw JSON string

### Google Sheets
- `GOOGLE_SHEET_ID` - Main Bids Intelligence sheet (**required**)
- `WEBINAR_SHEET_ID` - Webinars data sheet (**required**)
- `SOCIAL_MEDIA_SHEET_ID` - Social media content sheet (**required**)
- `COMPANY_DATA_SHEET_ID` - Company data + 49N_Secrets sheet (**required**)
- `BID_SYSTEMS_SHEET_ID` - Bid systems registry (**required**)
- `SECRETARY_TASKS_SHEET_ID` - Executive assistant tasks (stored in secrets)

### Google Drive
- `GOOGLE_DRIVE_FOLDER_ID` - Upload destination folder (optional)

### Authentication
- `APP_TOKEN` - Shared secret for API authentication (optional)

### Social Media - Facebook
- `FACEBOOK_PAGE_ACCESS_TOKEN` - Page access token
- `FACEBOOK_PAGE_ID` - Target page ID

### Social Media - LinkedIn
- `LINKEDIN_ACCESS_TOKEN` - Organization access token (60-day expiry)
- `LINKEDIN_ORG_URN` - Organization URN (default: `urn:li:organization:107582691`)
- `LINKEDIN_CLIENT_ID` - OAuth app client ID
- `LINKEDIN_CLIENT_SECRET` - OAuth app secret
- `LINKEDIN_REDIRECT_URI` - OAuth callback URL

### Social Media - WordPress
- `WP_USERNAME` - WordPress admin username
- `WP_APPLICATION_PASSWORD` - WordPress application password
- `WP_POSTS_URL` - Posts endpoint (default: `https://mymentalarmor.com/wp-json/wp/v2/posts`)

### Email - Brevo
- `BREVO_API_KEY` - Brevo API key
- `BREVO_LIST_ID` - Default recipient list ID (default: 108)
- `BREVO_SENDER_NAME` - Sender name (default: "49 North")
- `BREVO_SENDER_EMAIL` - Sender email

### AI Analysis
- `OPENAI_API_