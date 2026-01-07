// netlify/functions/createReminder.js
const { google } = require("googleapis");
const { getSecret } = require("./_utils/secrets");

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  }

  // Netlify multiline key handling
  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

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

    // Your Tasks headers (exact order):
    // id, createdAt, createdBy, rawText, title, contactEmail, notes, dueAt, tz,
    // recurrence, priority, status, lastNotifiedAt, notifyEveryMins
    const row = [
      Date.now().toString(),                // id
      createdAt,                            // createdAt
      "CommandApp",                         // createdBy
      `${safeType} Reminder: ${safeTitle}`, // rawText
      safeTitle,                            // title
      safeType === "CRM" ? String(contactEmail || "").trim() : "", // contactEmail
      safeNotes,                            // notes
      effectiveDueAt,                       // dueAt
      "UTC",                                // tz
      "",                                   // recurrence
      p,                                    // priority
      "open",                               // status
      "",                                   // lastNotifiedAt
      notifyEveryMins                       // notifyEveryMins
    ];

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

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
