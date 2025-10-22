# Brevo NOTES Custom Field Setup

## Overview
To store contact notes in Brevo (so they're accessible across all systems and survive potential migrations), you need to create a custom **NOTES** field in your Brevo account.

## Steps to Create NOTES Field in Brevo

### 1. Log into Brevo
- URL: https://app.brevo.com/
- Username: `chris@mymentalarmor.com`
- Password: `TechWerks1!!`

### 2. Navigate to Contacts > Settings
1. Click **Contacts** in the left sidebar
2. Click **Settings** (gear icon)
3. Select **Contact attributes**

### 3. Create NOTES Attribute
1. Click **"Create a new attribute"** button
2. Fill in the details:
   - **Attribute name**: `NOTES`
   - **Type**: `Text` (for multi-line text support)
   - **Category**: `Normal` (or create a "CRM" category if you prefer)
   - **Description**: `Contact notes and interactions history from Command Center CRM`
3. Click **"Create attribute"**

### 4. Verify Creation
- The `NOTES` field should now appear in your list of custom attributes
- It will be accessible via the Brevo API as `attributes.NOTES`

## How Notes Will Work

### In the Command Center App:
1. User clicks on a contact
2. Views existing notes (from Brevo `NOTES` field)
3. Can add new notes via "Add Note" button
4. Notes are appended with timestamp and stored in Brevo

### Note Format:
```
[2025-10-22 12:45 PM] First note here
[2025-10-23 09:30 AM] Follow-up call completed
[2025-10-24 02:15 PM] Sent proposal via email
```

### Benefits:
✅ **Centralized**: All notes in Brevo (not scattered across systems)  
✅ **Accessible**: View notes in Command Center app OR directly in Brevo  
✅ **Portable**: If you migrate from this app, notes stay in Brevo  
✅ **Searchable**: Brevo's search can find notes content  
✅ **Historical**: Notes are timestamped and preserved  

## After Creating the Field

Once you've created the `NOTES` field in Brevo, the Command Center app will:
1. Display existing notes in the contact detail modal
2. Allow adding new notes via the UI
3. Sync all notes to Brevo `NOTES` attribute
4. Keep the Google Sheets "Notes" tab as a backup/log

## Migration from Google Sheets (Optional)

If you have existing notes in the CRM Google Sheet:
1. We can create a migration function to copy old notes to Brevo `NOTES`
2. Format: Append timestamp to existing notes
3. One-time operation

**Would you like me to create this migration script after you've set up the field?**

## Technical Details

### API Field Name
- Internal name: `NOTES`
- API access: `contact.attributes.NOTES`
- Type: Text (multi-line string)

### Character Limit
- Brevo text fields support up to 64KB
- This allows for extensive note history per contact

### Implementation Files Updated
Once you create the field:
- ✅ `netlify/functions/addContactNote.js` - Syncs new notes to Brevo
- ✅ `netlify/functions/getContactDetail.js` - Fetches notes from Brevo
- ✅ `src/components/ContactDetailModal.jsx` - Displays notes in UI
- ✅ `netlify/functions/updateContact.js` - Updates notes when editing

---

**Next Step**: Create the `NOTES` field in Brevo using the steps above, then let me know and I'll update the app code to use it!

