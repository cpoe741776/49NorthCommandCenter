# Setup Reminder Tracking Sheet

## 📋 **Action Required: Add New Tab to Social Media Sheet**

You need to create a new tab in your `SOCIAL_MEDIA_SHEET_ID` Google Sheet.

---

## **Step 1: Create the Tab**

1. Open your Social Media Google Sheet (the one with `MainPostData` tab)
2. Click **+** to add a new sheet
3. Name it: `ReminderTracking`

---

## **Step 2: Add Headers (Row 1, Columns A-L)**

Copy and paste these headers into Row 1:

```
Reminder ID	Reminder Type	Target ID	Target Date	Status	Draft Created Date	Brevo Email ID	Brevo Dashboard Link	Social Post ID	Notes	Created By	Last Checked
```

**Or add them individually:**

| Column | Header |
|--------|--------|
| A | Reminder ID |
| B | Reminder Type |
| C | Target ID |
| D | Target Date |
| E | Status |
| F | Draft Created Date |
| G | Brevo Email ID |
| H | Brevo Dashboard Link |
| I | Social Post ID |
| J | Notes |
| K | Created By |
| L | Last Checked |

---

## **Column Descriptions:**

- **A - Reminder ID**: Unique identifier (e.g., `REM001`, `REM002`)
- **B - Reminder Type**: `webinar-1week`, `webinar-1day`, `webinar-1hour`, `social-monday`, `social-wednesday`, `social-friday`
- **C - Target ID**: Webinar ID or week number (e.g., `WEB123`, `2025-W42`)
- **D - Target Date**: When reminder should trigger (ISO timestamp)
- **E - Status**: `pending`, `draft-created`, `sent`, `skipped`
- **F - Draft Created Date**: When Brevo draft was created
- **G - Brevo Email ID**: Brevo campaign ID
- **H - Brevo Dashboard Link**: Direct link to review email
- **I - Social Post ID**: If related to a social post
- **J - Notes**: Additional information
- **K - Created By**: `system` or `user`
- **L - Last Checked**: Last time reminder was checked

---

## **Step 3: Format the Sheet (Optional)**

1. **Bold Row 1** (headers)
2. **Freeze Row 1**: View → Freeze → 1 row
3. **Auto-resize columns**: Select all → Format → Resize columns → Fit to data
4. **Add alternating colors**: Format → Alternating colors

---

## **Step 4: Test**

Once created, the system will automatically:
- ✅ Detect upcoming webinars
- ✅ Calculate reminder due dates
- ✅ Create Brevo draft emails when due
- ✅ Track status in this sheet
- ✅ Show alerts in UI

---

## **Example Data (After System Runs)**

| Reminder ID | Reminder Type | Target ID | Target Date | Status | Draft Created Date | Brevo Email ID | Notes |
|-------------|---------------|-----------|-------------|--------|-------------------|----------------|-------|
| REM001 | webinar-1week | oct-30-webinar | 2025-10-23T14:00:00Z | draft-created | 2025-10-23T10:00:00Z | 12345 | 45 registrants |
| REM002 | webinar-1day | oct-30-webinar | 2025-10-29T14:00:00Z | pending | | | |
| REM003 | webinar-1hour | oct-30-webinar | 2025-10-30T13:00:00Z | pending | | | |
| REM004 | social-monday | 2025-W42 | 2025-10-20 | posted | | | Post ID: 2025-10-20T08:00:00.000Z |

---

## ✅ **That's It!**

Once you've created the `ReminderTracking` tab with headers A-L, the system is ready to use!

**Let me know when the tab is created, and I'll continue building the UI integration!** 🚀

