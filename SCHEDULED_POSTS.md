# Automated Scheduled Post Publishing

## 🤖 **How It Works**

### **Storage**
All posts (Draft, Scheduled, Published) are stored in:
```
Google Sheet: SOCIAL_MEDIA_SHEET_ID
Tab: MainPostData
Columns: A-U (21 columns)
```

### **Scheduling a Post**

1. **Create Post in Composer**
   - Fill in title, body, image, platforms
   - Set **Schedule Date/Time**: "Oct 25, 2025 2:00 PM"
   - Click **"Schedule Post"**

2. **Post Saved to Sheet**
   ```
   Row in MainPostData:
   - Status: "Scheduled"
   - ScheduleDate: "2025-10-25T14:00:00"
   - All content ready to publish
   ```

3. **Automated Publishing**
   - Netlify cron job runs **every hour at :00**
   - Checks for posts where `status === 'Scheduled'` AND `scheduleDate <= now`
   - Publishes to selected platforms
   - Updates status to "Published"

---

## ⚙️ **Cron Schedule**

### **Netlify Scheduled Function**
```toml
[[functions."publishScheduledPosts".schedule]]
  cron = "0 * * * *"
```

**Translation**: Runs at the top of every hour
- 12:00 AM, 1:00 AM, 2:00 AM... 11:00 PM

**Netlify Free Tier**: 125,000 function invocations/month
- This cron: 24 runs/day × 30 days = **720 runs/month**
- Well within free tier limits

---

## 📅 **Scheduling Examples**

### **Example 1: Schedule for Next Week**
```
Today: Oct 21, 2025 (Tuesday) 3:00 PM
Schedule: Oct 28, 2025 (next Tuesday) 10:00 AM

What Happens:
- 3:00 PM today: Post saved with status "Scheduled"
- Oct 28 at 10:00 AM: Cron checks → time to publish → publishes
- Oct 28 at 10:05 AM: Post live on all platforms
- Sheet updated to "Published"
```

### **Example 2: Schedule Multiple Posts**
```
Schedule 3 posts for same day:
- 9:00 AM: Morning motivation
- 12:00 PM: Lunch learning tip  
- 5:00 PM: Evening reflection

What Happens:
- 9:00 AM cron: Publishes first post
- 12:00 PM cron: Publishes second post
- 5:00 PM cron: Publishes third post
```

### **Example 3: Week's Worth of Content**
```
Sunday night: Schedule Mon, Wed, Fri posts
- Monday 8:00 AM: "Resilience Skill of the Week"
- Wednesday 8:00 AM: "Follow-up Content"
- Friday 8:00 AM: "Learn More CTA"

What Happens:
- All saved as "Scheduled"
- Each publishes automatically at 8:00 AM on correct day
- Reminders update to "Posted" status
```

---

## 🔍 **Monitoring**

### **Netlify Function Logs**
View logs at: `https://app.netlify.com/sites/YOUR_SITE/functions/publishScheduledPosts`

**What You'll See:**
```
[ScheduledPosts] Cron job started at 2025-10-25T14:00:00Z
[ScheduledPosts] Found 47 total posts. Checking for scheduled posts...
[ScheduledPosts] Publishing post 1729874400000 scheduled for 2025-10-25T14:00:00
[Facebook] Photo post successful: 12345_67890
[LinkedIn] Image upload successful
[WordPress] Featured image uploaded: 456
[ScheduledPosts] ✅ Successfully published: 1729874400000
[ScheduledPosts] Complete: { publishedCount: 1, errorCount: 0 }
```

### **Sheet Updates**
After automated publish, your sheet row updates:
```
Before:
Status: Scheduled
PublishedDate: (empty)
FacebookPostId: (empty)

After:
Status: Published ✅
PublishedDate: 2025-10-25T14:00:00
FacebookPostId: 12345_67890
LinkedInPostId: urn:li:share:98765
WordPressPostId: 456
```

---

## 🛡️ **Safety Features**

### **1. No Double-Publishing**
- Once status = "Published", cron skips it
- Even if cron runs multiple times, post only publishes once

### **2. Error Handling**
- If Facebook fails but LinkedIn succeeds → both recorded
- Failed posts log error in Analytics column (P)
- Status stays "Scheduled" if all platforms fail (can retry)

### **3. Graceful Degradation**
- If image fails → publishes text-only
- If one platform fails → others still succeed
- Comprehensive error logging

---

## ⏰ **Timing Notes**

### **Publishing Window**
- Cron runs every hour
- Post scheduled for 2:00 PM publishes between 2:00-2:05 PM
- **Not exact to the minute**, but within the hour

### **For More Precision**
If you need posts at exact times, change cron to every 15 minutes:
```toml
cron = "*/15 * * * *"  # Runs at :00, :15, :30, :45
```

This uses more function invocations but still well within free tier.

---

## 🚀 **Current Status**

✅ **Implemented**:
- Automated cron job
- Checks scheduled posts every hour
- Publishes to all platforms
- Updates Google Sheet
- Error handling and logging

✅ **Platforms Supported**:
- Facebook (photo posts)
- LinkedIn (with images)
- WordPress Blog (featured images)
- Brevo Email (draft campaigns)

✅ **Features**:
- Google Drive link auto-conversion
- Native image uploads
- Multi-platform publishing
- Comprehensive logging

---

## 📝 **Usage**

### **To Schedule a Post:**
1. Open Social Media Operations
2. Click "New Post"
3. Fill in content
4. Select platforms
5. Set "Schedule Date/Time"
6. Click "Schedule Post"
7. **Done!** It will auto-publish at scheduled time

### **To Check Scheduled Posts:**
1. Social Media Operations
2. Filter: "Scheduled"
3. See all upcoming posts
4. Edit or delete before they publish

### **To Test:**
1. Schedule a post for 5 minutes from now
2. Wait for next cron run (top of the hour)
3. Check Netlify logs
4. Verify post appears on platforms
5. Check sheet status updated to "Published"

---

## 🎯 **Benefits**

✅ Set it and forget it
✅ Consistent posting schedule
✅ No manual intervention needed
✅ Perfect for weekly cadence
✅ Time zone friendly
✅ Batch content creation
✅ Professional automation

**Your scheduled posts now publish automatically!** 🎉

