# Social Media Reminder System - Complete Design

## 📋 **System Overview**

### **Two Types of Reminders:**

1. **Webinar Email Reminders** (Event-driven)
   - Triggered by upcoming webinars
   - Creates Brevo draft emails 1 week, 1 day, 1 hour before
   - Links back to Social Media to review/send

2. **Weekly Social Post Reminders** (Schedule-driven)
   - Monday, Wednesday, Friday posts
   - Visual alerts in UI for team
   - Tracks if posts were created

---

## 📊 **Google Sheets Structure**

### **New Tab: `ReminderTracking`** (A-L, 12 columns)

| Column | Field | Description | Example |
|--------|-------|-------------|---------|
| **A** | reminderID | Unique ID | `REM001`, `REM002` |
| **B** | reminderType | Type | `webinar-1week`, `webinar-1day`, `webinar-1hour`, `social-monday`, `social-wednesday`, `social-friday` |
| **C** | targetID | Webinar ID or week number | `WEB123`, `2025-W42` |
| **D** | targetDate | When reminder triggers | `2025-10-23T10:00:00Z` |
| **E** | status | Current status | `pending`, `draft-created`, `sent`, `skipped` |
| **F** | draftCreatedDate | When draft was created | `2025-10-16T14:30:00Z` |
| **G** | brevoEmailID | Brevo campaign ID | `12345` |
| **H** | brevoDashboardLink | Direct link to review | `https://app.brevo.com/campaign/id/12345` |
| **I** | socialPostID | Social post timestamp (if created) | `2025-10-16T14:30:00.000Z` |
| **J** | notes | Additional info | `Sent to 45 registrants` |
| **K** | createdBy | Who created | `system`, `user` |
| **L** | lastChecked | Last check timestamp | `2025-10-18T08:00:00Z` |

---

## 🎯 **Webinar Email Reminders**

### **How It Works:**

1. **System checks daily** for upcoming webinars
2. **For each upcoming webinar**, creates 3 reminders:
   - 1 week before (7 days)
   - 1 day before (24 hours)
   - 1 hour before (60 minutes)
3. **When trigger time arrives**:
   - Creates Brevo draft email
   - Marks reminder as `draft-created`
   - Stores Brevo campaign ID
4. **User reviews in Brevo** and manually sends

### **Email Template Structure:**

Using webinar data from `Webinars` tab:
- Subject: `[1 Week/1 Day/1 Hour] Until: {Webinar Title}`
- Content includes:
  - Webinar Date & Time (EDT)
  - Headline/Hook
  - What session covers
  - Why it matters
  - Who should attend
  - Walk away with
  - Speaker Bio
  - Main Image (if available)
  - Guest Speaker Image (if available)
  - **Register Now** button → Registration Form URL

### **Display in WebinarOperations:**

For each upcoming webinar, show reminder status:

```
┌─────────────────────────────────────────┐
│ Webinar: Mental Armor Training          │
│ Date: Oct 30, 2025 @ 2:00 PM EDT       │
├─────────────────────────────────────────┤
│ Email Reminders:                         │
│ ✅ 1 Week (Draft created Oct 23)        │
│ ⏳ 1 Day (Triggers Oct 29)              │
│ ⏳ 1 Hour (Triggers Oct 30 @ 1:00 PM)   │
│                                          │
│ [Review Emails in Social Media] button  │
└─────────────────────────────────────────┘
```

---

## 📅 **Weekly Social Post Reminders**

### **Schedule:**

**Monday Posts** - "How to Be Resilient This Week"
- Content: Weekly resilience tip/skill
- Tags: Mental Armor skill of the week
- Platforms: Facebook, LinkedIn

**Wednesday Posts** - "Midweek Follow-Up"
- Content: Follow-up to Monday's tip
- Example: Real-world application
- Platforms: Facebook, LinkedIn

**Friday Posts** - "Learn More"
- Content: CTA to website/courses
- Link: MyMentalArmor.com course pages
- Platforms: Facebook, LinkedIn, potentially Email

### **How It Works:**

1. **System checks current week** (ISO week number)
2. **For each day (Mon/Wed/Fri)**:
   - Check if post was created this week for that day
   - If NOT created and day has passed → Show alert
   - If day is upcoming → Show reminder
