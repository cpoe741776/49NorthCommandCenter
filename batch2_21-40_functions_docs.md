# 49 North Command Center - Function Documentation
## Batch 2 of 4 (Functions 21-40)

**Company:** 49 North, a division of TechWerks, LLC  
**System:** Integrated Business Management Platform  
**Documentation Date:** January 8, 2026

---

## Table of Contents - Batch 2
1. [AI-Powered Analytics (Specialized)](#ai-powered-analytics-specialized)
2. [Data Retrieval - Core Business](#data-retrieval---core-business)
3. [Contact & CRM Management](#contact--crm-management)
4. [Dashboard & Real-Time Data](#dashboard--real-time-data)
5. [Configuration & Settings](#configuration--settings)
6. [Content Management](#content-management)

---

## AI-Powered Analytics (Specialized)

### 21. getBidsAnalysis.js
**Purpose:** AI-powered analysis focused exclusively on bid opportunities

**Functionality:**
- Analyzes active, submitted, and disregarded bids
- Uses OpenAI GPT-4 for strategic insights
- Calculates keyword distributions and score distributions
- Identifies priority bids and agencies

**AI Insights Provided:**
- Executive summary of bid pipeline health
- Top priorities with urgency levels
- Specific bid recommendations with reasoning
- Risk alerts for potential problems

**Analysis Focus:**
- High-scoring bids with "Respond" recommendations
- Upcoming deadlines (within 7 days)
- Keyword trends and market opportunities
- System performance issues

**Performance:** 
- Timeout: 20 seconds for OpenAI
- Graceful degradation if AI unavailable
- Returns raw data even without AI insights

**Integration:** Google Sheets (GOOGLE_SHEET_ID), OpenAI API

---

### 37. getNewsAnalysis.js
**Purpose:** Fetches relevant industry news for market intelligence

**Functionality:**
- Searches Google News RSS for mental health/resilience topics
- Filters by US market (hl=en-US&gl=US)
- Deduplicates articles by link/title
- Returns last 90 days of coverage

**Search Query Coverage:**
- Corporate/workplace mental health
- First responder mental health (police, fire, EMS)
- Military/veteran mental health
- School/university mental health
- City/county/state/federal mental health programs

**Data Returned:**
- Article title, link, published date, source
- Days since publication
- Total and recent article counts

**Performance:**
- Timeout: 8 seconds for news fetch
- Caches results for efficiency
- Returns empty array on failure (non-blocking)

**Use Case:** Market research, opportunity identification, competitive intelligence

**Integration:** Google News RSS API

---

### 39. getSocialAnalysis.js
**Purpose:** AI-powered analysis of social media content and performance

**Functionality:**
- Analyzes published, scheduled, and draft posts
- Platform-specific performance analysis
- Content type effectiveness tracking
- Publishing schedule optimization

**AI Insights Provided:**
- Executive summary of social media performance
- Top priorities for social media strategy
- Content optimization suggestions
- Platform-specific recommendations

**Metrics Analyzed:**
- Platform distribution (LinkedIn, Facebook, WordPress, Brevo)
- Content type performance
- Publishing frequency and timing
- Tag/topic popularity

**Performance:**
- Timeout: 20 seconds for OpenAI
- 6 seconds for Google Sheets fetch
- Returns basic metrics if AI unavailable

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID), OpenAI API

---

## Data Retrieval - Core Business

### 22. getBidSystems.js
**Purpose:** Retrieves registered bid tracking systems from central registry

**Functionality:**
- Fetches all bid systems (A2:U - 21 columns)
- Normalizes URLs (adds https:// if missing)
- Filters out rows without system names
- Groups by category and status

**System Data (21 fields):**
- System ID, Name, Category, Status
- Website URL, Login URL, Credentials (username/password)
- Registration & Last Login dates
- Email Alerts configuration
- Code Type & Numbers (NEW fields)
- Geographic Coverage
- Subscription details (type, renewal, cost)
- Notes, Date Added, Last Updated

**Categories Tracked:**
- International
- US State
- Local/County
- Private/Commercial
- US Federal
- US Territory

**Summary Statistics:**
- Total systems
- Active systems
- Pending registration
- Count by category

**Caching:** 60-second CDN cache

**Integration:** Google Sheets (BID_SYSTEMS_SHEET_ID)

---

### 24. getCommodityCodes.js
**Purpose:** Retrieves commodity classification codes for proposals

**Functionality:**
- Fetches codes from Commodity_Codes tab (A2:G)
- Supports filtering by code type, active status, search query
- Groups codes by type for easy access

**Code Types Supported:**
- **NAICS** - North American Industry Classification System
- **NIGP** - National Institute of Governmental Purchasing
- **PSC** - Product Service Code (Federal)
- **UNSPSC** - United Nations Standard Products and Services Code
- **CPV** - Common Procurement Vocabulary (EU)
- **FSC** - Federal Supply Classification
- **SIC** - Standard Industrial Classification

**Fields per Code:**
- Code Type, Code Number, Description
- Category, Priority (Primary/Secondary)
- Active status, Notes

**Query Parameters:**
- `type` - Filter by code type (e.g., NAICS)
- `active` - Filter by active status (yes/no)
- `q` - Full-text search across fields

**Integration:** Google Sheets (COMPANY_DATA_SHEET_ID)

---

### 25. getCompanyData.js
**Purpose:** Retrieves company information from centralized data vault

**Functionality:**
- Fetches from CompanyDataVault tab (A2:H)
- Groups data by category for organized access
- Includes metadata (last updated, verified status)

**Data Fields:**
- Field ID (unique identifier)
- Category (grouping)
- Field Name, Field Value
- Alternate Value
- Last Updated, Verified status
- Notes

**Use Cases:**
- Proposal generation (pull company facts)
- RFP responses (verified company data)
- Marketing materials (consistent information)
- Compliance documentation

**Categories Examples:**
- Company Information
- Certifications
- Past Performance
- Capabilities
- Contact Information

**Integration:** Google Sheets (COMPANY_DATA_SHEET_ID)

---

### 26. getCompanyDocuments.js
**Purpose:** Retrieves company documents from Google Drive with tracking

**Functionality:**
- Fetches document metadata from CompanyDocuments tab (A2:H)
- Generates Drive preview links
- Groups documents by category
- Returns both grouped and flat lists

**Document Metadata (8 fields):**
- Document ID (row number for deletion)
- Category (Contracts, Proposals, Certifications, etc.)
- Document Name, File Type
- Upload Date, Drive File ID
- File Size, Notes
- Drive Link (auto-generated)

**Response Structure:**
```javascript
{
  success: true,
  grouped: { 
    "Certifications": [...],
    "Proposals": [...],
    "Contracts": [...]
  },
  flat: [all documents]
}
```

**Integration:** Google Sheets (COMPANY_DATA_SHEET_ID), Google Drive (read-only links)

---

### 32. getDisregardedEmails.js
**Purpose:** Retrieves emails that were disregarded by the AI screening system

**Functionality:**
- Fetches from Disregarded tab (A2:U - 21 columns)
- Optional search filtering (subject, from, system, entity, keywords)
- Optional limit for pagination
- Sorted by date (newest first)

**Use Cases:**
- Quality assurance (check AI decisions)
- Revival candidates (reconsidering disregarded bids)
- Pattern analysis (why emails are disregarded)
- Training data for AI improvement

**Data Structure:** Same as Active_Bids (21 columns with recommendation, reasoning, etc.)

**Query Parameters:**
- `q` - Search term (searches multiple fields)
- `limit` - Number of results to return

**Integration:** Google Sheets (GOOGLE_SHEET_ID)

---

### 36. getMentalArmorSkills.js
**Purpose:** Fetches Mental Armor™ skills database for content generation

**Functionality:**
- Retrieves skills from MentalArmorSkills tab (A:G)
- Caches for 30 minutes to reduce API calls
- Validates tab existence and provides helpful errors

**Skills Data (7 fields):**
- Skill Title
- Benefits (what it provides)
- When (when to use this skill)
- How (how to apply the skill)
- Researcher (who researched this)
- Research Bullet (key research finding)
- Goal (what this skill achieves)

**Skills Examples:**
- Foundations of Resilience
- Flex Your Strengths
- Values Based Living
- Spiritual Resilience
- Cultivate Gratitude
- Mindfulness
- ReFrame
- Balance Your Thinking
- Interpersonal Problem Solving

**Use Case:** Weekly social media content generation (generateWeeklyContent.js)

**Error Handling:** 
- Returns available tabs if MentalArmorSkills not found
- Provides guidance for creating the tab

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID)

---

### 40. getSocialMediaContent.js
**Purpose:** Retrieves social media posts from content management system

**Functionality:**
- Fetches from MainPostData tab (A2:U - 21 columns)
- Caches for 3 minutes
- Optional status filtering (Published, Scheduled, Draft)
- Optional limit for pagination

**Post Data (21 columns):**
- Timestamp, Status, Content Type, Title, Body
- Image URL, Video URL, Platforms
- Schedule Date, Published Date, Post Permalink
- Platform IDs (Facebook, LinkedIn, WordPress, Brevo)
- Analytics, Created By, Tags
- Purpose (weekly-monday, webinar-1week, etc.)
- Webinar ID, Webinar Title

**Query Parameters:**
- `status` - Filter by status (published/scheduled/draft)
- `limit` - Number of posts to return

**Summary Statistics:**
- Total posts, Published, Scheduled, Drafts

**Sorting:** By timestamp descending (newest first)

**Integration:** Google Sheets (SOCIAL_MEDIA_SHEET_ID)

---

## Contact & CRM Management

### 23. getBrevoSegments.js
**Purpose:** Fetches Brevo email segments and lists for audience targeting

**Functionality:**
- Retrieves all lists from Brevo (limit: 50)
- Retrieves all segments from Brevo (limit: 50)
- Excludes DATABASE MASTER list (internal full list)
- Combines and categorizes by type

**Segment Types:**
- **Lists** (static): Manually managed, known subscriber count
- **Segments** (dynamic): Query-based, count shown as "?" (calculated on use)

**Use Cases:**
- Bulk email campaigns
- Targeted webinar invitations
- Newsletter distribution
- List-specific content

**Response Structure:**
```javascript
{
  success: true,
  segments: [
    { id, name, totalContacts, type: 'list' },
    { id, name, totalContacts: '?', type: 'segment', categoryName }
  ],
  count
}
```

**Integration:** Brevo API

---

### 28. getContactDetail.js
**Purpose:** Comprehensive contact profile with full activity history

**Functionality:**
- Fetches contact from Brevo (48+ attributes)
- Enriches with webinar history (registrations + attendance)
- Includes survey responses
- Shows CRM notes and follow-up tasks
- Email activity tracking (placeholder for future)

**Contact Data:**
- **Basic:** Name, email, phone, organization, job title
- **Location:** City, state, country, zip, county
- **Organization:** Type, size, address
- **Webinar:** IDs, topics, attendance count
- **Engagement:** Survey contact requests, sourced from
- **Tags:** Custom tags, list memberships
- **Status:** Email/SMS blacklist status
- **Metadata:** Created at, modified at, last changed

**Webinar History:**
- Webinar title, date, time
- Registration date
- Attendance status
- Join time, duration

**Survey Responses:**
- Timestamp, webinar ID
- Relevance rating, presenter ratings
- Challenges, additional topics
- Contact request status

**Notes & Tasks:**
- All notes with timestamps
- Open follow-up tasks with due dates
- Sorted by relevance

**Integration:** Brevo API, Google Sheets (CRM_SHEET_ID, WEBINAR_SHEET_ID)

---

### 29. getContacts.js
**Purpose:** Unified contact list with lead scoring and multi-source enrichment

**Functionality:**
- Fetches contacts from Brevo (supports pagination, filtering, search)
- Enriches with Google Sheets metadata (notes, tasks, lead scoring)
- Calculates lead status (Hot Lead, Warm, Cold)
- Supports segment/list loading
- Global statistics calculation

**Query Parameters:**
- `limit` - Number of contacts (default: 100)
- `offset` - Pagination offset
- `filter` - hot-leads | webinar-attendees | cold-leads
- `search` - General search across email/name/org
- **Field-Specific Search:**
  - `firstName`, `lastName`, `email`
  - `organization`, `state`, `country`, `customTag`
- `segmentId` - Load specific segment/list
- `summaryOnly=true` - Return stats only (fast)

**Lead Scoring Algorithm:**
- **Hot Lead (100+ points):** 
  - Requested immediate contact: +100
  - 2+ webinars attended: automatic Hot Lead
- **Warm Lead (30+ points):**
  - 1 webinar attended: +15
  - Requested 3-month reminder: +30
  - Completed survey: +25
  - Attended webinar: +10
- **Cold Lead:** <30 points

**Multi-Page Search:**
- Fetches up to 15 pages (15,000 contacts) for field-specific searches
- Brevo's limit: 1,000 per request
- Ensures comprehensive search results

**Global Statistics:**
- Samples 5,000 contacts (5 pages)
- Extrapolates to total if 28,000+ contacts
- Returns: hotLeads, webinarAttendees, coldContacts, warmLeads

**Caching:**
- 5-minute TTL for unfiltered requests
- Bypassed for searches/filters

**Performance:**
- Summary-only mode: <1 second
- Full contact list: 2-5 seconds
- Field search: 10-30 seconds (multi-page)

**Integration:** Brevo API, Google Sheets (CRM_SHEET_ID, WEBINAR_SHEET_ID)

---

### 30. getCustomTags.js
**Purpose:** Extracts unique custom tags from Brevo for filtering/searching

**Functionality:**
- Samples first 5,000 contacts (5 pages)
- Extracts CUSTOM_TAG attribute values
- Handles comma-separated tags
- Sorts alphabetically

**Use Cases:**
- Tag-based filtering in contact search
- Dropdown options for tag selection
- Tag analytics and distribution

**Caching:** 15 minutes (tags don't change frequently)

**Performance:** Fetches 5 pages × 1,000 contacts = 5,000 contacts sampled

**Response:**
```javascript
{
  success: true,
  tags: ['Federal', 'Law Enforcement', 'Healthcare', ...],
  count: 47,
  cached: false
}
```

**Integration:** Brevo API

---

## Dashboard & Real-Time Data

### 27. getComprehensiveTicker.js
**Purpose:** Real-time aggregated metrics for dashboard ticker display

**Functionality:**
- Fetches data from ALL sources in parallel
- Returns comprehensive metrics for live dashboard updates
- Handles failures gracefully (shows 0 if source unavailable)

**Data Sources (8):**
1. **Bids Data:** Active bids count, recent disregarded, priority bids
2. **Webinar Data:** Upcoming webinars, registrations, survey contacts
3. **Social Media:** Recent posts, scheduled count, weekly stats
4. **Bid Systems:** Active systems, recent changes
5. **News:** Relevant articles (via getNewsAnalysis)
6. **Reminders:** Overdue emails, missing posts, pending reminders

**Critical Column Mappings (Fixed):**
- **Active_Bids:** A=Recommendation, J=Subject, M=Due Date
- **Submitted:** I=Subject, L=Due Date, U=Submission Date
- **Disregarded:** J=Subject, T=Date Added
- **Webinars:** A=ID, B=Title, C=Date, D=Time
- **Registrations:** D=Email
- **Surveys:** J=Contact Request

**Performance Features:**
- Parallel fetching with Promise.all
- 8-second timeout per source
- Non-blocking failures (returns 0 for failed sources)
- Extensive logging for debugging

**Use Case:** Live dashboard ticker showing real-time business metrics

**Response Structure:**
```javascript
{
  activeBidsCount, recentDisregardedCount, priorityBids,
  upcomingWebinars, upcomingWebinarRegistrations, recentWebinarRegistrations,
  surveyContactsToContact,
  recentSocialPosts, scheduledSocialCount, socialThisWeek, socialThisMonth,
  activeBidSystemsCount, recentBidSystemChanges,
  newsArticles,
  overdueWebinarEmails, missingSocialPosts, pendingReminders,
  timestamp
}
```

**Integration:** All sheet IDs, multiple endpoints

---

### 31. getDashboardData.js
**Purpose:** Fast KPIs for dashboard - optimized for speed with caching

**Functionality:**
- Minimal data fetching (counts only, no details)
- 5-minute cache with ETag support
- Returns only summary statistics

**KPIs Provided:**
- Admin emails (total, new)
- Active bids (total, respond count, gather info count)
- Webinars (completed, total)
- Social posts (total, published, drafts)
- Hot leads count (from survey analysis)

**Performance:**
- Cache hit: <50ms (304 Not Modified)
- Cache miss: ~2 seconds (fetch + calculate)
- ETag validation for bandwidth optimization

**Hot Leads Calculation:**
- Analyzes survey responses
- Counts contacts who:
  - Requested immediate meeting (🟢 🌟)
  - Requested 3-month reminder (🟢)
  - Attended 2+ webinars

**Cache Invalidation:**
- Add `?t=1` to bypass cache
- Auto-expires after 5 minutes

**Integration:** Google Sheets (GOOGLE_SHEET_ID, WEBINAR_SHEET_ID, SOCIAL_MEDIA_SHEET_ID)

---

### 38. getReminders.js
**Purpose:** Tracks webinar email reminders and weekly social post schedule

**Functionality:**
- Monitors webinar reminder emails (1 week, 1 day, 1 hour)
- Tracks webinar social posts (1 week, 1 day, 1 hour)
- Monitors weekly social posts (Monday, Wednesday, Friday)
- Optional: Executive Assistant tasks (via query param)

**Webinar Reminders (per webinar):**
- **Email Reminders:** Brevo campaign status, dashboard links
- **Social Reminders:** Post status (pending, posted, overdue)
- **Timing:** 1 week, 1 day, 1 hour before webinar
- **Status:** pending, draft-created, sent, posted, overdue

**Weekly Social Posts:**
- **Monday:** Resilience Skill Spotlight (purpose: weekly-monday)
- **Wednesday:** Follow-up & Deeper Dive (purpose: weekly-wednesday)
- **Friday:** Call to Action (purpose: weekly-friday)
- **Status:** upcoming, posted, missing (overdue)

**Reminder Tracking:**
- Stored in ReminderTracking tab (A2:L)
- Links to Brevo campaigns (email ID, dashboard link)
- Links to social posts (post ID)

**Executive Tasks (Optional):**
- Add `?includeExecutiveTasks=1` to include tasks from Secretary Tasks sheet
- Returns open tasks with priorities (code-red, code-yellow, code-green, code-white)
- Not cached (always fresh)

**Caching:**
- 5 minutes for standard webinar/social reminders
- Bypassed when includeExecutiveTasks=1

**Summary Stats:**
- Total webinar reminders pending
- Overdue webinar emails
- Overdue webinar social posts
- Missing weekly social posts (array)
- Upcoming weekly social posts (array)
- Total pending count

**Integration:** Google Sheets (WEBINAR_SHEET_ID, SOCIAL_MEDIA_SHEET_ID, SECRETARY_TASKS_SHEET_ID)

---

## Configuration & Settings

### 33. getExecutiveAssistantSettings.js
**Purpose:** Retrieves Executive Assistant quiet hours configuration

**Functionality:**
- Reads ExecutiveAssistant_Settings tab (A:B)
- Returns quiet hours settings for notification management
- Creates default settings if tab doesn't exist

**Settings:**
- **quietHoursEnabled:** "true" | "false"
- **quietStart:** "21:00" (9 PM)
- **quietEnd:** "08:00" (8 AM)
- **quietTimeZone:** "Europe/London" (user's timezone)
- **quietMode:** "silent" | "suppress"
  - **silent:** Hold notifications, deliver after quiet hours
  - **suppress:** Skip notifications entirely during quiet hours

**Use Case:** Prevents notification spam during off-hours for executive assistant reminders

**Default Values:** Quiet hours enabled 21:00-08:00 Europe/London in silent mode

**Integration:** Google Sheets (SECRETARY_TASKS_SHEET_ID)

---

### 34. getLinkedInOrgId.js
**Purpose:** Development helper to find LinkedIn Organization URN for API integration

**Functionality:**
- Fetches organizations where user has admin access
- Displays organization URNs in HTML interface
- Provides copy-to-clipboard functionality
- Instructions for adding to Netlify environment variables

**Use Case:**
- Initial LinkedIn integration setup
- Finding correct organization URN for posting
- Troubleshooting LinkedIn API configuration

**Requirements:** LINKEDIN_ACCESS_TOKEN must be configured

**Response:** HTML page with organization list and copy buttons

**Integration:** LinkedIn API (organizationalEntityAcls endpoint)

---

### 35. getMaintenanceStatus.js
**Purpose:** Reports status of all automated maintenance tasks

**Functionality:**
- Checks items ready for archiving
- Monitors token health
- Reports cache status
- Tracks performance metrics

**Maintenance Checks:**
1. **Disregarded Emails:** Count older than 90 days ready for archiving
2. **Social Posts:** Published posts older than 180 days
3. **Old Drafts:** Social drafts older than 30 days
4. **Orphaned Reminders:** Webinar reminders for deleted webinars
5. **Duplicate Webinars:** (handled by deduplication in getWebinars)

**Token Health:**
- LinkedIn (60-day expiration)
- Facebook (never expires if configured correctly)
- Google (service account - always valid)
- Brevo (API key - no expiration)
- WordPress (application password - no expiration)

**Performance Metrics:**
- API quota usage (%)
- Cache hit rate (%)
- Average execution time (ms)
- Error rate (%)

**Cache Status:**
- Reminders cache age
- Webinars cache age
- Social posts cache age

**Recommendations:**
- Next recommended run date (7 days from now)
- Which tasks need attention

**Integration:** Google Sheets (GOOGLE_SHEET_ID, SOCIAL_MEDIA_SHEET_ID, WEBINAR_SHEET_ID)

---

## Content Management

*No dedicated content management functions in this batch - covered in other sections.*

---

## Key Architecture Patterns

### Multi-Source Data Enrichment
Functions like `getContacts.js` and `getContactDetail.js` demonstrate the pattern:
1. Fetch primary data from Brevo (API)
2. Enrich with Google Sheets metadata (notes, tasks, scoring)
3. Calculate derived metrics (lead scoring)
4. Return unified view

### Intelligent Caching Strategy
Different TTLs based on data volatility:
- **5 minutes:** Bids, contacts, reminders (medium volatility)
- **3 minutes:** Social posts (high volatility)
- **30 minutes:** Skills data (low volatility)
- **15 minutes:** Custom tags (low volatility)

### Graceful Degradation
All functions handle failures gracefully:
- Returns partial data if some sources fail
- Shows 0 counts instead of errors
- Continues processing even if AI unavailable
- Logs warnings but doesn't block responses

### Performance Optimization
- Parallel fetching with Promise.all
- Configurable timeouts (6-8 seconds typical)
- ETag support for bandwidth savings
- Pagination support for large datasets

---

## Integration Map - Batch 2

### Google Sheets Dependencies
- **GOOGLE_SHEET_ID:** getBidsAnalysis, getDashboardData, getDisregardedEmails, getComprehensiveTicker
- **BID_SYSTEMS_SHEET_ID:** getBidSystems
- **COMPANY_DATA_SHEET_ID:** getCommodityCodes, getCompanyData, getCompanyDocuments
- **SOCIAL_MEDIA_SHEET_ID:** getSocialAnalysis, getSocialMediaContent, getMentalArmorSkills, getComprehensiveTicker, getReminders, getMaintenanceStatus
- **WEBINAR_SHEET_ID:** getContactDetail, getContacts, getDashboardData, getComprehensiveTicker, getReminders, getMaintenanceStatus
- **CRM_SHEET_ID:** getContactDetail, getContacts
- **SECRETARY_TASKS_SHEET_ID:** getExecutiveAssistantSettings, getReminders

### External APIs
- **Brevo API:** getBrevoSegments, getContactDetail, getContacts, getCustomTags
- **OpenAI API:** getBidsAnalysis, getSocialAnalysis
- **Google News RSS:** getNewsAnalysis
- **LinkedIn API:** getLinkedInOrgId

---

## Summary Statistics - Batch 2

**Total Functions:** 20  
**AI-Powered:** 3 (getBidsAnalysis, getSocialAnalysis, [getNewsAnalysis removed AI])  
**Data Retrieval:** 10  
**Contact/CRM:** 5  
**Dashboard/Real-Time:** 3  
**Configuration:** 3  

**Performance Characteristics:**
- Fastest: getDashboardData (cached: <50ms)
- Average: 2-5 seconds
- Slowest: getContacts (with field search: 10-30 seconds)

**Caching Coverage:** 12 of 20 functions implement caching

---

## Next Steps
Awaiting Batch 3 (Functions 41-60) for complete documentation.

---

*Documentation generated for 49 North Command Center*  
*TechWerks, LLC - Service-Disabled Veteran-Owned Small Business (SDVOSB)*