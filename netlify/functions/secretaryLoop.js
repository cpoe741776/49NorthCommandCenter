// netlify/functions/secretaryLoop.js
// Hourly Executive Assistant focus-task generator
// - Reads other sheets (Bids/Webinars/Social) and writes "focus tasks" into Secretary Tasks -> Tasks tab
// - Deletes prior auto-generated focus tasks each run (keeps the list clean, avoids duplicates)
// - Supports dryRun=1

exports.handler = async (event) => {
  const startedAt = new Date().toISOString();

  try {
    const query = (event && event.queryStringParameters) || {};
    const dryRun =
      query.dryRun === "1" || String(query.dryRun || "").toLowerCase() === "true";

    console.log("SECRETARY_LOOP_START", startedAt, { dryRun, query });

    // Require inside handler so module-load errors are caught
    const { google } = require("googleapis");
    const { getSecret } = require("./_utils/secrets");

    // ---- helpers ----
    function nonEmptyRow(row) {
      return Array.isArray(row) && row.some((c) => String(c || "").trim() !== "");
    }

    function parseISO(s) {
      const t = Date.parse(String(s || ""));
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

      privateKey = privateKey.replace(/\\n/g, "\n");

      return new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    }

    async function getTasksSheetId() {
      return getSecret("SECRETARY_TASKS_SHEET_ID");
    }

    async function getSheetsClient() {
      const auth = getAuth();
      return google.sheets({ version: "v4", auth });
    }

    // ---- read Tasks sheet (header + data) ----
    async function readTasksTable(sheets, spreadsheetId) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Tasks!A:Z",
      });

      const rows = res.data.values || [];
      if (!rows.length) return { header: [], data: [] };
      const [header, ...data] = rows;
      return { header, data };
    }

    // ---- delete rows (by sheet row index) ----
    async function deleteSheetRows(sheets, spreadsheetId, sheetName, rowIndexes1Based) {
      if (!rowIndexes1Based.length) return;

      // Need sheetId numeric for deleteDimension
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(sheetId,title))",
      });

      const sheet = (meta.data.sheets || []).find(
        (s) => s?.properties?.title === sheetName
      );
      if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

      const sheetId = sheet.properties.sheetId;

      // Delete from bottom up so indices don’t shift
      const sorted = rowIndexes1Based
        .slice()
        .sort((a, b) => b - a);

      const requests = sorted.map((row1) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: row1 - 1, // 0-based inclusive
            endIndex: row1, // 0-based exclusive
          },
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }

    // ---- append rows to Tasks ----
    async function appendTaskRows(sheets, spreadsheetId, rows) {
      if (!rows.length) return;

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Tasks!A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
    }

    // ---- build an output row matching the live header order ----
    function buildRowFromHeader(header, task) {
      const idx = (name) => header.indexOf(name);

      const required = [
        "id",
        "createdAt",
        "createdBy",
        "rawText",
        "title",
        "contactEmail",
        "notes",
        "dueAt",
        "tz",
        "recurrence",
        "priority",
        "status",
        "lastNotifiedAt",
        "notifyEveryMins",
      ];

      const missing = required.filter((k) => idx(k) === -1);
      if (missing.length) {
        throw new Error(
          `Tasks header missing required columns: ${missing.join(", ")}`
        );
      }

      // Create empty row sized to header length
      const row = new Array(header.length).fill("");

      const set = (name, val) => {
        row[idx(name)] = val == null ? "" : String(val);
      };

      set("id", task.id);
      set("createdAt", task.createdAt);
      set("createdBy", task.createdBy);
      set("rawText", task.rawText);
      set("title", task.title);
      set("contactEmail", task.contactEmail || "");
      set("notes", task.notes || "");
      set("dueAt", task.dueAt || "");
      set("tz", task.tz || "UTC");
      set("recurrence", task.recurrence || "");
      set("priority", task.priority || "code-yellow");
      set("status", task.status || "open");
      set("lastNotifiedAt", task.lastNotifiedAt || "");
      set("notifyEveryMins", task.notifyEveryMins || "60");

      return row;
    }

    // ---- source reads (minimal counts only) ----
    async function countActiveBids(sheets) {
      const bidSheetId = process.env.GOOGLE_SHEET_ID;
      if (!bidSheetId) return { total: 0, respond: 0, gather: 0 };

      // Recommendations live in Active_Bids col A
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: bidSheetId,
        range: "Active_Bids!A2:A",
      });

      const rows = (res.data.values || []).filter(nonEmptyRow);
      const total = rows.length;

      const norm = (s) => String(s || "").trim().toLowerCase();
      const respond = rows.filter((r) => norm(r[0]) === "respond").length;
      const gather = rows.filter((r) => norm(r[0]) === "gather more information").length;

      return { total, respond, gather };
    }

    async function countUpcomingWebinars(sheets) {
      const webinarSheetId = process.env.WEBINAR_SHEET_ID;
      if (!webinarSheetId) return { upcoming: 0 };

      // Webinars!G is status in your getWebinars mapping (Upcoming/Completed)
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: webinarSheetId,
        range: "Webinars!G2:G",
      });

      const rows = (res.data.values || []).filter(nonEmptyRow);
      const norm = (s) => String(s || "").trim().toLowerCase();
      const upcoming = rows.filter((r) => norm(r[0]) === "upcoming").length;

      return { upcoming };
    }

    async function countSocialStatuses(sheets) {
      const socialSheetId = process.env.SOCIAL_MEDIA_SHEET_ID;
      if (!socialSheetId) return { scheduled: 0, drafts: 0 };

      // MainPostData!B is status per getSocialMediaContent mapping
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: socialSheetId,
        range: "MainPostData!B2:B",
      });

      const rows = (res.data.values || []).filter(nonEmptyRow);
      const norm = (s) => String(s || "").trim().toLowerCase();

      const scheduled = rows.filter((r) => norm(r[0]) === "scheduled").length;
      const drafts = rows.filter((r) => norm(r[0]) === "draft").length;

      return { scheduled, drafts };
    }

    // ---- main ----
    const sheets = await getSheetsClient();
    const tasksSheetId = await getTasksSheetId();
    if (!tasksSheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID (secret)");

    // Read current Tasks
    const { header, data } = await readTasksTable(sheets, tasksSheetId);
    if (!header.length) {
      throw new Error("Tasks sheet missing header row (Tasks!A1:Z1)");
    }

    // Delete prior auto-focus tasks (createdBy === AutoSecretary OR rawText contains AUTO_FOCUS)
    const createdByIdx = header.indexOf("createdBy");
    const rawTextIdx = header.indexOf("rawText");

    if (createdByIdx === -1 || rawTextIdx === -1) {
      throw new Error("Tasks sheet must include createdBy and rawText columns");
    }

    const autoRows1Based = [];
    for (let r = 0; r < data.length; r++) {
      const row = data[r] || [];
      const createdBy = String(row[createdByIdx] || "");
      const rawText = String(row[rawTextIdx] || "");
      const isAuto =
        createdBy === "AutoSecretary" || rawText.includes("AUTO_FOCUS:");
      if (isAuto) {
        const sheetRow = r + 2; // header row + 1-based
        autoRows1Based.push(sheetRow);
      }
    }

    // Gather source metrics
    const [bids, webinars, social] = await Promise.all([
      countActiveBids(sheets),
      countUpcomingWebinars(sheets),
      countSocialStatuses(sheets),
    ]);

    console.log("SECRETARY_LOOP_SOURCE_COUNTS", { bids, webinars, social });

    // Build focus tasks based on rules (no approvals)
    const now = new Date();
    now.setSeconds(0, 0);
    const dueAt = now.toISOString();

    const focusTasks = [];

    if (bids.total > 0) {
      focusTasks.push({
        key: "bids",
        title: "Work on Bids",
        notes: `We currently have ${bids.total} active bids. Respond: ${bids.respond}. Gather more info: ${bids.gather}.`,
        priority: "code-yellow",
        notifyEveryMins: "60",
      });
    }

    if (webinars.upcoming > 0) {
      focusTasks.push({
        key: "webinars",
        title: "Prep Upcoming Webinars",
        notes: `We have ${webinars.upcoming} upcoming webinars. Review agenda, panel/guest needs, and reminder cadence.`,
        priority: "code-yellow",
        notifyEveryMins: "60",
      });
    }

    if (social.scheduled > 0 || social.drafts > 0) {
      focusTasks.push({
        key: "social",
        title: "Review Social Media Pipeline",
        notes: `Scheduled posts: ${social.scheduled}. Drafts: ${social.drafts}. Confirm messaging, assets, and schedule timing.`,
        priority: "code-yellow",
        notifyEveryMins: "60",
      });
    }

    // Convert to sheet rows in correct header order
    const createdAt = new Date().toISOString();
    const rowsToAppend = focusTasks.map((t) => {
      const id = `auto-${Date.now()}-${t.key}`;
      return buildRowFromHeader(header, {
        id,
        createdAt,
        createdBy: "AutoSecretary",
        rawText: `AUTO_FOCUS:${t.key}`,
        title: t.title,
        contactEmail: "",
        notes: t.notes,
        dueAt,
        tz: "UTC",
        recurrence: "",
        priority: t.priority,
        status: "open",
        lastNotifiedAt: "",
        notifyEveryMins: t.notifyEveryMins,
      });
    });

    if (dryRun) {
      console.log("SECRETARY_LOOP_DRYRUN", {
        wouldDeleteRows: autoRows1Based.length,
        wouldAppend: rowsToAppend.length,
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun: true,
          startedAt,
          wouldDeleteRows: autoRows1Based.length,
          wouldAppend: rowsToAppend.length,
          sourceCounts: { bids, webinars, social },
          sampleAppendTitles: focusTasks.map((t) => t.title),
        }),
      };
    }

    // Apply changes: delete old auto tasks, then append new ones
    if (autoRows1Based.length) {
      await deleteSheetRows(sheets, tasksSheetId, "Tasks", autoRows1Based);
    }

    if (rowsToAppend.length) {
      await appendTaskRows(sheets, tasksSheetId, rowsToAppend);
    }

    console.log("SECRETARY_LOOP_DONE", {
      deleted: autoRows1Based.length,
      appended: rowsToAppend.length,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        dryRun: false,
        startedAt,
        deleted: autoRows1Based.length,
        appended: rowsToAppend.length,
        sourceCounts: { bids, webinars, social },
      }),
    };
  } catch (err) {
    console.error("SECRETARY_LOOP_ERROR", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
        stack: err && err.stack ? String(err.stack) : null,
        startedAt,
      }),
    };
  }
};