3. **Visual alerts** in Social Media Operations:
   ```
   ⚠️ Weekly Post Reminder
   Monday: ❌ Not posted (overdue by 2 days)
   Wednesday: ⏳ Due today
   Friday: ⏰ Due in 2 days
   
   [Create Monday Post] [Create Wednesday Post] [Create Friday Post]
   ```

### **Display in Dashboard:**

Alert card if posts are missing:
```
┌─────────────────────────────────────┐
│ ⚠️ Weekly Social Posts              │
│ Missing this week:                   │
│ • Monday post (overdue)             │
│ • Wednesday post (due today)        │
│                                      │
│ [Go to Social Media] button         │
└─────────────────────────────────────┘
```

### **Display in Ticker:**

```
⚠️ Social: Monday post overdue - Create weekly resilience content
⏰ Webinar: Email reminder due in 2 hours - Review in Social Media
```

---

## 🔄 **Automation Flow**

### **Scheduled Function: `checkReminders.js`**

Runs every hour (Netlify scheduled function):

1. **Check Webinar Reminders:**
   - Get all upcoming webinars from `Webinars` tab
   - For each webinar:
     - Calculate 1 week, 1 day, 1 hour timestamps
     - Check `ReminderTracking` for existing reminders
     - If trigger time passed and status=`pending`:
       - Create Brevo draft email
       - Update status to `draft-created`
       - Store Brevo campaign ID

2. **Check Weekly Social Reminders:**
   - Get current week number
   - Check `MainPostData` for posts this week
   - Create reminder entries for missing Mon/Wed/Fri posts
   - Mark as `pending` if not created

3. **Update Ticker/Dashboard Data:**
   - Return summary of pending reminders
   - Feed into comprehensive ticker

---

## 📧 **Webinar Email Template**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .header { background: #003049; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .webinar-info { background: #f0f7ff; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .cta-button { background: #003049; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{TIMING}} Until Your Webinar!</h1>
    <p>{{WEBINAR_TITLE}}</p>
  </div>
  
  <div class="content">
    <img src="{{MAIN_IMAGE_URL}}" alt="{{WEBINAR_TITLE}}" />
    
    <h2>{{HEADLINE_HOOK}}</h2>
    
    <div class="webinar-info">
      <p><strong>📅 Date:</strong> {{WEBINAR_DATE}}</p>
      <p><strong>🕐 Time:</strong> {{WEBINAR_TIME}} EDT</p>
      <p><strong>⏱️ Duration:</strong> 60 minutes</p>
    </div>
    
    <h3>What This Session Covers:</h3>
    <p>{{WHAT_COVERS}}</p>
    
    <h3>Why This Matters:</h3>
    <p>{{WHY_MATTERS}}</p>
    
    <h3>Who Should Attend:</h3>
    <p>{{WHO_ATTEND}}</p>
    
    <h3>What You'll Walk Away With:</h3>
    <p>{{WALK_AWAY}}</p>
    
    {{IF_GUEST_SPEAKER}}
    <div style="margin: 30px 0;">
      <img src="{{GUEST_IMAGE_URL}}" alt="Guest Speaker" style="max-width: 200px; border-radius: 50%;" />
      <h3>About Your Presenter:</h3>
      <p>{{SPEAKER_BIO}}</p>
    </div>
    {{/IF_GUEST_SPEAKER}}
    
    <center>
      <a href="{{REGISTRATION_URL}}" class="cta-button">
        🎯 Register Now
      </a>
    </center>
    
    <p style="font-size: 12px; color: #666; margin-top: 40px;">
      Questions? Reply to this email or visit <a href="https://mymentalarmor.com">MyMentalArmor.com</a>
    </p>
  </div>
