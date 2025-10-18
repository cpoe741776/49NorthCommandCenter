# MainPostData Schema Update - Purpose Field Added

## 📋 **New Schema (A-U, 21 columns)**

Your `MainPostData` tab now needs **3 additional columns**:

| Column | Field | Description | Example |
|--------|-------|-------------|---------|
| A | Timestamp | Post creation timestamp | `2025-10-18T12:00:00.000Z` |
| B | Status | Post status | `Draft`, `Scheduled`, `Published` |
| C | Content Type | Type of content | `announcement`, `webinar`, `article` |
| D | Title | Post title | `ReFraming for Resilience` |
| E | Body | Post content | `Learn how to challenge negative thoughts...` |
| F | Image URL | Image link | `https://...` |
| G | Video URL | Video link | `https://...` |
| H | Platforms | Target platforms (CSV) | `Facebook, LinkedIn, Website` |
| I | Schedule Date | When to publish | `2025-10-20T14:00:00` |
| J | Published Date | When published | `2025-10-18T12:00:00` |
| K | Post Permalink | Published URL | `https://facebook.com/...` |
| L | Facebook Post ID | Facebook ID | `123456789` |
| M | LinkedIn Post ID | LinkedIn URN | `urn:li:share:...` |
| N | WordPress Post ID | WP post ID | `456` |
| O | Brevo Email ID | Brevo campaign ID | `789` |
| P | Analytics | Performance data | JSON string |
| Q | Created By | Creator | `user`, `system` |
| R | Tags | SEO/skill tags | `resilience, mental armor` |
| **S** | **Purpose** | **Reminder tracking** ✨ | **`weekly-monday`, `webinar-1week`, `general`** |
| **T** | **Webinar ID** | **Linked webinar** ✨ | **`12345`** (if webinar post) |
| **U** | **Webinar Title** | **Webinar reference** ✨ | **`Resilience Workshop`** |

---

## 🎯 **Purpose Field Values**

| Value | Meaning | Tracked By |
|-------|---------|------------|
| `general` | General content, no requirement | N/A |
| `weekly-monday` | Monday resilience content | Weekly reminders |
| `weekly-wednesday` | Wednesday follow-up | Weekly reminders |
| `weekly-friday` | Friday CTA/Learn More | Weekly reminders |
| `webinar-1week` | 1 week before webinar | Webinar reminders |
| `webinar-1day` | 1 day before webinar | Webinar reminders |
| `webinar-1hour` | 1 hour before webinar | Webinar reminders |

---

## ✅ **How It Works**

### **Before (Old System):**
- ❌ Checked if ANY post existed on Monday
- ❌ Test posts counted as requirement fulfillment
- ❌ Multiple posts on same day confused the system

### **After (New System):**
- ✅ Checks if post with **purpose = "weekly-monday"** exists on Monday
- ✅ General posts don't count as requirement fulfillment
- ✅ Can post multiple times per day for different purposes

---

## 📝 **What You Need to Do**

### **Add Columns to MainPostData Sheet:**

1. **Open your Social Media Google Sheet**
2. **Go to MainPostData tab**
3. **Add 3 new column headers in row 1:**
   - Column S: `Purpose`
   - Column T: `Webinar ID`
   - Column U: `Webinar Title`

That's it! The app will automatically start using these columns.

---

## 🚀 **How to Use**

### **Creating a Weekly Monday Post:**

1. Go to Social Media Operations
2. See yellow banner: "Missing posts for Week 2025-W42: Monday"
3. Click "Create Now"
4. Composer opens with **Purpose** auto-set to "📅 Weekly - Monday (Resilience Content)"
5. Write your post
6. Publish!
7. Reminder disappears! ✅

### **Creating a Webinar Social Post:**

1. Go to Social Media Operations
2. See purple banner: "🎥 Webinar Social Post Reminders"
3. Click "Create Now" for "1 Week Before"
4. Composer opens with:
   - **Purpose** auto-set to "🎥 Webinar - 1 Week Before"
   - **Webinar ID** auto-filled
   - **Webinar Title** auto-filled
5. Write promotional post
6. Publish!
7. Reminder disappears! ✅

### **Creating General Content:**

1. Click "New Post" button
2. **Purpose** defaults to "General Content (No requirement)"
3. Write whatever you want
4. Publish!
5. No reminders affected

---

## 🎊 **Benefits**

✅ **Accurate tracking**: Only counts posts meant for specific requirements
✅ **Flexible posting**: Post general content anytime without affecting reminders
✅ **Webinar linking**: Track which posts are for which webinar
✅ **Better reporting**: See exactly what's been created vs what's missing

---

**Add the 3 columns (S, T, U) to MainPostData and you're ready to go!** 🚀

