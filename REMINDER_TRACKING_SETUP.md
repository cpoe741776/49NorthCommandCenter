# ReminderTracking Tab Setup

The `ReminderTracking` tab in your Social Media Google Sheet is essential for the webinar reminder system to work properly. Without data in this tab, the dashboard, ticker, and social media operations page won't show webinar reminders.

## Tab Structure

The `ReminderTracking` tab should have these columns (A through L):

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | Date | Date when reminder was created/sent | 2024-10-23 |
| B | ReminderType | Type of reminder | `webinar-1week`, `webinar-1day`, `webinar-1hour`, `webinar-social-1week`, `webinar-social-1day`, `webinar-social-1hour` |
| C | WebinarId | ID of the webinar | `webinar-001` |
| D | WebinarTitle | Title of the webinar | "Mental Armor Training" |
| E | Status | Current status | `pending`, `sent`, `overdue` |
| F | DueDate | When the reminder is due | 2024-10-23 |
| G | CampaignId | Brevo campaign ID (for emails) | `campaign-123` |
| H | DashboardLink | Link to Brevo dashboard | `https://app.brevo.com/campaigns/123` |
| I | PostId | Social media post ID (for social reminders) | `post-456` |
| J | Notes | Additional notes | "Sent successfully" |
| K | CreatedBy | Who created the reminder | "system" or "user" |
| L | LastUpdated | Last update timestamp | 2024-10-23T10:30:00Z |

## How It Works

1. **Webinar Detection**: The system finds upcoming webinars from the `Webinars` tab
2. **Reminder Calculation**: Calculates when 1-week, 1-day, and 1-hour reminders should be sent
3. **Status Check**: Looks in `ReminderTracking` to see if reminders have been sent
4. **Dashboard Display**: Shows pending/overdue reminders on dashboard and ticker

## Current Issue

Your `ReminderTracking` tab is empty, which means:
- ❌ No webinar reminders appear on dashboard
- ❌ No ticker notifications for upcoming webinars  
- ❌ Social media operations page doesn't show webinar post reminders
- ❌ System can't track which reminders have been sent

## Solution

You need to populate the `ReminderTracking` tab with entries for your October 30th webinar. Here's what to add:

### For October 30th Webinar (1-week reminders due today):

| Date | ReminderType | WebinarId | WebinarTitle | Status | DueDate | CampaignId | DashboardLink | PostId | Notes | CreatedBy | LastUpdated |
|------|--------------|-----------|--------------|--------|---------|------------|---------------|--------|-------|-----------|-------------|
| 2024-10-23 | webinar-1week | [your-webinar-id] | [webinar-title] | pending | 2024-10-23 | | | | 1 week before webinar | system | 2024-10-23T12:00:00Z |
| 2024-10-23 | webinar-social-1week | [your-webinar-id] | [webinar-title] | pending | 2024-10-23 | | | | 1 week social post | system | 2024-10-23T12:00:00Z |

### For 1-day reminders (due October 29th):

| Date | ReminderType | WebinarId | WebinarTitle | Status | DueDate | CampaignId | DashboardLink | PostId | Notes | CreatedBy | LastUpdated |
|------|--------------|-----------|--------------|--------|---------|------------|---------------|--------|-------|-----------|-------------|
| 2024-10-29 | webinar-1day | [your-webinar-id] | [webinar-title] | pending | 2024-10-29 | | | | 1 day before webinar | system | 2024-10-23T12:00:00Z |
| 2024-10-29 | webinar-social-1day | [your-webinar-id] | [webinar-title] | pending | 2024-10-29 | | | | 1 day social post | system | 2024-10-23T12:00:00Z |

### For 1-hour reminders (due October 30th, 1 hour before):

| Date | ReminderType | WebinarId | WebinarTitle | Status | DueDate | CampaignId | DashboardLink | PostId | Notes | CreatedBy | LastUpdated |
|------|--------------|-----------|--------------|--------|---------|------------|---------------|--------|-------|-----------|-------------|
| 2024-10-30 | webinar-1hour | [your-webinar-id] | [webinar-title] | pending | 2024-10-30 | | | | 1 hour before webinar | system | 2024-10-23T12:00:00Z |
| 2024-10-30 | webinar-social-1hour | [your-webinar-id] | [webinar-title] | pending | 2024-10-30 | | | | 1 hour social post | system | 2024-10-23T12:00:00Z |

## After Adding Data

Once you populate the `ReminderTracking` tab:
- ✅ Dashboard will show webinar reminders
- ✅ Ticker will display upcoming webinar notifications
- ✅ Social media operations page will show webinar post reminders
- ✅ System can track reminder status and prevent duplicates

## Automation Note

In the future, you might want to create a function that automatically populates this tab when new webinars are added, but for now, manual entry will restore the reminder functionality.