</body>
</html>
```

**Template Variables** (pulled from Webinars sheet):
- `{{TIMING}}`: "1 Week", "1 Day", "1 Hour"
- `{{WEBINAR_TITLE}}`, `{{WEBINAR_DATE}}`, `{{WEBINAR_TIME}}`
- All other fields from webinar data

---

## 🎨 **UI Components**

### **WebinarOperations - Reminder Status**

Add to each upcoming webinar card:

```jsx
<div className="mt-4 border-t pt-4">
  <h4 className="font-semibold text-sm mb-2">📧 Email Reminders</h4>
  <div className="space-y-1 text-xs">
    <div className="flex items-center justify-between">
      <span>1 Week Before:</span>
      {reminder1Week.status === 'draft-created' ? (
        <span className="text-green-600">✅ Draft created</span>
      ) : reminder1Week.isPast ? (
        <span className="text-red-600">❌ Missed</span>
      ) : (
        <span className="text-gray-600">⏰ Due {daysUntil}</span>
      )}
    </div>
    {/* Similar for 1 day and 1 hour */}
  </div>
  <button className="mt-2 text-blue-600 text-xs underline">
    → Review in Social Media
  </button>
</div>
```

### **SocialMediaOperations - Weekly Alerts**

Add alert banner at top:

```jsx
{weeklyReminders.hasMissing && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-yellow-900">⚠️ Weekly Posts Reminder</h3>
        <div className="text-sm text-yellow-800 mt-1">
          {weeklyReminders.monday && <div>• Monday: {weeklyReminders.monday.status}</div>}
          {weeklyReminders.wednesday && <div>• Wednesday: {weeklyReminders.wednesday.status}</div>}
          {weeklyReminders.friday && <div>• Friday: {weeklyReminders.friday.status}</div>}
        </div>
      </div>
      <button onClick={() => openComposerWithTemplate('monday')}>
        Create Post
      </button>
    </div>
  </div>
)}
```

### **Dashboard - Reminder Summary**

New card:

```jsx
<div className="bg-white p-6 rounded-lg shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600">Pending Reminders</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">
        {reminderSummary.pending}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {reminderSummary.overdue} overdue
      </p>
    </div>
    <Bell className="text-yellow-600" size={40} />
  </div>
</div>
```

---

## 🔔 **Reminder Logic**

### **Webinar Email Timing:**

```javascript
function calculateWebinarReminders(webinar) {
  const webinarDate = new Date(webinar.date + ' ' + webinar.time);
  
  return {
    oneWeek: new Date(webinarDate.getTime() - 7 * 24 * 60 * 60 * 1000),
    oneDay: new Date(webinarDate.getTime() - 24 * 60 * 60 * 1000),
    oneHour: new Date(webinarDate.getTime() - 60 * 60 * 1000)
  };
}
```

### **Weekly Social Post Timing:**

```javascript
function getWeeklyPostTargets(weekNumber) {
  // Get Monday, Wednesday, Friday of the current week
  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  
  const monday = new Date(jan1.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  // Adjust to actual Monday
  const dayOfWeek = monday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);
  
  return {
    monday: new Date(monday),
    wednesday: new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000),
    friday: new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000)
  };
}
```

---

## 🔄 **Functions to Create**

### **1. `createWebinarReminderEmail.js`**
- Accepts: `{ webinarId, timing: '1week'|'1day'|'1hour' }`
- Fetches webinar data from `Webinars` tab
- Builds HTML email from template
- Creates Brevo draft campaign
- Updates `ReminderTracking` with campaign ID
- Returns: `{ success, campaignId, dashboardLink }`

### **2. `checkReminders.js`** (Scheduled, runs hourly)
- Scans `Webinars` tab for upcoming webinars
- Checks `ReminderTracking` for existing reminders
- Creates missing reminders
- Triggers reminders when due time arrives
- Returns: `{ webinarReminders: [], socialReminders: [], summary }`

### **3. `getReminders.js`**
- Returns current reminder status
- Used by WebinarOperations, SocialMediaOperations, Dashboard
- Returns: `{ webinarReminders: [], weeklyReminders: {}, summary }`

---

## 📱 **UI Integration Points**

### **WebinarOperations.jsx**
```jsx
// Add to each webinar card
const webinarReminders = reminders.filter(r => r.targetID === webinar.id);

<ReminderStatus 
  webinar={webinar}
  reminders={webinarReminders}
  onReview={() => navigate('/social-media')}
/>
```

### **SocialMediaOperations.jsx**
```jsx
// Add alert banner at top
<WeeklyReminderBanner
  weeklyReminders={weeklyReminders}
  onCreatePost={(day) => openComposerWithTemplate(day)}
/>
```

### **Dashboard.jsx**
```jsx
// Add reminder summary card
<ReminderSummaryCard
  reminders={reminderSummary}
  onClick={() => navigate('/social-media')}
