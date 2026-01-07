// netlify/functions/secretaryLoop.js
// Hourly Executive Assistant auto-task generator (rules-based, no approvals)
// - Creates "focus tasks" in Secretary Tasks -> Tasks tab
// - Dedupe: 1 task per key per day via fingerprint in rawText
// - Safe: reads other sheets, appends only if missing

const { google } = require("googleapis");
const { getSecret } = require("./_utils/secrets");
const { getGoogleAuth } = require("./_utils/google");

// ---- helpers ----
function isTrue(v) {
  return v === "1" || String(v || "").toLowerCase() === "true";
}

function ymdUtc(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateLoose(s) {
  const t = Date.parse(String(s || ""));
  return Number.isFinite(t) ? new Date(t) : null;
}

// Social rows often store date/time as strings. Try a couple patterns.
function parseSocialWhen(scheduleDate, scheduleTime) {
  const d = String(scheduleDate || "").trim();
  const t = String(scheduleTime || "").trim();
  if (!d && !t) return null;

  // If scheduleDate is already ISO-like, Date.parse will handle it.
  let dt = parseDateLoose(d);
  if (dt && !t) return dt;

  // Common: "YYYY-MM-DD" + "HH:mm"
  if (d && t && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const isoish = `${d}T${t.length === 5 ? t : t + ":00"}:00Z`;
    const dt2 = parseDateLoose(isoish);
    if (dt2) return dt2;
  }

  // Fallback: concatenate
  return parseDateLoose(`${d} ${t}`) || dt;
}

function nonEmptyRow(row) {
  return row && row.length && row.some((c) => String(c || "").trim() !== "");
}



function priorityToNotifyEveryMins(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "code-red") return 15;
  if (p === "code-yellow") return 60;
  if (p === "code-green") return 240;
  if (p === "code-white") return 480;
  return 240;
}

async function getSheetsClient(scopes) {
  const googleAuth = getGoogleAuth(scopes || ["https://www.googleapis.com/auth/spreadsheets"]);
  const auth = await googleAuth.getClient();
  return google.sheets({ version: "v4", auth });
}

// ---- Tasks sheet IO ----
async function getTasksSheetId() {
  const id = await getSecret("SECRETARY_TASKS_SHEET_ID");
  if (!id) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");
  return id;
}

async function fetchTasksHeaderAndData(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Tasks!A:Z",
  });

  const rows = res.data.values || [];
  if (!rows.length) return { header: [], data: [] };
  const [header, ...data] = rows;
  return { header, data };
}

function indexOfHeader(header, name) {
  return header.indexOf(name);
}

function rowFromObjectByHeader(header, obj) {
  return header.map((h) => (obj[h] == null ? "" : String(obj[h])));
}

async function appendTaskRows(sheets, spreadsheetId, rows) {
  if (!rows.length) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Tasks!A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: rows,
    },
  });
}

