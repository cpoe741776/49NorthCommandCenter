# Contact CRM Section - Design Plan

## 🎯 **Overview**

A comprehensive Contact Relationship Management (CRM) section that aggregates contact data from multiple sources and uses Brevo as the master repository.

---

## 📊 **Data Sources**

### **1. Webinar System (Google Sheets)**
- **Registrations Tab**: Name, Email, Organization, Phone
- **Attendance Tab**: Participant Name, Email, Join/Leave times, Duration
- **Survey_Responses Tab**: Email, Feedback, Contact preferences (Column J: "Yes" to contact)

### **2. Brevo (Master CRM)**
- **Contact List**: 28,000+ contacts
- **Fields**: Email, Name, Attributes (custom fields)
- **Lists/Segments**: Organization, interests, engagement
- **Activity**: Email opens, clicks, opt-outs
- **Tags**: Categorization

### **3. Social Media (Future)**
- LinkedIn connections
- Facebook page followers
- Engagement data

---

## 🎨 **UI Design**

### **CRM Dashboard (Overview)**

```
┌─────────────────────────────────────────────────┐
│  👥 Contact Relationship Manager                │
│  Unified view of all contacts across platforms  │
│                                                  │
│  [🔍 Search]  [Filter ▼]  [+ Add Contact]      │
│  [↻ Sync from Webinars]  [↻ Sync from Brevo]   │
└─────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total        │ │ Webinar      │ │ Hot Leads    │
│ Contacts     │ │ Registrants  │ │ (Survey Yes) │
│ 28,347       │ │ 1,234        │ │ 45           │
└──────────────┘ └──────────────┘ └──────────────┘

┌─────────────────────────────────────────────────┐
│ 📋 Contact List                                 │
│                                                  │
│ Filters: [All ▼] [Engagement ▼] [Source ▼]     │
│ Sort by: [Last Activity ▼]                      │
│                                                  │
│ ┌───────────────────────────────────────────┐  │
│ │ ✉️ john.doe@agency.gov                    │  │
│ │ John Doe | Federal Agency                 │  │
│ │ 🎥 3 webinars | 📊 Survey: Yes | ⭐ Hot   │  │
│ │ Last activity: Oct 15, 2025               │  │
│ └───────────────────────────────────────────┘  │
│ ... (more contacts)                             │
└─────────────────────────────────────────────────┘
```

---

### **Contact Detail Modal**

```
┌─────────────────────────────────────────────────┐
│  👤 John Doe                          [✕ Close] │
│  john.doe@agency.gov                            │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ 📝 Contact Information                  │   │
│  │ Name: John Doe                          │   │
│  │ Email: john.doe@agency.gov              │   │
│  │ Organization: Federal Agency            │   │
│  │ Phone: (555) 123-4567                   │   │
│  │ Source: Webinar Registration            │   │
│  │ Status: Hot Lead                        │   │
│  │ Tags: Federal, Training, Resilience     │   │
│  │                            [Edit Info]  │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ 🎥 Webinar Activity (3 total)           │   │
│  │ • Oct 30, 2025 - Registered, Attended   │   │
│  │ • Sep 15, 2025 - Registered, No-show    │   │
│  │ • Aug 5, 2025 - Registered, Attended    │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ 📊 Survey Responses                     │   │
│  │ • Oct 30: "Highly relevant" - YES       │   │
│  │   Contact for follow-up ✅              │   │
│  │ • Aug 5: "Somewhat relevant"            │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ 📧 Email Activity (Brevo)               │   │
│  │ • Oct 1: Opened "Resilience Workshop"   │   │
│  │ • Sep 20: Clicked "Register Now"        │   │
│  │ • Sep 10: Opened "Monthly Newsletter"   │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ 💬 Notes & Actions                      │   │
│  │ [+ Add Note]                            │   │
│  │ • Oct 15: Called - interested in Q1     │   │
│  │ • Sep 20: Follow up in 2 weeks          │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  [📧 Send Email] [🏷️ Add Tags] [🗑️ Delete]    │
└─────────────────────────────────────────────────┘
```

---

## 🔄 **Data Flow**

### **Sync Process:**

1. **Webinar → Brevo Sync**
   - Fetch all registrations, attendance, surveys
   - For each unique email:
     - Check if exists in Brevo
     - If yes: Update attributes (webinar count, last attendance, survey status)
     - If no: Create new contact in Brevo
   - Add tags: "Webinar Attendee", "Survey Responder", etc.

2. **Brevo as Source of Truth**
   - All contact data stored in Brevo
   - Custom attributes: `webinar_count`, `last_webinar_date`, `survey_contact`, `organization`, `phone`
   - Leverage Brevo's segmentation and list management
   - Use Brevo API for CRUD operations