/>
```

### **Ticker Integration**
```javascript
// In comprehensiveTickerService.js
if (reminderSummary.overdueWebinarEmails > 0) {
  items.push({
    message: `⚠️ ${reminderSummary.overdueWebinarEmails} webinar email reminders need review`,
    priority: 'high',
    category: 'Reminder',
    link: '#/social-media'
  });
}

if (weeklyReminders.missing.length > 0) {
  items.push({
    message: `📅 Create ${weeklyReminders.missing.join(', ')} social posts`,
    priority: 'medium',
    category: 'Reminder',
    link: '#/social-media'
  });
}
```

---

## ⚙️ **Implementation Steps**

### **Phase 1: Data Schema** (30 min)
1. Create `ReminderTracking` tab in Social Media sheet
2. Add headers A-L
3. Create helper functions for CRUD operations

### **Phase 2: Webinar Email Reminders** (2 hours)
1. Create `createWebinarReminderEmail.js`
2. Build HTML email template builder
3. Create Brevo draft campaigns
4. Test with upcoming webinar

### **Phase 3: Weekly Social Reminders** (1 hour)
1. Create logic to detect missing Mon/Wed/Fri posts
2. Generate reminder entries
3. Calculate status (pending/overdue/completed)

### **Phase 4: UI Integration** (2 hours)
1. Add reminder status to WebinarOperations
2. Add weekly alert banner to SocialMediaOperations
3. Add reminder card to Dashboard
4. Add reminder items to Ticker

### **Phase 5: Scheduled Function** (1 hour)
1. Create `checkReminders.js` with hourly trigger
2. Configure in `netlify.toml`
3. Test trigger logic

---

## 📝 **Weekly Post Templates**

### **Monday Template:**
```
Title: Mental Armor Skill of the Week: [SKILL NAME]
Body: 
This week, focus on [SKILL]. 

[What it is - 2 sentences]

[Why it matters for first responders/your audience - 2 sentences]

Try this: [One simple exercise or application]

Tags: [skill-name], resilience-training, mental-fitness
```

### **Wednesday Template:**
```
Title: Putting [SKILL] Into Practice
Body:
Earlier this week we introduced [SKILL]. Here's how to apply it:

[Real-world example or case study - 3-4 sentences]

"[Quote from practitioner]"

Keep practicing this skill and notice the difference in your resilience.

Tags: [skill-name], resilience-training, from-the-field
```

### **Friday Template:**
```
Title: Ready to Build Your Mental Armor?
Body:
This week we explored [SKILL]. Want to learn more resilience skills?

✨ Take the free Mental Fitness Assessment
🎯 Explore our training programs
📚 Browse the Mental Armor skill library

[Link to MyMentalArmor.com]

Have a resilient weekend!

Tags: mental-armor, training, cta
```

---

## 🎯 **Reminder Summary API**

**Endpoint**: `/.netlify/functions/getReminders`

**Returns**:
```json
{
  "success": true,
  "webinarReminders": [
    {
      "webinarId": "WEB123",
      "webinarTitle": "Mental Armor Training",
      "webinarDate": "2025-10-30T14:00:00Z",
      "reminders": {
        "oneWeek": { "status": "draft-created", "dueDate": "2025-10-23", "campaignId": 123 },
        "oneDay": { "status": "pending", "dueDate": "2025-10-29" },
        "oneHour": { "status": "pending", "dueDate": "2025-10-30T13:00:00Z" }
      }
    }
  ],
  "weeklyReminders": {
    "currentWeek": "2025-W42",
    "monday": { "status": "missing", "dueDate": "2025-10-20", "overdue": true },
    "wednesday": { "status": "pending", "dueDate": "2025-10-22" },
    "friday": { "status": "pending", "dueDate": "2025-10-24" }
  },
  "summary": {
    "totalPending": 5,
    "overdueWebinarEmails": 0,
    "overdueSocialPosts": 1,
    "upcomingInNext24Hours": 2
  }
}
```

---

## 🚀 **Ready to Build?**

I'll start with:
1. Creating the ReminderTracking sheet structure
2. Building webinar email reminder creation
3. Adding UI displays
4. Integrating with Dashboard and Ticker

**Sound good? Let's start!** 🎯

