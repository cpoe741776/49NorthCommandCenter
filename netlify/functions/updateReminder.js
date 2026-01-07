// netlify/functions/updateReminder.js
const { google } = require("googleapis");
const { corsHeaders, methodGuard, ok, serverErr } = require("./_utils/http");
const { getSecret } = require("./_utils/secrets");

function colToLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

function parseISO(s) {
  const t = Date.parse(String(s || ""));
  return Number.isFinite(t) ? t : null;
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, "POST", "OPTIONS");
  if (guard) return guard;

  try {
    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    const body = JSON.parse(event.body || "{}");
    const { id, action, dueAt } = body;

    if (!id) throw new Error("Missing id");
    if (!action) throw new Error("Missing action (complete|reschedule)");

    const act = String(action).toLowerCase();

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Read Tasks (to find row index + column indexes)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Tasks!A:Z"
    });

    const rows = res.data.values || [];
    if (!rows.length) throw new Error("Tasks sheet is empty");

    const [header, ...data] = rows;
    const idx = (name) => header.indexOf(name);

    const col = {
      id: idx("id"),
      dueAt: idx("dueAt"),
      status: idx("status"),
      lastNotifiedAt: idx("lastNotifiedAt")
    };

    const missing = Object.entries(col)
      .filter(([, v]) => v === -1)
      .map(([k]) => k);

    if (missing.length) {
      throw new Error(`Missing required columns: ${missing.join(", ")}`);
    }

    // Find row by id (data is 0-based; sheet row is +2 to account for header)
    const r = data.findIndex((row) => String(row[col.id] || "") === String(id));
    if (r === -1) throw new Error(`Task id not found: ${id}`);

    const sheetRow1Based = r + 2; // header row + 1-based
    const sheetRow0BasedForDelete = sheetRow1Based - 1; // Sheets API deleteDimension uses 0-based indices

    if (act === "complete") {
      // ✅ DELETE the row from the sheet (hard remove)
      // NOTE: This requires the actual sheet/tabId, not the name.
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });

      const tasksSheet = (meta.data.sheets || []).find(
        (s) => s.properties && s.properties.title === "Tasks"
      );
      const sheetTabId = tasksSheet?.properties?.sheetId;
      if (sheetTabId == null) throw new Error("Could not find sheetId for tab 'Tasks'");

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetTabId,
                  dimension: "ROWS",
                  startIndex: sheetRow0BasedForDelete, // inclusive
                  endIndex: sheetRow0BasedForDelete + 1 // exclusive
                }
              }
            }
          ]
        }
      });

      return ok(headers, { success: true, deleted: true });
    }

    if (act === "reschedule") {
      const dueMs = parseISO(dueAt);
      if (!dueMs) throw new Error("Invalid dueAt (must be ISO date string)");

      const dueColLetter = colToLetter(col.dueAt + 1);
      const lastColLetter = colToLetter(col.lastNotifiedAt + 1);
      const statusColLetter = colToLetter(col.status + 1);

      const updates = [
        { range: `Tasks!${dueColLetter}${sheetRow1Based}`, values: [[String(dueAt)]] },
        { range: `Tasks!${lastColLetter}${sheetRow1Based}`, values: [[""]] },
        { range: `Tasks!${statusColLetter}${sheetRow1Based}`, values: [["open"]] }
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates
        }
      });

      return ok(headers, { success: true });
    }

    throw new Error("Unknown action. Use 'complete' or 'reschedule'.");
  } catch (err) {
    console.error("❌ updateReminder error:", err);
    return serverErr(headers, err.message || String(err));
  }
};