3. **Display in CRM**
   - Fetch contacts from Brevo API
   - Enrich with webinar activity from Google Sheets
   - Show unified view
   - Allow inline editing

---

## 🛠️ **Features**

### **Contact List View:**
- ✅ Search by name, email, organization
- ✅ Filter by source (webinar, manual, imported)
- ✅ Filter by status (hot lead, contacted, cold)
- ✅ Filter by tags
- ✅ Sort by last activity, name, webinar count
- ✅ Pagination (100 per page)
- ✅ Export to CSV

### **Contact Detail:**
- ✅ Full contact information
- ✅ Webinar history (registrations, attendance, no-shows)
- ✅ Survey responses with sentiment
- ✅ Email activity (Brevo stats)
- ✅ Notes and follow-up tasks
- ✅ Edit contact info
- ✅ Add/remove tags
- ✅ Send direct email

### **Bulk Actions:**
- ✅ Add to Brevo list/segment
- ✅ Tag multiple contacts
- ✅ Export selection to CSV
- ✅ Send bulk email campaign

### **Analytics:**
- ✅ Engagement score (webinar attendance + email opens)
- ✅ Hot leads (survey "Yes" + multiple webinars)
- ✅ Cold contacts (no activity in 90 days)
- ✅ Conversion funnel (registration → attendance → survey)

---

## 📋 **Backend Functions**

### **1. `getContacts.js`**
```javascript
GET /.netlify/functions/getContacts?limit=100&offset=0&filter=hot-leads
Response: {
  contacts: [{
    email, name, organization, phone,
    webinarCount, lastWebinarDate,
    surveyResponses, emailActivity,
    tags, lists, engagementScore,
    source, status, createdAt, updatedAt
  }],
  total: 28347,
  summary: { hotLeads: 45, totalWebinarAttendees: 1234, ... }
}
```

### **2. `getContactDetail.js`**
```javascript
GET /.netlify/functions/getContactDetail?email=john@agency.gov
Response: {
  contact: { ... },
  webinarHistory: [...],
  surveyResponses: [...],
  emailActivity: [...],
  notes: [...]
}
```

### **3. `syncWebinarContactsToBrevo.js`**
```javascript
POST /.netlify/functions/syncWebinarContactsToBrevo
Response: {
  synced: 234,
  created: 45,
  updated: 189,
  errors: 0
}
```

### **4. `updateContact.js`**
```javascript
PUT /.netlify/functions/updateContact
Body: { email, name, organization, phone, tags, notes }
Response: { success: true, contact: {...} }
```

### **5. `deleteContact.js`**
```javascript
DELETE /.netlify/functions/deleteContact?email=john@agency.gov
Response: { success: true, message: 'Contact removed from Brevo' }
```

### **6. `addContactNote.js`**
```javascript
POST /.netlify/functions/addContactNote
Body: { email, note, followUpDate }
Response: { success: true }
```

### **7. `sendContactEmail.js`**
```javascript
POST /.netlify/functions/sendContactEmail
Body: { email, subject, body, templateId }
Response: { success: true, brevoEmailId: '123' }
```

---

## 🗄️ **Data Schema**

### **Brevo Contact Attributes:**

| Attribute | Type | Source | Example |
|-----------|------|--------|---------|
| `EMAIL` | String | Primary key | `john@agency.gov` |
| `FIRSTNAME` | String | Webinar/Manual | `John` |
| `LASTNAME` | String | Webinar/Manual | `Doe` |
| `ORGANIZATION` | String | Webinar | `Federal Agency` |
| `PHONE` | String | Webinar | `555-123-4567` |
| `WEBINAR_COUNT` | Number | Calculated | `3` |
| `LAST_WEBINAR_DATE` | Date | Webinar | `2025-10-30` |
| `ATTENDED_COUNT` | Number | Calculated | `2` |
| `SURVEY_CONTACT` | Boolean | Survey | `true` |
| `LEAD_STATUS` | String | Calculated | `hot`, `warm`, `cold` |
| `SOURCE` | String | First touch | `webinar`, `manual`, `import` |
| `CREATED_DATE` | Date | Auto | `2025-01-15` |
| `LAST_ACTIVITY` | Date | Calculated | `2025-10-15` |

### **Contact Notes (Google Sheet or Brevo)**

| Column | Field | Example |
|--------|-------|---------|
| A | Email | `john@agency.gov` |
| B | Note | `Called - interested in Q1 training` |
| C | Created By | `user@49north.com` |
| D | Created Date | `2025-10-15T10:30:00Z` |
| E | Follow Up Date | `2025-11-01` |
| F | Status | `open`, `completed` |