// ---- Rules: gather “focus tasks” from other sheets ----
async function computeFocusTasks(sheets, todayYmd, now, env) {
  const tasks = [];

  // --- 1) Bids focus task ---
  // GOOGLE_SHEET_ID is your Bids Intelligence sheet
  if (env.GOOGLE_SHEET_ID) {
    try {
      const bidRes = await sheets.spreadsheets.values.get({
        spreadsheetId: env.GOOGLE_SHEET_ID,
        range: "Active_Bids!A2:U",
      });

      const rows = (bidRes.data.values || []).filter(nonEmptyRow);
      const total = rows.length;

      // Recommendation is column A (index 0)
      const recKey = (v) => String(v || "").trim().toLowerCase();
      const respond = rows.filter((r) => recKey(r[0]) === "respond").length;
      const gather = rows.filter((r) => recKey(r[0]) === "gather more information").length;

      if (total > 0) {
        const key = "focus-bids";
        const fingerprint = `[AUTO|${key}|${todayYmd}]`;

        tasks.push({
          key,
          fingerprint,
          title: "Work on Bids",
          notes: `We have ${total} active bids (${respond} respond, ${gather} gather). Review the top ones, confirm due dates, and update status/actions.`,
          priority: "code-yellow",
          // due now, so your remind-due function can start the cadence
          dueAt: now.toISOString(),
        });
      }
    } catch (e) {
      console.warn("[secretaryLoop] Bids rule failed:", e.message);
    }
  }

  // --- 2) Social content focus task ---
  if (env.SOCIAL_MEDIA_SHEET_ID) {
    try {
      const socialRes = await sheets.spreadsheets.values.get({
        spreadsheetId: env.SOCIAL_MEDIA_SHEET_ID,
        range: "MainPostData!A2:U",
      });

      const rows = (socialRes.data.values || []).filter(nonEmptyRow);

      // Based on your getSocialMediaContent.js mapping:
      // status: col B (index 1)
      // scheduleDate: col I (index 8)
      // publishedDate: col J (index 9)
      const scheduled = rows.filter((r) => String(r[1] || "").trim().toLowerCase() === "scheduled");

      const overdue = scheduled.filter((r) => {
        const when = parseSocialWhen(r[8], null) || parseDateLoose(r[8]);
        const published = String(r[9] || "").trim();
        if (published) return false;
        return when ? when.getTime() <= now.getTime() : false;
      });

      if (scheduled.length > 0) {
        const key = "focus-social";
        const fingerprint = `[AUTO|${key}|${todayYmd}]`;

        tasks.push({
          key,
          fingerprint,
          title: "Review Social Media Queue",
          notes: `You have ${scheduled.length} scheduled social post(s). ${overdue.length ? `${overdue.length} appear overdue.` : "None appear overdue."} Review schedule + publish pipeline.`,
          priority: overdue.length ? "code-yellow" : "code-green",
          dueAt: now.toISOString(),
        });
      }
    } catch (e) {
      console.warn("[secretaryLoop] Social rule failed:", e.message);
    }
  }

  // --- 3) Webinars focus task (next 14 days) ---
  if (env.WEBINAR_SHEET_ID) {
    try {
      const webRes = await sheets.spreadsheets.values.get({
        spreadsheetId: env.WEBINAR_SHEET_ID,
        range: "Webinars!A2:L",
      });

      const rows = (webRes.data.values || []).filter(nonEmptyRow);

      // From your getWebinars.js:
      // date col C (index 2), time col D (index 3), status col G (index 6), title col B (index 1)
      const upcoming = rows
        .map((r) => {
          const dateStr = String(r[2] || "").trim();
          const timeStr = String(r[3] || "").trim();
          const status = String(r[6] || "").trim().toLowerCase();
          const title = String(r[1] || "").trim();

          // Best-effort parse:
          const dt = parseDateLoose(`${dateStr} ${timeStr || "12:00"}`) || parseDateLoose(dateStr);
          return { title, status, dt };
        })
        .filter((w) => w.dt && w.status === "upcoming")
        .filter((w) => {
          const diffDays = Math.ceil((w.dt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          return diffDays >= 0 && diffDays <= 14;
        })
        .sort((a, b) => a.dt.getTime() - b.dt.getTime());

      if (upcoming.length > 0) {
        const soonest = upcoming[0];
        const key = "focus-webinars";
        const fingerprint = `[AUTO|${key}|${todayYmd}]`;

        tasks.push({
          key,
          fingerprint,
          title: "Prep Upcoming Webinars",
          notes: `${upcoming.length} webinar(s) in the next 14 days. Next: "${soonest.title}" on ${soonest.dt.toISOString()}. Confirm comms + social cadence.`,
          priority: "code-green",
          dueAt: now.toISOString(),
        });
      }
    } catch (e) {
      console.warn("[secretaryLoop] Webinars rule failed:", e.message);
    }
  }

  return tasks;
}

// ---- main handler ----
exports.handler = async (event) => {
  const startedAt = new Date().toISOString();

  try {
    const query = (event && event.queryStringParameters) || {};
    const dryRun = isTrue(query.dryRun);

    const now = new Date();
    const todayYmd = ymdUtc(now);

    console.log("SECRETARY_LOOP_START", startedAt, { dryRun, todayYmd, query });

    const tasksSheetId = await getTasksSheetId();
    const sheets = await getSheetsClient(["https://www.googleapis.com/auth/spreadsheets"]);

    // Load Tasks sheet (for header + dedupe scan)
    const { header, data } = await fetchTasksHeaderAndData(sheets, tasksSheetId);

    if (!header.length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun,
          note: "Tasks sheet has no header row",
          startedAt,
        }),
      };
    }

    const rawTextIdx = indexOfHeader(header, "rawText");
    if (rawTextIdx === -1) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Tasks sheet missing required column: rawText",
          header,
        }),
      };
    }

    const existingRawTexts = new Set(
      data
        .map((r) => String((r && r[rawTextIdx]) || "").trim())
        .filter(Boolean)
    );

    // Compute focus tasks
    const focusTasks = await computeFocusTasks(
      sheets,
      todayYmd,
      now,
      {
        GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
        SOCIAL_MEDIA_SHEET_ID: process.env.SOCIAL_MEDIA_SHEET_ID,
        WEBINAR_SHEET_ID: process.env.WEBINAR_SHEET_ID,
      }
    );

    // Build rows to append (deduped)
    const created = [];
    const skipped = [];

    const rowsToAppend = [];
    for (const t of focusTasks) {
      const rawText = `${t.fingerprint} ${t.title}`;
      const already = existingRawTexts.has(rawText);

      if (already) {
        skipped.push({ key: t.key, reason: "dedupe-hit" });
        continue;
      }

      const priority = t.priority || "code-green";
      const notifyEveryMins = priorityToNotifyEveryMins(priority);

      // Build task object in the exact header order (robust to column reordering)
      const taskObj = {
        id: `auto-${t.key}-${todayYmd}`, // stable daily id per key
        createdAt: now.toISOString(),
        createdBy: "SecretaryLoop",
        rawText,
        title: t.title,
        contactEmail: "",
        notes: t.notes || "",
        dueAt: t.dueAt || now.toISOString(),
        tz: "UTC",
        recurrence: "",
        priority,
        status: "open",
        lastNotifiedAt: "",
        notifyEveryMins: String(notifyEveryMins),
      };

      const row = rowFromObjectByHeader(header, taskObj);
      rowsToAppend.push(row);
      created.push({ key: t.key, title: t.title, priority });
    }

    if (!dryRun && rowsToAppend.length) {
      await appendTaskRows(sheets, tasksSheetId, rowsToAppend);
    }

    console.log("SECRETARY_LOOP_DONE", {
      dryRun,
      created: created.length,
      skipped: skipped.length,
      keysCreated: created.map((x) => x.key),
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        dryRun,
        startedAt,
        todayYmd,
        created,
        skipped,
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
