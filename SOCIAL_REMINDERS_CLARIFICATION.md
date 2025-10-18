# Social Reminders System - Clarification

## ✅ What's Currently Built:

### **1. Weekly Social Posts (Mon/Wed/Fri)**
- **Monday**: Resilience practice content
- **Wednesday**: Follow-up to Monday's content
- **Friday**: Advertisement/CTA about 49 North, what you do, "learn more"
- Shows in Dashboard card as "Monday, Wednesday posts missing"
- Shows in SocialMediaOperations as yellow alert banner
- "Create Now" buttons open post composer

### **2. Webinar Email Reminders (1 Week/1 Day/1 Hour)**
- **Purpose**: Brevo email campaigns to registrants
- **When**: 1 week, 1 day, 1 hour before webinar
- **Where**: 
  - WebinarOperations (shows status for each webinar)
  - Dashboard card ("X webinar emails overdue")
- **Action**: Click "Create Now" → Creates draft email in Brevo
- **Note**: These are EMAILS, not social posts

---

## ❌ What's NOT Built Yet:

### **Webinar Social Media Posts**

You want **social media posts** (Facebook/LinkedIn/Blog) about upcoming webinars at:
- 1 week before webinar
- 1 day before webinar
- 1 hour before webinar

**Example Posts:**
- "Join us next week for our webinar on Resilience Skills! Register now →"
- "Tomorrow! Don't miss our webinar at 2 PM EST. Last chance to register →"
- "Starting in 1 hour! Join us live for resilience training →"

---

## 🤔 Decision Needed:

### **Option 1: Add Webinar Social Post Reminders**
- Track 3 additional social posts per webinar (1wk/1day/1hr)
- Show in SocialMediaOperations: "Webinar in 1 week - Create promotion post"
- Include in Dashboard reminder count
- Separate from the email reminders

### **Option 2: Manual Approach**
- You manually create webinar social posts whenever you want
- No automated reminders
- Just use the weekly Mon/Wed/Fri schedule + manual webinar posts

---

## 📊 Current Dashboard Card:

**"Pending Social Reminders"** shows:
- **Count**: Number of overdue webinar emails + missing weekly posts
- **Details**:
  - "X webinar emails overdue" (Brevo campaigns)
  - "Monday, Wednesday posts missing" (weekly social posts)

---

## 🎯 What Would You Like?

**Choose one:**

### **A) Add Webinar Social Post Reminders**
I'll build:
- Detection for upcoming webinars
- Reminders at 1 week/1 day/1 hour to create **social posts**
- Shows in SocialMediaOperations alert
- "Create Webinar Post" buttons
- Tracks in ReminderTracking sheet

### **B) Keep It Simple**
- Only weekly Mon/Wed/Fri reminders
- Only webinar email reminders
- You manually post about webinars when you want

---

## 📝 Summary of Full System (if we add webinar social posts):

### **Social Posts You'd Track:**

1. **Weekly Regular Posts** (ongoing):
   - Monday: Resilience content
   - Wednesday: Follow-up
   - Friday: CTA/Learn more

2. **Webinar Social Posts** (per webinar):
   - 1 week before: "Join us next week!"
   - 1 day before: "Tomorrow!"
   - 1 hour before: "Starting soon!"

3. **Webinar Emails** (separate, already built):
   - 1 week before: Brevo email to registrants
   - 1 day before: Brevo email to registrants
   - 1 hour before: Brevo email to registrants

**Total**: 3 weekly posts + 3 social posts per webinar + 3 emails per webinar

---

## 🚀 Let Me Know:

**Do you want me to add webinar social post reminders (Option A)?**

Or is the current system good (weekly posts + manual webinar posts)?