---

## 🎯 **Lead Scoring**

### **Hot Lead Criteria:**
- ✅ Attended 2+ webinars
- ✅ Survey response: "Yes, contact me"
- ✅ Opened 3+ emails in last 30 days
- ✅ Clicked registration link

### **Warm Lead:**
- Registered for webinar but didn't attend
- Opened emails but no clicks
- Survey response: neutral

### **Cold Lead:**
- No activity in 90+ days
- Email bounces
- Unsubscribed

---

## 📱 **Integration Points**

### **Dashboard:**
- "Hot Leads" card (count + click to CRM)
- "Contact Activity" summary

### **Webinar Operations:**
- "View Contact" button on registration rows
- Opens CRM with contact detail

### **Social Media:**
- When sending campaigns, filter by CRM segments
- Track who received which campaigns

### **Reminders:**
- Contact follow-up reminders (from survey "Yes")
- Integration with existing reminder system

---

## 🚀 **Implementation Phases**

### **Phase 1: Core CRM (MVP)**
- Contact list view with search/filter
- Sync webinar contacts to Brevo
- Contact detail modal
- Basic CRUD operations

### **Phase 2: Enhanced Features**
- Lead scoring and hot lead detection
- Email activity tracking
- Notes and follow-up system
- Bulk actions

### **Phase 3: Advanced**
- Engagement analytics
- Conversion tracking
- Automated workflows
- Contact timeline view

---

## 💡 **Key Features**

### **1. Unified Contact View**
- See all activity in one place
- No switching between Brevo, Google Sheets, etc.

### **2. Intelligent Sync**
- Automatic webinar → Brevo sync
- Deduplication by email
- Merge duplicate contacts

### **3. Hot Lead Pipeline**
- Automatically identify high-value contacts
- Follow-up reminders
- Conversion tracking

### **4. Email Integration**
- Send direct emails from contact detail
- Track opens/clicks
- Template library

### **5. Notes & Tasks**
- Add notes to any contact
- Set follow-up reminders
- Track contact history

---

## 🔌 **Brevo API Endpoints**

### **Contacts:**
- `GET /contacts` - List all contacts
- `GET /contacts/{email}` - Get contact details
- `POST /contacts` - Create contact
- `PUT /contacts/{email}` - Update contact
- `DELETE /contacts/{email}` - Delete contact

### **Lists:**
- `GET /contacts/lists` - Get all lists
- `POST /contacts/lists/{listId}/contacts/add` - Add to list
- `POST /contacts/lists/{listId}/contacts/remove` - Remove from list

### **Activity:**
- `GET /emailCampaigns/{campaignId}/statistics` - Email stats
- `GET /contacts/{email}/campaignStats` - Contact email activity

---

## 📦 **Required Environment Variables**

Already have:
- ✅ `BREVO_API_KEY`
- ✅ `BREVO_LIST_ID`
- ✅ `BREVO_SENDER_EMAIL`
- ✅ `WEBINAR_SHEET_ID`

---

## 🎊 **Benefits**

### **Before (Current State):**
- ❌ Contact data scattered (Sheets, Brevo, manual lists)
- ❌ No unified view
- ❌ Manual follow-up tracking
- ❌ Hard to identify hot leads

### **After (With CRM):**
- ✅ Single source of truth (Brevo)
- ✅ All activity in one place
- ✅ Automated lead scoring
- ✅ Follow-up reminders
- ✅ Easy segmentation
- ✅ Direct email from CRM
- ✅ Export and reporting

---

## 🤔 **Questions for You:**

1. **Do you want to build this?** (This is a substantial feature - probably 15-20 functions + UI)

2. **What's the priority?**
   - **High**: Build after current reminder/maintenance work
   - **Medium**: Build in next phase
   - **Low**: Future enhancement

3. **Custom Fields in Brevo:**
   - Do you already have custom attributes set up in Brevo?
   - Or should I include API calls to create them?

4. **Notes Storage:**
   - Store notes in Brevo (as attributes)?
   - Or separate Google Sheet tab (`ContactNotes`)?

5. **Lead Scoring:**
   - Use my suggested criteria?
   - Or custom scoring logic?

---

## 🎯 **My Recommendation:**

**Build Phase 1 (MVP)** with:
- Contact list with search/filter
- Sync webinar contacts to Brevo
- Contact detail view
- Basic edit capability
- Hot lead identification (survey "Yes")

**Later add:**
- Notes system
- Email sending
- Advanced analytics
- Bulk operations

**This would take about 2-3 hours to build fully.**

---

**Should I start building the CRM section?** 🚀

