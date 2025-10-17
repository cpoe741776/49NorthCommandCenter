# Social Media Archive & Reuse System

## 📊 **How Posts Are Archived**

### **✅ Yes, Everything Stored in Google Sheets!**

All social media posts are **permanently archived** in your Google Sheets:

**Sheet**: Your `SOCIAL_MEDIA_SHEET_ID` environment variable  
**Tab**: `MainPostData`  
**Columns**: A through R (18 columns)

---

## 📋 **Complete Data Structure**

### **MainPostData Tab (A-R)**

| Column | Field | Description |
|--------|-------|-------------|
| **A** | `timestamp` | ISO timestamp (also acts as Post ID) |
| **B** | `status` | Draft / Scheduled / Published |
| **C** | `contentType` | announcement / webinar / article / case_study / custom |
| **D** | `title` | Post title / email subject |
| **E** | `body` | Post content (full text) |
| **F** | `imageUrl` | Image URL (optional) |
| **G** | `videoUrl` | Video URL (optional) |
| **H** | `platforms` | CSV: Facebook,LinkedIn,Website,Email |
| **I** | `scheduleDate` | Scheduled publish date/time |
| **J** | `publishedDate` | Actual publish timestamp |
| **K** | `postPermalink` | WordPress permalink (if published to Website) |
| **L** | `facebookPostId` | Facebook post ID (if published) |
| **M** | `linkedInPostId` | LinkedIn post ID (if published) |
| **N** | `wordPressPostId` | WordPress post ID (if published) |
| **O** | `brevoEmailId` | Brevo campaign ID (if email created) |
| **P** | `analytics` | JSON object with publish results |
| **Q** | `createdBy` | Creator name (default: 'user') |
| **R** | `tags` | CSV tags: mental-armor,training,resilience |

---

## 🔄 **How the Archive Works**

### **1. Creating a Post**

When you create a post via the composer:

1. ✅ **Composer Modal** → User fills in title, body, platforms, etc.
2. ✅ **"Save Draft"** → Calls `createSocialPost.js`
3. ✅ **Append to Sheet** → Adds new row to `MainPostData!A:R`
4. ✅ **Status = Draft** → Stored with timestamp ID

**Result**: Post is now in your archive, visible in UI

---

### **2. Publishing a Post**

When you click "Publish Now":

1. ✅ **Post Created** → Saved to sheet as Draft (if new)
2. ✅ **Publish Function** → Calls `publishSocialPost.js`
3. ✅ **Multi-Platform Publish**:
   - Facebook → Returns post ID
   - LinkedIn → Returns post ID
   - WordPress → Returns post ID + permalink
   - Brevo → Returns campaign ID
4. ✅ **Update Sheet** → Updates columns B, J, K-P with results
   - B: Status → "Published"
   - J: publishedDate → ISO timestamp
   - K-O: Platform-specific IDs
   - P: Analytics JSON (full results)

**Result**: Post marked as Published, all IDs tracked

---

### **3. Viewing the Archive**

The Social Media Operations UI shows all posts:

**Display Features**:
- ✅ **Filter by Status**: Draft, Scheduled, Published, All
- ✅ **Filter by Platform**: Facebook, LinkedIn, Website, Email, All
- ✅ **Search**: By title or body content
- ✅ **Sort**: By date (newest first)
- ✅ **Export CSV**: Download full archive

**What You See**:
- Title (truncated body preview)
- Status badge (color-coded)
- Platform tags
- Dates (scheduled, published, created)
- Links (to published posts)
- **NEW**: "Reuse" button

---

## ✨ **NEW: Reuse Past Posts**

### **How It Works**

1. **Find a Post** in the Social Media Operations table
2. **Click "Reuse"** button (blue button with copy icon)
3. **Composer Opens** with all data pre-filled:
   - ✅ Title
   - ✅ Body
   - ✅ Content Type
   - ✅ Image URL
   - ✅ Video URL
   - ✅ Platforms (checkboxes auto-selected)
   - ✅ Tags
   - ❌ Schedule Date (cleared for safety - you must re-schedule)
4. **Edit as Needed** - Change anything you want
5. **Publish Again** - Save draft or publish immediately

### **Use Cases**

**Scenario 1: Repost to Different Platforms**
- Originally posted to Facebook only
- Reuse → Check LinkedIn and Email
- Publish → Now on 3 platforms

**Scenario 2: Monthly Recurring Content**
- "Join our free webinar this month"
- Reuse last month's post
- Update dates and details
- Publish

**Scenario 3: Template-Based Posts**
- Created a great announcement format
- Reuse the structure
- Replace specific details
- Publish

**Scenario 4: A/B Testing**
- Try different titles
- Reuse same body content
- Test which performs better

---

## 🔍 **Querying Your Archive**

