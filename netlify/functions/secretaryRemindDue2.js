exports.handler = async (event) => {
  const startedAt = new Date().toISOString();

  try {
    const query = (event && event.queryStringParameters) || {};
    console.log("SECRETARY_REMIND_DUE2_START", startedAt, query);

    // Require inside the handler so module-load errors get caught by our try/catch
    const { google } = require("googleapis");
    const { getSecret } = require("./_utils/secrets");
    const { sendPushover } = require("./secretary/lib/pushover");

    function parseISO(s) {
      if (!s) return null;
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

      if (!clientEmail || !privateKey) {
        throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
      }

      // Netlify-style multiline key handling
      privateKey = privateKey.replace(/\\n/g, "\n");

      return new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });
    }

    async function getTasksSheetId() {
      // Loaded from 49N_Secrets tab
      return getSecret("SECRETARY_TASKS_SHEET_ID");
    }

    async function getTasks() {
      const spreadsheetId = await getTasksSheetId();
      const auth = getAuth();
      const sheets = google.sheets({ version: "v4", auth });

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Tasks!A:Z"
      });

      const rows = res.data.values || [];
      if (!rows.length) {
        return { header: [], data: [] };
      }

      const [header, ...data] = rows;
      return { header, data };
    }

    async function updateLastNotifiedAt(rowIndex1Based, colIndex1Based, isoString) {
      const spreadsheetId = await getTasksSheetId();
      const auth = getAuth();
      const sheets = google.sheets({ version: "v4", auth });

      const colLetter = colToLetter(colIndex1Based);
      const range = `Tasks!${colLetter}${rowIndex1Based}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[isoString || ""]] }
      });
    }

    const dryRun =
      query.dryRun === "1" ||
      (query.dryRun || "").toLowerCase() === "true";

    const { header, data } = await getTasks();
    if (!header.length) {
      console.log("SECRETARY_REMIND_DUE2_NO_HEADER");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, scanned: 0, sent: 0, dryRun, note: "no header row" })
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

    const missing = Object.entries(idx)
      .filter(([, v]) => v === -1)
      .map(([k]) => k);

    if (missing.length) {
      console.log("SECRETARY_REMIND_DUE2_MISSING_COLS", { missing, header });
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing required columns",
          missing,
          header
        })
      };
    }

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
      if (dueMs > now) continue; // not due yet

      const title = String(row[idx.title] || "Task");

      const lastNotifiedMs =
        parseISO(String(row[idx.lastNotifiedAt] || "")) || 0;
      const everyMins =
        parseInt(String(row[idx.notifyEveryMins] || "60"), 10) || 60;
      const nextAllowed = lastNotifiedMs + everyMins * 60 * 1000;
      if (lastNotifiedMs && now < nextAllowed) continue;

      if (!dryRun) {
        await sendPushover(`Reminder: ${title}`, "Diana — Task Due");

        const sheetRow = r + 2; // account for header row
        const sheetCol = idx.lastNotifiedAt + 1; // 1-based column index
        await updateLastNotifiedAt(
          sheetRow,
          sheetCol,
          new Date().toISOString()
        );
      }

      sent++;
    }

    console.log("SECRETARY_REMIND_DUE2_DONE", { scanned, sent, dryRun });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, scanned, sent, dryRun })
    };
  } catch (err) {
    console.error("SECRETARY_REMIND_DUE2_ERROR", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
        stack: err && err.stack ? String(err.stack) : null,
        startedAt
      })
    };
  }
};
