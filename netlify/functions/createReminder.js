// netlify/functions/createReminder.js
const { google } = require("googleapis");
const { getSecrets } = require("./_utils/secrets");
const { auth } = require("./_utils/google");

const TASKS_HEADERS = [
  "id",
  "createdAt",
  "createdBy",
  "rawText",
  "title",
  "notes",
  "dueAt",
  "tz",
  "recurrence",
  "priority",
  "status",
  "lastNotifiedAt",
  "notifyEveryMins",
  "contactEmail" // keep only if your Tasks sheet has this column header
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const secrets = await getSecrets();
    const sheetId = secrets.SECRETARY_TASKS_SHEET_ID;
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    const body = JSON.parse(event.body || "{}");

    const {
      type = "Personal",
      title = "",
      notes = "",
      priority = "code-green",
      createdAt = new Date().toISOString(),
      contactEmail = "",
      dueAt // may be undefined/blank
    } = body;

    // Default: if dueAt isn't provided, start the loop immediately from createdAt.
    // If dueAt is a future timestamp, the reminder loop won't start until then.
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

    const row = [
      Date.now().toString(), // id
      createdAt,
      "CommandApp",
      `${safeType} Reminder: ${safeTitle}`, // rawText
      safeTitle,
      safeNotes,
      effectiveDueAt, // dueAt (defaults to createdAt)
      "UTC",
      "", // recurrence (reserved)
      p,
      "open",
      "", // lastNotifiedAt
      notifyEveryMins,
      safeType === "CRM" ? String(contactEmail || "").trim() : ""
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
