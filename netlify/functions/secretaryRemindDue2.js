const { google } = require("googleapis");
const { sendPushover } = require("./secretary/lib/pushover");
const { getSecret } = require("./_utils/secrets");

// Simple ISO parser
function parseISO(s) {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// Column index (1-based) -> A/B/AA, etc.
function colToLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Auth using your bootstrap env vars
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
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Read all tasks from the Tasks tab
async function getAllTasks() {
  const spreadsheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Tasks!A:M",
  });

  const rows = res.data.values || [];
  if (rows.length < 2) {
    return { header: [], data: [] };
  }

  const [header, ...data] = rows;
  return { header, data, spreadsheetId };
}

exports.handler = async (event) => {
  const qs = (event && event.queryStringParameters) || {};
  const dryRun =
    qs.dryRun === "1" ||
    qs.dryRun === "true" ||
    qs.dryRun === "yes";

  try {
    const { header, data, spreadsheetId } = await getAllTasks();

    if (!header.length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          headerMissing: true,
          scanned: 0,
          sent: 0,
          dryRun,
        }),
      };
    }

    const colIndex = (name) => header.indexOf(name);

    const idx = {
      id: colIndex("id"),
      title: colIndex("title"),
      dueAt: colIndex("dueAt"),
      status: colIndex("status"),
      lastNotifiedAt: colIndex("lastNotifiedAt"),
      notifyEveryMins: colIndex("notifyEveryMins"),
    };

    const missing = Object.entries(idx)
      .filter(([, v]) => v === -1)
      .map(([k]) => k);

    if (missing.length) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing required columns",
          missing,
          header,
          dryRun,
        }),
      };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const now = Date.now();
    let scanned = 0;
    let sent = 0;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      scanned++;

      const status = String(row[idx.status] || "").toLowerCase();
      if (status !== "open") continue;

      const dueAtStr = String(row[idx.dueAt] || "");
      const dueMs = parseISO(dueAtStr);
      if (!dueMs) continue;
      if (dueMs > now) continue;

      const title = String(row[idx.title] || "Task");
      const lastNotifiedMs =
        parseISO(String(row[idx.lastNotifiedAt] || "")) || 0;
      const everyMins =
        parseInt(String(row[idx.notifyEveryMins] || "60"), 10) || 60;

      const nextAllowed = lastNotifiedMs + everyMins * 60 * 1000;
      if (lastNotifiedMs && now < nextAllowed) continue;

      if (!dryRun) {
        await sendPushover(`Reminder: ${title}`, "Diana — Task Due");

        const sheetRow = r + 2; // header row + 1-based
        const sheetCol = idx.lastNotifiedAt + 1; // 1-based column index
        const range = `Tasks!${colToLetter(sheetCol)}${sheetRow}`;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[new Date().toISOString()]] },
        });
      }

      sent++;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        scanned,
        sent,
        dryRun,
      }),
    };
  } catch (err) {
    console.error("SecretaryRemindDue2 ERROR:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
        stack: err && err.stack ? String(err.stack) : null,
        dryRun,
        stage: "top-level",
      }),
    };
  }
};
