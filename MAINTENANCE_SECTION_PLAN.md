# WebApp Maintenance Section - Design Plan

## 🛠️ **Overview**

A dedicated maintenance section to keep your app healthy, performant, and fresh with automated cleanup tasks and health monitoring.

---

## 📋 **Maintenance Tasks**

### **1. Auto-Archive Disregarded Emails**
- **Purpose**: Move old disregarded emails to archive after X days
- **Default**: Archive after 90 days
- **Action**: Move from `Disregarded` tab to `Disregarded_Archive` tab
- **UI**: Shows count of emails to archive, "Archive Now" button
- **Benefit**: Keeps Disregarded tab clean, improves performance

### **2. Auto-Archive Old Social Posts**
- **Purpose**: Archive published social posts after X days
- **Default**: Archive after 180 days (6 months)
- **Action**: Move from `MainPostData` to `MainPostData_Archive` tab
- **UI**: Shows count of posts to archive, "Archive Now" button
- **Benefit**: Reduces MainPostData size, faster loading

### **3. Token Health Monitoring**
- **Purpose**: Check validity of API tokens/credentials
- **Checks**:
  - LinkedIn Access Token expiration
  - Facebook Page Token expiration
  - Google Service Account validity
  - Brevo API key status
  - WordPress authentication
- **UI**: Shows status of each token (✅ Valid, ⚠️ Expiring, ❌ Expired)
- **Actions**: Links to refresh/renew instructions

### **4. Data Cleanup**
- **Purpose**: Remove expired/stale data
- **Tasks**:
  - Delete social posts in "Draft" status older than 30 days
  - Remove duplicate webinar entries (recurring duplicates)
  - Clean up orphaned reminder tracking entries
- **UI**: Shows cleanup summary, "Run Cleanup" button

### **5. Cache Management**
- **Purpose**: Clear server-side caches when needed
- **Actions**:
  - Clear all function caches
  - Force fresh data fetch
- **UI**: "Clear All Caches" button
- **Use Case**: When you manually update sheets and need immediate refresh

### **6. Performance Metrics**
- **Purpose**: Monitor app health
- **Metrics**:
  - API quota usage (Google Sheets reads/minute)
  - Average function execution time
  - Cache hit rate
  - Error rate by function
- **UI**: Visual dashboard with charts

---

## 🎨 **UI Design**

### **Maintenance Section Layout:**

```
┌─────────────────────────────────────────────────┐
│  🛠️ System Maintenance                          │
│  Keep your app healthy and performant           │
│                                                  │
│  ┌──────────────┐ ┌──────────────┐             │
│  │  Last Run    │ │  Next Run    │             │
│  │  2 days ago  │ │  In 5 days   │             │
│  └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📦 Data Archival                                │
│                                                  │
│ Disregarded Emails (90+ days old)               │
│ ├─ 45 emails ready to archive                   │
│ └─ [Archive Now] button                         │
│                                                  │
│ Social Posts (180+ days old)                    │
│ ├─ 123 posts ready to archive                   │
│ └─ [Archive Now] button                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🔑 API Token Health                             │
│                                                  │
│ ✅ LinkedIn Access Token - Valid (30 days left) │
│ ✅ Facebook Page Token - Valid (Never expires)  │
│ ✅ Google Service Account - Valid               │
│ ⚠️ Brevo API Key - Expiring in 7 days          │
│    [Renew Instructions →]                       │
│ ✅ WordPress Auth - Valid                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🧹 Data Cleanup                                 │
│                                                  │
│ Draft Posts (30+ days old)                      │
│ ├─ 8 old drafts to delete                       │
│ └─ [Delete Old Drafts] button                   │
│                                                  │
│ Duplicate Webinars                              │
│ ├─ 0 duplicates found                           │
│ └─ ✅ Clean                                      │
│                                                  │
│ Orphaned Reminders                              │
│ ├─ 2 orphaned entries                           │
│ └─ [Clean Up] button                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 💾 Cache Management                             │
│                                                  │
│ Server-Side Caches:                             │
│ ├─ Reminders: Cached (age: 2m 15s)             │
│ ├─ Webinars: Cached (age: 1m 30s)              │
│ ├─ Social: Cached (age: 45s)                    │
│ └─ [Clear All Caches] button                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📊 Performance Metrics                          │
│                                                  │
│ API Quota Usage:                                │
│ ├─ 12/60 requests this minute ✅                │
│ └─ Cache hit rate: 78%                          │
│                                                  │
│ Function Performance:                           │
│ ├─ Avg execution time: 245ms                    │
│ └─ Error rate: 0.5%                             │
└─────────────────────────────────────────────────┘
```

---

## 🔧 **Maintenance Functions to Build**

### **1. `archiveOldDisregards.js`**
```javascript
POST /.netlify/functions/archiveOldDisregards
Body: { daysThreshold: 90 }
Response: { archived: 45, success: true }
```

### **2. `archiveOldSocialPosts.js`**
```javascript
POST /.netlify/functions/archiveOldSocialPosts
Body: { daysThreshold: 180 }
Response: { archived: 123, success: true }
```

### **3. `checkTokenHealth.js`**
```javascript
GET /.netlify/functions/checkTokenHealth
Response: {
  linkedin: { valid: true, expiresIn: 30 },
  facebook: { valid: true, neverExpires: true },
  google: { valid: true },
  brevo: { valid: true, expiresIn: 7 },
  wordpress: { valid: true }
}
```

### **4. `cleanupOldData.js`**
```javascript
POST /.netlify/functions/cleanupOldData
Response: {
  oldDraftsDeleted: 8,
  duplicatesRemoved: 0,
  orphanedReminders: 2
}
```

### **5. `clearCaches.js`**
```javascript
POST /.netlify/functions/clearCaches
Response: { success: true, message: 'All caches cleared' }
```

### **6. `getMaintenanceStatus.js`**
```javascript
GET /.netlify/functions/getMaintenanceStatus
Response: {
  disregardsToArchive: 45,
  socialPostsToArchive: 123,
  oldDrafts: 8,
  duplicateWebinars: 0,
  orphanedReminders: 2,
  tokenHealth: {...},
  lastRun: '2025-10-16T12:00:00Z',
  nextRecommendedRun: '2025-10-23T12:00:00Z'
}
```

---

## 📅 **Recommended Maintenance Schedule**

### **Weekly Tasks:**
- Check token health
- Review performance metrics

### **Monthly Tasks:**
- Archive disregarded emails (90+ days)
- Clean up old drafts (30+ days)
- Remove orphaned reminders

### **Quarterly Tasks:**
- Archive old social posts (180+ days)
- Review and optimize data structure

---

## 🎯 **Auto-Maintenance (Optional Future)**

### **Scheduled Netlify Functions:**
Could run automatically on a schedule:
- Daily: Check token health, send alerts if expiring
- Weekly: Archive old disregards
- Monthly: Archive old social posts

**For now, manual triggers from UI are safer!**

---

## 🚀 **Should I Build This?**

**What would you like?**

**Option A - Full Build:**
- Create all 6 maintenance functions
- Build comprehensive Maintenance UI section
- Add alerts to Dashboard
- Include in app navigation

**Option B - Phased Approach:**
- Start with most critical (token health, archival)
- Add more features later
- Simpler UI initially

**Option C - Just Documentation:**
- Create maintenance scripts you can run manually
- No UI, just instructions and functions

**Let me know and I'll build it!** 🛠️

