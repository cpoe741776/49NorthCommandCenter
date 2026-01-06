const { google } = require("googleapis");
const { getAllTasks } = require("./secretary/lib/sheets");
const { sendPushover } = require("./secretary/lib/pushover");
const { getSecret } = require("./_utils/secrets");

function parseISO(s) {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

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
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function updateLastNotifiedAt(rowIndex1Based, colIndex1Based, isoString) {
  const spreadsheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const colLetter = colToLetter(colIndex1Based);
  const range = `Tasks!${colLetter}${rowIndex1Based}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[String(isoString || "")]] }
  });
}

exports.handler = async (event) => {
  try {
    const dryRun = event && event.queryStringParameters && event.queryStringParameters.dryRun === "1";

    const { header, data } = await getAllTasks();
    if (!header || header.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, message: "No header row in Tasks tab", scanned: 0, sent: 0 })
      };
    }

    const colIndex = (name) => header.indexOf(name);

    const idx = {
      title: colIndex("title"),
      dueAt: colIndex("dueAt"),
      status: colIndex("status"),
      lastNotifiedAt: colIndex("lastNotifiedAt"),
      notifyEveryMins: colIndex("notifyEveryMins")
    };

    const missing = Object.entries(idx).filter(([, v]) => v === -1).map(([k]) => k);
    if (missing.length) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing required columns", missing, header })
      };
    }

    const now = Date.now();
    let sent = 0;
    let scanned = 0;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      scanned++;

      const status = String(row[idx.status] || "").toLowerCase();
      if (status !== "open") continue;

      const dueAt = String(row[idx.dueAt] || "");
      const dueMs = parseISO(dueAt);
      if (!dueMs) continue;
      if (dueMs > now) continue;

      const title = String(row[idx.title] || "Task");
      const lastNotifiedMs = parseISO(String(row[idx.lastNotifiedAt] || "")) || 0;
      const everyMins = parseInt(String(row[idx.notifyEveryMins] || "60"), 10) || 60;

      const nextAllowed = lastNotifiedMs + everyMins * 60 * 1000;
      if (lastNotifiedMs && now < nextAllowed) continue;

      if (!dryRun) {
        await sendPushover(`Reminder: ${title}`, "Diana — Task Due");

        const sheetRow = r + 2; // header row + 1-based offset
        const sheetCol = idx.lastNotifiedAt + 1; // 1-based column index
        await updateLastNotifiedAt(sheetRow, sheetCol, new Date().toISOString());
      }

      sent++;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, scanned, sent, dryRun })
    };
  } catch (err) {
    console.log("secretaryRemindDue2 ERROR:", err && err.stack ? err.stack : err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        stage: "handler",
        error: String(err && err.message ? err.message : err)
      })
    };
  }
};
