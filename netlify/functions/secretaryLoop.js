// netlify/functions/secretaryLoop.js
// deploy-bump: 1767806062
// Ultra-defensive version with fetch fallback

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

// Fetch with fallback for older Node versions
async function fetchJson(url, opts) {
  let fetchFn;
  
  if (typeof fetch !== "undefined") {
    fetchFn = fetch;
  } else {
    // Fallback for Node < 18
    try {
      const nodeFetch = require("node-fetch");
      fetchFn = nodeFetch;
    } catch {
      throw new Error("fetch not available and node-fetch not installed");
    }
  }
  
  const res = await fetchFn(url, opts);
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
  // Wrap EVERYTHING in try-catch
  let logPrefix = "SECRETARY_LOOP";
  
  try {
    console.log(`${logPrefix}_START`, nowIso());
    
    const qs = event?.queryStringParameters || {};
    const dryRun = toBool(qs.dryRun);
    console.log(`${logPrefix}: dryRun=${dryRun}`);

    console.log(`${logPrefix}: Loading googleapis...`);
    const googleapis = require("googleapis");
    const google = googleapis.google;
    console.log(`${logPrefix}: googleapis OK`);

    console.log(`${logPrefix}: Loading secrets...`);
    const secrets = require("./_utils/secrets");
    const getSecret = secrets.getSecret;
    console.log(`${logPrefix}: secrets OK`);

    console.log(`${logPrefix}: Loading google auth...`);
    const googleUtils = require("./_utils/google");
    const getGoogleAuth = googleUtils.getGoogleAuth;
    console.log(`${logPrefix}: google auth OK`);

    console.log(`${logPrefix}: Getting sheet ID...`);
    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");
    console.log(`${logPrefix}: Sheet ID OK:`, sheetId.substring(0, 10) + "...");

    const baseUrl = buildBaseUrl(event);
    console.log(`${logPrefix}: Base URL:`, baseUrl);

    console.log(`${logPrefix}: Fetching endpoint data...`);
    
    const [bids, socials, webinars] = await Promise.allSettled([
      fetchJson(`${baseUrl}/.netlify/functions/getBids`),
      fetchJson(`${baseUrl}/.netlify/functions/getSocialMediaContent?limit=0`),
      fetchJson(`${baseUrl}/.netlify/functions/getWebinars`),
    ]);

    console.log(`${logPrefix}: Fetch results:`, {
      bids: bids.status,
      socials: socials.status,
      webinars: webinars.status,
    });

    const bidsData = bids.status === "fulfilled" ? bids.value : { ok: false, json: null };
    const socialsData = socials.status === "fulfilled" ? socials.value : { ok: false, json: null };
    const webinarsData = webinars.status === "fulfilled" ? webinars.value : { ok: false, json: null };

    const bidSummary = bidsData?.json?.summary || {};
    const socialSummary = socialsData?.json?.summary || {};
    const webinarSummary = webinarsData?.json?.summary || {};

    const totalActiveBids = Number(bidSummary.totalActive || 0);
    const respondCount = Number(bidSummary.respondCount || 0);
    const gatherCount = Number(bidSummary.gatherInfoCount || 0);

    const socialScheduled = Number(socialSummary.scheduled || 0);
    const socialDrafts = Number(socialSummary.drafts || 0);

    const upcomingWebinars = Number(webinarSummary.upcomingCount || 0);

    console.log(`${logPrefix}_INPUTS`, {
      bids: { ok: bidsData.ok, totalActiveBids, respondCount, gatherCount },
      social: { ok: socialsData.ok, socialScheduled, socialDrafts },
      webinars: { ok: webinarsData.ok, upcomingWebinars },
    });

    console.log(`${logPrefix}: Generating focus tasks...`);
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

    console.log(`${logPrefix}: Generated ${focusTasks.length} tasks`);

    if (!focusTasks.length) {
      console.log(`${logPrefix}_NO_TASKS`);
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

    console.log(`${logPrefix}: Connecting to Google Sheets...`);
    const googleAuth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });
    console.log(`${logPrefix}: Google Sheets client created`);

    console.log(`${logPrefix}: Reading Tasks sheet...`);
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
    console.log(`${logPrefix}: Read ${data.length} existing tasks`);

    const findRow = (taskId) =>
      data.findIndex((r) => String(r[idIdx] || "") === String(taskId));

    console.log(`${logPrefix}: Upserting tasks...`);
    const batchUpdates = [];
    let upserted = 0;

    for (const t of focusTasks) {
      const existingIdx = findRow(t.id);

      if (existingIdx === -1) {
        console.log(`${logPrefix}: Appending new task: ${t.id}`);
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
          console.log(`${logPrefix}: Skipping closed task: ${t.id}`);
          continue;
        }

        console.log(`${logPrefix}: Updating existing task: ${t.id}`);
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
      console.log(`${logPrefix}: Executing batch update with ${batchUpdates.length} updates`);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batchUpdates,
        },
      });
    }

    console.log(`${logPrefix}_DONE`, { dryRun, generated: focusTasks.length, upserted });

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
    console.error(`${logPrefix}_ERROR`, {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: err.message,
        type: err.name,
      }),
    };
  }
};