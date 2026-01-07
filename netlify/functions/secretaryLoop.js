// netlify/functions/secretaryLoop.js
// deploy-bump: 1767806061
// DIAGNOSTIC VERSION - will log exactly where it fails

function toBool(v) {
  return String(v || "").trim() === "1" || String(v || "").toLowerCase() === "true";
}

function nowIso() {
  return new Date().toISOString();
}

function addMinutesISO(mins) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function buildBaseUrl(event) {
  const site = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (site) return site.replace(/\/$/, "");

  const proto =
    event?.headers?.["x-forwarded-proto"] ||
    event?.headers?.["X-Forwarded-Proto"] ||
    "https";
  const host =
    event?.headers?.host ||
    event?.headers?.Host;

  return host ? `${proto}://${host}` : "https://49northcommandcenter.netlify.app";
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  const json = safeJsonParse(text);
  return { ok: res.ok, status: res.status, json, text };
}

function normalizePriority(p) {
  const s = String(p || "").toLowerCase();
  if (s === "code-red" || s === "code-yellow" || s === "code-green" || s === "code-white") return s;
  return "code-yellow";
}

function priorityToNotifyMins(priority) {
  const p = normalizePriority(priority);
  if (p === "code-red") return 15;
  if (p === "code-yellow") return 60;
  if (p === "code-green") return 240;
  if (p === "code-white") return 480;
  return 60;
}

function buildTaskRow({
  id,
  title,
  notes,
  priority = "code-yellow",
  dueAt,
  createdBy = "ExecutiveAssistant",
}) {
  const createdAt = nowIso();
  const p = normalizePriority(priority);
  const notifyEveryMins = priorityToNotifyMins(p);

  return [
    String(id),
    createdAt,
    createdBy,
    `Focus Task: ${title}`,
    title,
    "",
    notes || "",
    dueAt || "",
    "UTC",
    "",
    p,
    "open",
    "",
    String(notifyEveryMins),
  ];
}

