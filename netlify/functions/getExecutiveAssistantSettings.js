// netlify/functions/getExecutiveAssistantSettings.js
// Reads ExecutiveAssistant_Settings!A:B from SECRETARY_TASKS_SHEET_ID

function safeStr(v) {
  return String(v ?? "").trim();
}

exports.handler = async () => {
  try {
    const { google } = require("googleapis");
    const { getSecret } = require("./_utils/secrets");
    const { getGoogleAuth } = require("./_utils/google");

    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    const googleAuth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Try read
    let values = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "ExecutiveAssistant_Settings!A:B",
      });
      values = res.data.values || [];
    } catch {
      // tab might not exist yet
      values = [];
    }

    const settings = {
      quietHoursEnabled: "true",
      quietStart: "21:00",
      quietEnd: "08:00",
      quietTimeZone: "Europe/London",
      quietMode: "silent", // silent | suppress
    };

    // If sheet has rows: [key, value]
    for (const r of values.slice(1)) {
      const k = safeStr(r?.[0]);
      const v = safeStr(r?.[1]);
      if (k) settings[k] = v;
    }

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
