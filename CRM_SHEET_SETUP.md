# Contact CRM Google Sheet Setup

## 📋 **Create New Spreadsheet**

**Name:** `49North_ContactCRM`

**Purpose:** Track contact notes, follow-ups, and metadata to supplement Brevo

---

## 📑 **Required Tabs**

### **Tab 1: ContactNotes** (A-F)

Track all notes and interactions with contacts.

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | Timestamp | When note was created | `2025-10-18T14:30:00Z` |
| B | Email | Contact email (key) | `john.doe@agency.gov` |
| C | Note Type | Type of interaction | `Call`, `Email`, `Meeting`, `Follow-up` |
| D | Note | Actual note content | `Called - interested in Q1 training package` |
| E | Created By | Who added the note | `chris@49north.com` |
| F | Follow Up Date | Optional reminder date | `2025-11-01` |

**Example Rows:**
```
Timestamp                 | Email              | Note Type | Note                           | Created By          | Follow Up Date
2025-10-18T14:30:00Z     | john@agency.gov    | Call      | Interested in Q1 training      | chris@49north.com   | 2025-11-01
2025-10-15T10:00:00Z     | sarah@school.edu   | Email     | Sent pricing info              | system              | 
2025-10-10T16:45:00Z     | mike@police.gov    | Meeting   | Met at conference - follow up  | chris@49north.com   | 2025-10-25
```

---

### **Tab 2: ContactMetadata** (A-H)

Store additional data not in Brevo (or for faster local access).

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | Email | Contact email (key) | `john.doe@agency.gov` |
| B | Lead Score | Calculated score 0-100 | `85` |
| C | Lead Status | Hot/Warm/Cold | `Hot Lead` |
| D | First Touch Date | When first contacted us | `2025-01-15` |
| E | Last Activity Date | Most recent interaction | `2025-10-18` |
| F | Webinar Count | Total webinars | `3` |
| G | Attended Count | Webinars attended | `2` |
| H | Survey Contact | Survey says contact? | `Yes` |

**This gets auto-populated by sync function.**

---

### **Tab 3: FollowUpTasks** (A-G)

Track pending follow-up actions.

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | Task ID | Unique ID | `TASK001` |
| B | Email | Contact email | `john.doe@agency.gov` |
| C | Contact Name | For reference | `John Doe` |
| D | Task | What needs to be done | `Send Q1 training proposal` |
| E | Due Date | When to complete | `2025-11-01` |
| F | Status | Open/Completed | `Open` |
| G | Created Date | When task was added | `2025-10-18` |

**Example Rows:**
```
Task ID | Email              | Contact Name | Task                        | Due Date   | Status    | Created
TASK001 | john@agency.gov    | John Doe     | Send Q1 proposal           | 2025-11-01 | Open      | 2025-10-18
TASK002 | sarah@school.edu   | Sarah Smith  | Follow up on pricing       | 2025-10-25 | Open      | 2025-10-15
TASK003 | mike@police.gov    | Mike Johnson | Send conference materials  | 2025-10-20 | Completed | 2025-10-10
```

---

## 🔧 **Environment Variable**

After creating the sheet, add to Netlify:

**Variable Name:** `CRM_SHEET_ID`

**Value:** Your new spreadsheet ID (from URL)

**Example:**
```
https://docs.google.com/spreadsheets/d/ABC123XYZ456/edit
                                       ↑
                         This is your CRM_SHEET_ID
```

---

## ✅ **Setup Checklist**

1. **Create new Google Sheet** named `49North_ContactCRM`
2. **Add 3 tabs:**
   - `ContactNotes` with headers in row 1: `Timestamp, Email, Note Type, Note, Created By, Follow Up Date`
   - `ContactMetadata` with headers in row 1: `Email, Lead Score, Lead Status, First Touch Date, Last Activity Date, Webinar Count, Attended Count, Survey Contact`
   - `FollowUpTasks` with headers in row 1: `Task ID, Email, Contact Name, Task, Due Date, Status, Created Date`
3. **Share with Google Service Account**
   - Share → Add `GOOGLE_CLIENT_EMAIL` as Editor
4. **Copy spreadsheet ID** from URL
5. **Add to Netlify:**
   - Go to: Netlify → Site Settings → Environment Variables
   - Add: `CRM_SHEET_ID` = `your-spreadsheet-id`
6. **Redeploy site**

---

## 🎯 **What Happens Next**

Once you've created the sheet and added the environment variable:

1. **I'll build the backend functions** to:
   - Sync webinar contacts to Brevo
   - Fetch unified contact list
   - Add/edit notes
   - Update contact info
   - Track follow-ups

2. **I'll build the CRM UI** with:
   - Contact list view
   - Search and filters
   - Contact detail modal
   - Hot lead highlighting
   - Sync buttons

3. **I'll integrate it** into:
   - App navigation
   - Dashboard (hot leads card)
   - Webinar Operations (view contact button)

---

**Create the sheet and let me know the Sheet ID, and I'll build the complete CRM system!** 🚀

