// netlify/functions/createReminder.js
const { google } = require("googleapis");
const { getSecret } = require("./_utils/secrets");
const { auth } = require("./_utils/google");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    const body = JSON.parse(event.body || "{}");

    const {
      type = "Personal",
      title = "",
      notes = "",
      priority = "code-green",
      createdAt = new Date().toISOString(),
      contactEmail = "",
      dueAt
    } = body;

    // If dueAt isn't provided, start immediately from createdAt.
    // If dueAt is in the future, the loop won't start until then.
    const effectiveDueAt =
      dueAt && String(dueAt).trim() ? String(dueAt).trim() : createdAt;

    const frequencyMap = {
      "code-red": 15,
      "code-yellow": 60,
      "code-green": 240,
      "code-white": 480
    };

    const p = String(priority || "code-green").toLowerCase();
    const notifyEveryMins = frequencyMap[p] || 240;

    const safeType = String(type || "Personal");
    const safeTitle = String(title || "").trim();
    const safeNotes = String(notes || "").trim();

    // NOTE: Your Tasks sheet headers you showed end at notifyEveryMins (no contactEmail).
    // If your sheet truly has no contactEmail column, remove the last element below.
    // For now, we keep it because you’ve planned CRM-linked reminders.
    const row = [
      Date.now().toString(),          // id
      createdAt,                      // createdAt
      "CommandApp",                   // createdBy
      `${safeType} Reminder: ${safeTitle}`, // rawText
      safeTitle,                      // title
      safeNotes,                      // notes
      effectiveDueAt,                 // dueAt
      "UTC",                          // tz
      "",                             // recurrence
      p,                              // priority
      "open",                         // status
      "",                             // lastNotifiedAt
      notifyEveryMins,                // notifyEveryMins
      safeType === "CRM" ? String(contactEmail || "").trim() : "" // contactEmail
    ];

    const authClient = await auth();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Tasks!A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error("❌ createReminder error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message || String(err) })
    };
  }
};
