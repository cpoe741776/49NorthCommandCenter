// netlify/functions/setExecutiveAssistantSettings.js
// Writes ExecutiveAssistant_Settings!A:B in SECRETARY_TASKS_SHEET_ID
// Accepts JSON body: { settings: { quietHoursEnabled, quietStart, quietEnd, quietTimeZone, quietMode } }

function safeStr(v) {
  return String(v ?? "").trim();
}

function isHHMM(s) {
  return /^(\d{1,2}):(\d{2})$/.test(String(s || "").trim());
}

exports.handler = async (event) => {
  try {
    const { google } = require("googleapis");
    const { getSecret } = require("./_utils/secrets");
    const { getGoogleAuth } = require("./_utils/google");

    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    const body = event?.body ? JSON.parse(event.body) : {};
    const incoming = body?.settings || {};

    // normalize + defaults
    const settings = {
      quietHoursEnabled: safeStr(incoming.quietHoursEnabled || "true"),
      quietStart: safeStr(incoming.quietStart || "21:00"),
      quietEnd: safeStr(incoming.quietEnd || "08:00"),
      quietTimeZone: safeStr(incoming.quietTimeZone || "Europe/London"),
      quietMode: safeStr(incoming.quietMode || "silent").toLowerCase(), // silent|suppress
    };

    if (!isHHMM(settings.quietStart)) throw new Error("quietStart must be HH:MM");
    if (!isHHMM(settings.quietEnd)) throw new Error("quietEnd must be HH:MM");
    if (!["silent", "suppress"].includes(settings.quietMode)) {
      throw new Error("quietMode must be 'silent' or 'suppress'");
    }

    const googleAuth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure sheet/tab exists: simplest safe approach is to attempt update anyway.
    // We write a whole A:B block:
    const rows = [
      ["key", "value"],
      ["quietHoursEnabled", settings.quietHoursEnabled],
      ["quietStart", settings.quietStart],
      ["quietEnd", settings.quietEnd],
      ["quietTimeZone", settings.quietTimeZone],
      ["quietMode", settings.quietMode],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "ExecutiveAssistant_Settings!A1:B6",
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, settings }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};