exports.handler = async (event) => {
  // STEP 1: Log entry
  console.log("SECRETARY_LOOP_START", nowIso(), {
    path: event?.path,
    qs: event?.queryStringParameters || {},
  });

  try {
    const qs = event?.queryStringParameters || {};
    const dryRun = toBool(qs.dryRun);

    // STEP 2: Try requiring googleapis
    console.log("SECRETARY_LOOP: Requiring googleapis...");
    let google;
    try {
      const googleapis = require("googleapis");
      google = googleapis.google;
      console.log("SECRETARY_LOOP: googleapis loaded OK");
    } catch (err) {
      console.error("SECRETARY_LOOP: googleapis require FAILED", err.message);
      throw new Error(`Failed to load googleapis: ${err.message}`);
    }

    // STEP 3: Try requiring secrets
    console.log("SECRETARY_LOOP: Requiring secrets...");
    let getSecret;
    try {
      const secrets = require("./_utils/secrets");
      getSecret = secrets.getSecret;
      console.log("SECRETARY_LOOP: secrets loaded OK");
    } catch (err) {
      console.error("SECRETARY_LOOP: secrets require FAILED", err.message);
      throw new Error(`Failed to load secrets: ${err.message}`);
    }

    // STEP 4: Try requiring google auth
    console.log("SECRETARY_LOOP: Requiring google auth...");
    let getGoogleAuth;
    try {
      const googleUtils = require("./_utils/google");
      getGoogleAuth = googleUtils.getGoogleAuth;
      console.log("SECRETARY_LOOP: google auth loaded OK");
    } catch (err) {
      console.error("SECRETARY_LOOP: google auth require FAILED", err.message);
      throw new Error(`Failed to load google auth: ${err.message}`);
    }

    // STEP 5: Get sheet ID
    console.log("SECRETARY_LOOP: Getting sheet ID...");
    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");
    console.log("SECRETARY_LOOP: Sheet ID retrieved OK");

    const baseUrl = buildBaseUrl(event);
    console.log("SECRETARY_LOOP: Base URL:", baseUrl);

    // STEP 6: Fetch data
    console.log("SECRETARY_LOOP: Fetching data from endpoints...");
    const [bids, socials, webinars] = await Promise.all([
      fetchJson(`${baseUrl}/.netlify/functions/getBids`).catch(e => {
        console.error("SECRETARY_LOOP: getBids failed", e.message);
        return { ok: false, json: null };
      }),
      fetchJson(`${baseUrl}/.netlify/functions/getSocialMediaContent?limit=0`).catch(e => {
        console.error("SECRETARY_LOOP: getSocialMediaContent failed", e.message);
        return { ok: false, json: null };
      }),
      fetchJson(`${baseUrl}/.netlify/functions/getWebinars`).catch(e => {
        console.error("SECRETARY_LOOP: getWebinars failed", e.message);
        return { ok: false, json: null };
      }),
    ]);

    const bidSummary = bids?.json?.summary || {};
    const socialSummary = socials?.json?.summary || {};
    const webinarSummary = webinars?.json?.summary || {};

    const totalActiveBids = Number(bidSummary.totalActive || 0);
    const respondCount = Number(bidSummary.respondCount || 0);
    const gatherCount = Number(bidSummary.gatherInfoCount || 0);

    const socialScheduled = Number(socialSummary.scheduled || 0);
    const socialDrafts = Number(socialSummary.drafts || 0);

    const upcomingWebinars = Number(webinarSummary.upcomingCount || 0);

    console.log("SECRETARY_LOOP_INPUTS", {
      bids: { ok: bids.ok, status: bids.status, totalActiveBids, respondCount, gatherCount },
      social: { ok: socials.ok, status: socials.status, socialScheduled, socialDrafts },
      webinars: { ok: webinars.ok, status: webinars.status, upcomingWebinars },
    });

    // STEP 7: Generate focus tasks
    console.log("SECRETARY_LOOP: Generating focus tasks...");
    const focusTasks = [];

    if (totalActiveBids > 0) {
      focusTasks.push({
        id: "focus-bids",
        title: "Work on Bids",
        priority: respondCount > 0 ? "code-red" : "code-yellow",
        dueAt: addMinutesISO(60),
        notes: `We currently have ${totalActiveBids} active bids. Respond=${respondCount}, Gather=${gatherCount}.`,
      });
    }

    if (socialScheduled > 0 || socialDrafts > 0) {
      focusTasks.push({
        id: "focus-social",
        title: "Review Social Queue",
        priority: socialScheduled > 0 ? "code-yellow" : "code-green",
        dueAt: addMinutesISO(60),
        notes: `Social queue: Scheduled=${socialScheduled}, Drafts=${socialDrafts}.`,
      });
    }

    if (upcomingWebinars > 0) {
      focusTasks.push({
        id: "focus-webinars",
        title: "Prep Upcoming Webinars",
        priority: "code-yellow",
        dueAt: addMinutesISO(120),
        notes: `Upcoming webinars: ${upcomingWebinars}. Check registrations, reminders, and follow-ups.`,
      });
    }

    if (!focusTasks.length) {
      console.log("SECRETARY_LOOP_NO_TASKS");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun,
          generated: 0,
          upserted: 0,
          reason: "No rules triggered based on current data."
        }),
      };
    }

    console.log("SECRETARY_LOOP: Generated", focusTasks.length, "tasks");

    // STEP 8: Connect to Google Sheets
    console.log("SECRETARY_LOOP: Connecting to Google Sheets...");
    const googleAuth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });
    console.log("SECRETARY_LOOP: Google Sheets client created");

    // STEP 9: Read existing tasks
    console.log("SECRETARY_LOOP: Reading Tasks sheet...");
    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Tasks!A:Z",
    });

    const rows = read.data.values || [];
    if (!rows.length) throw new Error("Tasks tab is empty (missing header row)");

    const header = rows[0] || [];
    const data = rows.slice(1);

    const idIdx = header.indexOf("id");
    if (idIdx === -1) throw new Error("Tasks header missing required column: id");

    const statusIdx = header.indexOf("status");
    console.log("SECRETARY_LOOP: Read", data.length, "existing tasks");

    const findRow = (taskId) =>
      data.findIndex((r) => String(r[idIdx] || "") === String(taskId));

    // STEP 10: Upsert tasks
    console.log("SECRETARY_LOOP: Upserting tasks...");
    const batchUpdates = [];
    let upserted = 0;

    for (const t of focusTasks) {
      const existingIdx = findRow(t.id);

      if (existingIdx === -1) {
        console.log("SECRETARY_LOOP: Appending new task:", t.id);
        if (!dryRun) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Tasks!A1",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [buildTaskRow(t)] },
          });
        }
        upserted += 1;
      } else {
        const row = data[existingIdx] || [];
        const existingStatus =
          statusIdx === -1 ? "open" : String(row[statusIdx] || "").toLowerCase();

        if (existingStatus === "closed") {
          console.log("SECRETARY_LOOP: Skipping closed task:", t.id);
          continue;
        }

        console.log("SECRETARY_LOOP: Updating existing task:", t.id);
        const updated = new Array(header.length).fill("");

        for (let i = 0; i < header.length; i++) updated[i] = row[i] ?? "";

        const set = (colName, val) => {
          const idx = header.indexOf(colName);
          if (idx !== -1) updated[idx] = val;
        };

        set("title", t.title);
        set("rawText", `Focus Task: ${t.title}`);
        set("notes", t.notes || "");
        set("dueAt", t.dueAt || "");
        set("priority", normalizePriority(t.priority));
        set("notifyEveryMins", String(priorityToNotifyMins(t.priority)));
        set("status", "open");

        const sheetRowNumber = existingIdx + 2;
        batchUpdates.push({
          range: `Tasks!A${sheetRowNumber}:${String.fromCharCode(64 + header.length)}${sheetRowNumber}`,
          values: [updated],
        });

        upserted += 1;
      }
    }

    if (!dryRun && batchUpdates.length) {
      console.log("SECRETARY_LOOP: Executing batch update with", batchUpdates.length, "updates");
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batchUpdates,
        },
      });
    }

    console.log("SECRETARY_LOOP_DONE", { dryRun, generated: focusTasks.length, upserted });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        dryRun,
        generated: focusTasks.length,
        upserted,
        tasks: focusTasks,
      }),
    };
  } catch (err) {
    console.error("SECRETARY_LOOP_ERROR", err && err.stack ? err.stack : err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
      }),
    };
  }
};