### **In the UI** (Social Media Operations)

**Filters Available**:
```
- Status: all | Draft | Scheduled | Published
- Platform: all | Facebook | LinkedIn | Website | Email
- Search: (searches title + body)
```

**Example Queries**:
- All published Facebook posts → Status: Published, Platform: Facebook
- Draft webinar promos → Status: Draft, Search: "webinar"
- Email campaigns sent → Status: Published, Platform: Email

### **Directly in Google Sheets**

You can also open your sheet and use Google Sheets filters/queries:

**Example Sheet Queries**:
```
=QUERY(MainPostData!A:R, "SELECT A, D, E, H WHERE B = 'Published' AND H CONTAINS 'Facebook'")
```

**Find all posts with specific tag**:
```
=QUERY(MainPostData!A:R, "SELECT A, D, R WHERE R CONTAINS 'resilience'")
```

---

## 📈 **Archive Analytics**

### **Current Stats** (from KPI Cards)

- **Total Posts**: All rows in `MainPostData`
- **Published**: Count where status = 'Published'
- **Scheduled**: Count where status = 'Scheduled'
- **Drafts**: Count where status = 'Draft'

### **Platform Breakdown**

You can see which posts went to which platforms:
- Column H contains CSV: `Facebook,LinkedIn,Website,Email`
- Filter table by platform to see counts

### **Future Analytics** (Optional Phase)

The `analytics` column (P) stores JSON results from each publish:

```json
{
  "facebook": { "postId": "123456_789" },
  "linkedin": { "postId": "urn:li:share:789" },
  "wordpress": { "postId": 456, "permalink": "https://..." },
  "brevo": { "campaignId": 789, "dashboardLink": "https://..." }
}
```

**Potential Future Metrics**:
- Posts per platform per week
- Best performing platforms (if social APIs provide engagement)
- Content type distribution
- Publishing cadence

---

## 🔒 **Data Retention**

**Archive Storage**:
- ✅ **Permanent** - Posts never auto-delete
- ✅ **Google Sheets** - Part of your regular backups
- ✅ **Version History** - Google Sheets tracks changes
- ✅ **Access Control** - Same permissions as your sheet

**Manual Cleanup** (if needed):
1. Open `MainPostData` tab in Google Sheets
2. Filter by old dates or status
3. Delete rows manually
4. Or archive to another tab

---

## 🎯 **Best Practices**

### **1. Tagging Strategy**

Use consistent tags in the `tags` field:
```
Good: mental-armor, training, webinar-promo, resilience
Bad: training!, "Mental Armor", WEBINAR
```

**Recommended Tags**:
- `mental-armor` - Core brand content
- `training` - Training-related posts
- `webinar-promo` - Webinar promotions
- `resilience` - Resilience-focused content
- `case-study` - Success stories
- `announcement` - Company news
- `testimonial` - Client testimonials

### **2. Content Type Usage**

Use the content type dropdown strategically:
- **Announcement** - Company news, updates
- **Webinar** - Webinar promotions
- **Article** - Blog post shares
- **Case Study** - Success stories
- **Custom** - Anything else

This helps filter and analyze later.

### **3. Reusing Posts**

**When to Reuse**:
- ✅ Recurring monthly content
- ✅ Evergreen announcements
- ✅ Template-based posts
- ✅ Testing different platforms

**When to Create New**:
- ❌ Time-sensitive content with past dates
- ❌ Posts that need significant rewrites
- ❌ Different target audiences

### **4. Draft vs Publish**

**Use "Save Draft" when**:
- Need approval before posting
- Want to schedule for later
- Testing content ideas
- Creating templates

**Use "Publish Now" when**:
- Content is final and approved
- Ready to go live immediately
- Time-sensitive announcements

---

## 🚀 **Summary**

**Archive System**:
- ✅ All posts stored in Google Sheets (`MainPostData` A-R)
- ✅ 18 columns of data per post
- ✅ Platform-specific IDs tracked after publish
- ✅ Full analytics JSON stored
- ✅ Permanent retention with manual cleanup

**Reuse System**:
- ✅ Click "Reuse" button on any past post
- ✅ Composer auto-fills with all data
- ✅ Edit and republish instantly
- ✅ Great for recurring content

**Your Data is Safe**:
- ✅ Google Sheets handles storage
- ✅ Version history available
- ✅ Part of your regular backups
- ✅ No data loss risk

---

## 📚 **Related Documents**

- `SOCIAL_MEDIA_COMPLETE.md` - Full feature guide
- `SOCIAL_MEDIA_CREDENTIALS.md` - Credential setup
- `SOCIAL_MEDIA_PLAN.md` - Implementation roadmap

Your social media content library is now fully searchable, reusable, and permanently archived! 🎉

