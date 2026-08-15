# 49 North Command Center - Function Documentation
## Batch 1 of 4 (Functions 1-20)

**Company:** 49 North, a division of TechWerks, LLC  
**System:** Integrated Business Management Platform  
**Documentation Date:** January 8, 2026

---

## Table of Contents - Batch 1
1. [Bid System Management](#bid-system-management)
2. [CRM & Contact Management](#crm--contact-management)
3. [Data Maintenance & Archiving](#data-maintenance--archiving)
4. [Social Media Management](#social-media-management)
5. [Webinar Management](#webinar-management)
6. [AI & Analytics](#ai--analytics)
7. [Utilities](#utilities)

---

## Bid System Management

### 1. addBidSystem.js
**Purpose:** Adds new bid tracking systems to the centralized registry

**Functionality:**
- Creates unique system IDs (SYS001, SYS002, etc.)
- Stores system credentials and metadata
- Tracks registration dates and renewal information
- Validates required fields (System Name, Geographic Coverage)

**Key Features:**
- Auto-generates sequential system IDs (robust to deletions)
- Normalizes URLs (adds https:// if missing)
- Handles subscription types and costs
- Optional app token authentication

**Data Stored:** System ID, Name, Category, Status, Website URL, Login URL, Credentials, Registration Date, Email Alerts, Code Types, Geographic Coverage, Subscription Type, Renewal Date, Annual Cost, Notes

**Integration:** Google Sheets (BID_SYSTEMS_SHEET_ID)

---

### 14. deleteBidSystem.js
**Purpose:** Removes bid systems from the registry

**Functionality:**
- Finds system by System ID
- Physically deletes the row from Google Sheets
- Uses batchUpdate for clean deletion

**Security:** Optional app token authentication

**Integration:** Google Sheets (BID_SYSTEMS_SHEET_ID)

---

### 20. getBids.js
**Purpose:** Retrieves and caches all bid opportunities across multiple tabs

**Functionality:**
- Fetches from Active_Bids, Disregarded, and Submitted tabs
- Implements in-memory caching with 5-minute TTL
- ETag support for conditional requests (304 Not Modified)
- Provides summary statistics

**Performance Features:**
- Cache mechanism reduces API calls
- ETag validation for bandwidth optimization
- Filters empty rows

**Data Returned:**
- Active bids with AI recommendations
- Disregarded bids with reasoning
- Submitted bids with submission dates
- Summary counts (respond, gather info, totals)

**Integration:** Google Sheets (GOOGLE_SHEET_ID)

---

## CRM & Contact Management

### 2. addContactNote.js
**Purpose:** Adds timestamped notes to contacts and syncs with Brevo CRM

**Functionality:**
- Stores notes in Google Sheets ContactNotes tab
- Syncs notes to Brevo NOTES field with timestamps
- Supports note types and follow-up dates
- Appends to existing notes (maintains history)

**Data Captured:** Timestamp, Email, Note Type, Note Content, Created By, Follow Up Date

**Dual-Write:** Both Google Sheets and Brevo for redundancy

**Integration:** Google Sheets (CRM_SHEET_ID), Brevo API

---

### 3. addFollowUpTask.js
**Purpose:** Creates actionable follow-up tasks for contacts

**Functionality:**
- Generates unique task IDs (TASK######)
- Stores in CRM FollowUpTasks tab
- Tracks due dates and status (Open/Completed)

**Task Fields:** Task ID, Email, Contact Name, Task Description, Due Date, Status, Created Date

**Integration:** Google Sheets (CRM_SHEET_ID)

---

### 6. bulkUpdateContacts.js
**Purpose:** Updates multiple contacts simultaneously with same attributes

**Functionality:**
- Accepts array of email addresses
- Applies updates object to all contacts
- Maps friendly field names to Brevo attributes
- Tracks success/failure counts

**Updatable Fields:** 
- Basic Info: firstName, lastName, jobTitle, credentials
- Organization: organization, organizationType, organizationSize, organizationAddress
- Location: city, state, county, zipCode, country
- Contact Methods: phoneOffice, phoneMobile, phoneExtension, whatsapp, linkedin
- Additional: areasOfInterest, customTag, sourcedFrom

**Integration:** Brevo API

---

### 9. createContact.js
**Purpose:** Creates new contacts in Brevo CRM

**Functionality:**
- Validates email format
- Creates contact with full attribute set
- Adds to DATABASE MASTER list (ID: 108)
- Prevents duplicates (returns error if exists)
- Auto-timestamps: INITIAL_CONTACT_TIME, LAST_CHANGED

**Default Values:** Sourced From: "Manual Entry - CRM"

**Integration:** Brevo API

---

## Data Maintenance & Archiving

### 4. archiveOldDisregards.js
**Purpose:** Archives disregarded emails older than threshold to reduce clutter

**Functionality:**
- Default threshold: 90 days
- Moves old records to Disregarded_Archive tab
- Creates archive tab if it doesn't exist
- Maintains active data freshness

**Process:**
1. Identifies records older than threshold
2. Appends to archive tab
3. Removes from Disregarded tab
4. Returns counts of archived/remaining

**Integration:** Google Sheets (GOOGLE_SHEET_ID)

---

### 5. archiveOldSocialPosts.js
**Purpose:** Archives published social media posts older than threshold

**Functionality:**
- Default threshold: 180 days
- Only archives posts with status "Published"
- Moves to MainPostData_Archive tab
- Keeps active posts visible

**Use Case:** Maintains performance by reducing main sheet size while preserving historical data

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID)

---

### 7. cleanupOldData.js
**Purpose:** Comprehensive data cleanup across multiple systems

**Functionality:**
- Deletes draft social posts older than 30 days
- Removes orphaned webinar reminders
- Cleans up duplicate entries

**Cleanup Operations:**
1. Old Drafts: Removes stale social media drafts from MainPostData
2. Orphaned Reminders: Deletes reminder tracking for deleted webinars
3. Returns counts of items cleaned

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID, WEBINAR_SHEET_ID)

---

### 8. clearCaches.js
**Purpose:** Clears server-side in-memory caches

**Functionality:**
- Triggers cache invalidation
- Caches clear automatically on cold start (~15 min)
- Logs cache clear requests

**Note:** Actual clearing occurs on function timeout or redeployment due to serverless architecture

**Use Case:** Force fresh data retrieval after major updates

---

## Social Media Management

### 11. createSocialPost.js
**Purpose:** Creates social media posts in the content management system

**Functionality:**
- Generates ISO timestamp as unique post ID
- Supports multiple platforms (CSV or array)
- Handles webinar-linked posts
- Tracks post lifecycle (Draft → Scheduled → Published)

**Post Data (21 columns):**
- Metadata: timestamp, status, contentType, title, body
- Media: imageUrl, videoUrl
- Publishing: platforms, scheduleDate, publishedDate, postPermalink
- Platform IDs: facebookPostId, linkedInPostId, wordPressPostId, brevoEmailId
- Tracking: analytics, createdBy, tags, purpose
- Webinar Link: webinarId, webinarTitle

**Platform Support:** LinkedIn, Facebook, WordPress, Brevo Email

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID)

---

### 16. deleteSocialPost.js
**Purpose:** Removes social media posts from the system

**Functionality:**
- Finds post by postId (timestamp)
- Physically deletes row using batchUpdate
- Calculates correct row number for deletion

**Use Case:** Remove outdated, incorrect, or cancelled posts

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID)

---

### 18. generateWeeklyContent.js
**Purpose:** AI-powered social media content generation using OpenAI GPT-4

**Functionality:**
- Generates content for specific day types (Monday, Wednesday, Friday, Webinar, Custom)
- Analyzes 20 most recent posts for context
- Integrates Mental Armor Skills database
- Creates organization-focused content (not individual self-help)

**Content Types:**
- **Monday:** Resilience Skill Spotlight with actionable tips
- **Wednesday:** Follow-up content building on Monday's post
- **Friday:** Call-to-action synthesizing weekly themes
- **Webinar:** Promotional posts for upcoming webinars
- **Custom:** User-defined themes

**AI Features:**
- Uses GPT-4 (gpt-4o model)
- Temperature: 0.7 (balanced creativity)
- Max tokens: 1800 (concise, LinkedIn-optimized content)
- 24-second timeout protection
- Generates 150-250 word posts (LinkedIn ideal length)

**Content Requirements:**
- Starts with engaging question for leaders
- 2-3 actionable tips for teams/organizations
- References recent posts for continuity
- Includes company hashtags (#Resilience, #Leadership, #MentalArmor, #49North, #Wellbeing, #VUCA)
- Clear CTA to mymentalarmor.com
- Professional image suggestions

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID), OpenAI API

---

## Webinar Management

### 12. createWebinarReminderEmail.js
**Purpose:** Creates automated webinar reminder email campaigns in Brevo

**Functionality:**
- Creates reminder emails at three intervals: 1 week, 1 day, 1 hour before webinar
- Builds HTML email with comprehensive webinar details
- Creates draft campaign in Brevo (not auto-sent)
- Tracks reminders in ReminderTracking tab

**Email Content Includes:**
- Webinar title, date, time
- What the session covers
- Why it matters
- Who should attend
- What attendees will learn
- Presenter bio
- Registration/join link
- Calendar reminder prompt

**Tracking Data:** reminderID, reminderType, targetID (webinarId), targetDate, status, draftCreatedDate, brevoEmailID, brevoDashboardLink, socialPostID, notes, createdBy, lastChecked

**Email Design:** Professional HTML template with 49 North branding, responsive design, clear CTAs

**Integration:** Google Sheets (WEBINAR_SHEET_ID, SOCIAL_MEDIA_SHEET_ID), Brevo API

---

### 10. createReminder.js
**Purpose:** Creates task reminders in the Secretary Tasks management system

**Functionality:**
- Supports Personal and CRM reminder types
- Priority-based notification frequency (code-red: 15 min, code-yellow: 60 min, code-green: 240 min, code-white: 480 min)
- Stores in Tasks sheet for notification processing
- Tracks due dates and recurrence

**Priority Levels:**
- **Code Red:** 15-minute intervals (urgent)
- **Code Yellow:** 60-minute intervals (important)
- **Code Green:** 240-minute intervals (normal)
- **Code White:** 480-minute intervals (low priority)

**Task Fields:** id, createdAt, createdBy, rawText, title, contactEmail, notes, dueAt, tz, recurrence, priority, status, lastNotifiedAt, notifyEveryMins

**Integration:** Google Sheets (SECRETARY_TASKS_SHEET_ID)

---

## AI & Analytics

### 19. getAIInsights.js
**Purpose:** Comprehensive AI-powered business intelligence analysis

**Functionality:**
- Aggregates data from 8+ data sources
- Generates executive summaries using OpenAI GPT-4
- Provides strategic recommendations
- Identifies opportunities and risks
- Analyzes trends across bid opportunities, webinars, contacts, and social media

**Data Sources Analyzed:**
1. **Bid Opportunities:** Active, Submitted, Disregarded
2. **Bid Systems:** Registered systems and admin notifications
3. **Webinars:** Attendance, registrations, survey responses
4. **Contact Leads:** Survey responses with contact requests
5. **News Articles:** Google News RSS (mental health training, resilience, government)
6. **Social Media:** Posts across platforms
7. **System Admin:** Notifications and alerts

**AI Analysis Components:**
- **Executive Summary:** High-level business overview
- **Top Priorities:** Urgent actions and opportunities
- **Bid Recommendations:** Which bids to pursue and why
- **System Insights:** Bid system performance and issues
- **Content Insights:** Best-performing webinar topics
- **News Opportunities:** Market trends and positioning
- **Risk Alerts:** Threats and concerns
- **Revival Candidates:** Disregarded bids worth reconsidering

**Performance Features:**
- Parallel data fetching with timeouts
- ETag caching (5-minute TTL)
- Graceful degradation if AI fails
- 30-second function timeout protection
- Returns data even if AI analysis unavailable

**Key Metrics Computed:**
- Bid urgency buckets (0-3 days, 4-7 days, 8-14 days, 15+ days, past due)
- Keyword distribution across bids
- Score distribution (0-5, 6-8, 9-14, 15-20)
- Webinar KPIs (attendance rates, registrations, presenter ratings)
- Contact lead scoring (contact requests, multi-webinar attendees, detailed comments)
- Disregarded bid analysis (reasons, revival candidates)

**Integration:** Google Sheets (multiple sheet IDs), OpenAI API (GPT-4), Google News RSS

---

## Utilities

### 13. debugHello.js
**Purpose:** Simple health check endpoint for testing connectivity

**Functionality:**
- Returns success status
- Provides current ISO timestamp
- Confirms function deployment

**Use Case:** Verify Netlify function deployment and API connectivity

---

### 15. deleteDocument.js
**Purpose:** Deletes company documents from Google Drive and tracking sheet

**Functionality:**
- Deletes file from Google Drive (if driveFileId provided)
- Removes tracking row from CompanyDocuments sheet
- Non-fatal if Drive file already deleted
- Validates row number (prevents header deletion)

**Two-Phase Deletion:**
1. Attempts Google Drive file deletion (soft-fail if already gone)
2. Removes sheet row using batchUpdate

**Integration:** Google Drive API, Google Sheets (COMPANY_DATA_SHEET_ID)

---

### 17. discoverSheets.js
**Purpose:** Development tool for discovering and documenting sheet structures

**Functionality:**
- Scans all configured Google Sheets
- Discovers tab names and column headers
- Provides sample data (truncated for security)
- Maps column letters to header names

**Sheets Scanned:**
- Main Sheet (Active_Bids, Submitted, Disregarded, Active_Admin)
- Bid Systems Sheet (various tab names)
- Webinar Sheet (Webinars, Registrations, Survey_Responses)
- Social Media Sheet (MainPostData, SocialMedia, Posts)
- Company Data Sheet (CompanyData, Data, Info)

**Security:** Only shows first 10 columns, 50 chars max per cell, 2 sample data rows

**Use Case:** Development and debugging - understand sheet structures without manual inspection

**Integration:** Google Sheets (all configured sheet IDs)

---

## System Architecture Overview

### Data Flow
```
External Sources → Netlify Functions → Google Sheets ←→ Brevo CRM
                                    ↓
                              OpenAI GPT-4
                                    ↓
                            AI-Powered Insights
```

### Key Technologies
- **Backend:** Node.js, Netlify Serverless Functions
- **Storage:** Google Sheets (primary database)
- **CRM:** Brevo (email marketing & contact management)
- **AI:** OpenAI GPT-4 (content generation & insights)
- **News:** Google News RSS
- **Authentication:** Optional app token, Google OAuth

### Environment Variables Required
- `GOOGLE_SHEET_ID` - Main bid tracking sheet
- `BID_SYSTEMS_SHEET_ID` - Bid systems registry
- `WEBINAR_SHEET_ID` - Webinar management
- `SOCIAL_MEDIA_SHEET_ID` - Social media content
- `COMPANY_DATA_SHEET_ID` - Company documents
- `CRM_SHEET_ID` - CRM contact notes and tasks
- `SECRETARY_TASKS_SHEET_ID` - Task reminders
- `BREVO_API_KEY` - Brevo CRM access
- `BREVO_LIST_ID` - Database master list ID (108)
- `OPENAI_API_KEY` - AI content generation
- `APP_TOKEN` - Optional security token

### Performance Optimizations
- **Caching:** 5-minute TTL with ETag support
- **Parallel Fetching:** Batch API calls with Promise.all
- **Timeouts:** Configurable timeouts prevent hanging
- **Graceful Degradation:** Returns data even if AI fails

---

## Next Steps
Awaiting Batch 2 (Functions 21-40) for complete documentation.

---

*Documentation generated for 49 North Command Center*  
*TechWerks, LLC - Service-Disabled Veteran-Owned Small Business (SDVOSB)*