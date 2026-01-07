// netlify/functions/secretaryLoop.js
// deploy-bump: 1767810001
// Hourly "Executive Assistant focus tasks" generator (rules-based)
// - Generates stable focus tasks based on current workload
// - Upserts by id (no duplicates): focus-bids, focus-social, focus-webinars
// - Uses SECRETARY_TASKS_SHEET_ID from _utils/secrets
// - Writes to Tasks tab with current header order
//
// Extended:
// - Runs bidRules (Active_Bids + Submitted) and upserts resulting tasks by deterministic id
// - Uses taskIndex to suppress duplicates and detect already-confirmed submissions
//
// Secrets used (from 49N_Secrets):
// - SECRETARY_TASKS_SHEET_ID (Tasks sink)
// - GOOGLE_SHEET_ID (Bids Intelligence source)

import { evaluateBidRules } from "./_utils/bidRules.js";
import { buildTaskIndexes } from "./_utils/taskIndex.js";

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
  // Use native fetch if available (Node 18+), fallback to node-fetch
  let fetchFn;
  if (typeof fetch !== "undefined") {
    fetchFn = fetch;
  } else {
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
  rawText,
  contactEmail = "",
  tz = "UTC",
  recurrence = "",
}) {
  const createdAt = nowIso();
  const p = normalizePriority(priority);
  const notifyEveryMins = priorityToNotifyMins(p);

  return [
    String(id),                        // id
    createdAt,                         // createdAt
    createdBy,                         // createdBy
    rawText || `Focus Task: ${title}`, // rawText
    title,                             // title
    contactEmail || "",                // contactEmail
    notes || "",                       // notes
    dueAt || "",                       // dueAt
    tz || "UTC",                       // tz
    recurrence || "",                  // recurrence
    p,                                 // priority
    "open",                            // status
    "",                                // lastNotifiedAt
    String(notifyEveryMins),           // notifyEveryMins
  ];
}

/**
 * Read a tab into array-of-objects using row1 as headers.
 * Tolerant: returns [] if tab empty/missing values.
 */
async function getSheetRowsAsObjects({ sheets, spreadsheetId, tabName }) {
  const range = `${tabName}!A:ZZ`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = res.data.values || [];
  if (values.length < 2) return [];

  const headers = (values[0] || []).map((h) => String(h || "").trim());
  const out = [];

  for (const row of values.slice(1)) {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      obj[key] = row[i] ?? "";
    }
    out.push(obj);
  }
  return out;
}

exports.handler = async (event) => {
  console.log("SECRETARY_LOOP_START", nowIso(), {
    path: event?.path,
    qs: event?.queryStringParameters || {},
  });
  console.log("SECRETARY_LOOP_VERSION", "2026-01-07-bidRules-wireup-v1");


  try {
    const qs = event?.queryStringParameters || {};
    const dryRun = toBool(qs.dryRun);

    // Require modules inside handler to avoid init-crash
    const { google } = require("googleapis");
    const { getSecret } = require("./_utils/secrets");
    const { getGoogleAuth } = require("./_utils/google");

    // SINK: Secretary tasks sheet
    const secretarySheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!secretarySheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    // SOURCE: Bids Intelligence sheet
    const bidsIntelSheetId = await getSecret("GOOGLE_SHEET_ID");
    if (!bidsIntelSheetId) {
      console.log("BID_RULES_SKIPPED", "Missing GOOGLE_SHEET_ID (Bids Intelligence)");
    }

    const baseUrl = buildBaseUrl(event);

    // ---- Fetch dashboard/summary inputs from endpoints (tolerant to individual failures) ----
    const [bids, socials, webinars] = await Promise.allSettled([
      fetchJson(`${baseUrl}/.netlify/functions/getBids`),
      fetchJson(`${baseUrl}/.netlify/functions/getSocialMediaContent?limit=0`),
      fetchJson(`${baseUrl}/.netlify/functions/getWebinars`),
    ]);

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

    console.log("SECRETARY_LOOP_INPUTS", {
      bids: { ok: bidsData.ok, status: bidsData.status, totalActiveBids, respondCount, gatherCount },
      social: { ok: socialsData.ok, status: socialsData.status, socialScheduled, socialDrafts },
      webinars: { ok: webinarsData.ok, status: webinarsData.status, upcomingWebinars },
    });

    // ---- Focus tasks (your existing logic) ----
    const focusTasks = [];

    if (totalActiveBids > 0) {
      focusTasks.push({
        id: "focus-bids",
        title: "Work on Bids",
        priority: respondCount > 0 ? "code-red" : "code-yellow",
        dueAt: addMinutesISO(60),
        notes: `We currently have ${totalActiveBids} active bids. Respond=${respondCount}, Gather=${gatherCount}.`,
        rawText: "Focus Task: Work on Bids",
        createdBy: "ExecutiveAssistant",
        tz: "UTC",
      });
    }

    if (socialScheduled > 0 || socialDrafts > 0) {
      focusTasks.push({
        id: "focus-social",
        title: "Review Social Queue",
        priority: socialScheduled > 0 ? "code-yellow" : "code-green",
        dueAt: addMinutesISO(60),
        notes: `Social queue: Scheduled=${socialScheduled}, Drafts=${socialDrafts}.`,
        rawText: "Focus Task: Review Social Queue",
        createdBy: "ExecutiveAssistant",
        tz: "UTC",
      });
    }

    if (upcomingWebinars > 0) {
      focusTasks.push({
        id: "focus-webinars",
        title: "Prep Upcoming Webinars",
        priority: "code-yellow",
        dueAt: addMinutesISO(120),
        notes: `Upcoming webinars: ${upcomingWebinars}. Check registrations, reminders, and follow-ups.`,
        rawText: "Focus Task: Prep Upcoming Webinars",
        createdBy: "ExecutiveAssistant",
        tz: "UTC",
      });
    }

    // ---- Connect to Google Sheets and read existing tasks ----
    const googleAuth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: secretarySheetId,
      range: "Tasks!A:Z",
    });

    const allRows = read.data.values || [];
    if (!allRows.length) throw new Error("Tasks tab is empty (missing header row)");

    const header = allRows[0] || [];
    const data = allRows.slice(1);

    const idIdx = header.indexOf("id");
    if (idIdx === -1) throw new Error("Tasks header missing required column: id");

    const statusIdx = header.indexOf("status");

    const findRow = (taskId) =>
      data.findIndex((r) => String(r[idIdx] || "") === String(taskId));

    // ---- Build indexes for idempotency ----
    const { existingTaskIds, knownSubmissionSourceIds } = buildTaskIndexes({
      header,
      rows: data,
    });

    // ---- BID RULES: read bids intel sheet directly and generate bid tasks ----
    let bidTasks = [];
    if (bidsIntelSheetId) {
      try {
        const [activeBids, submittedBids] = await Promise.all([
          getSheetRowsAsObjects({ sheets, spreadsheetId: bidsIntelSheetId, tabName: "Active_Bids" }),
          getSheetRowsAsObjects({ sheets, spreadsheetId: bidsIntelSheetId, tabName: "Submitted" }),
        ]);

        // evaluateBidRules must return array of {id, title, ...}
        bidTasks = evaluateBidRules({
          activeBids,
          submittedBids,
          existingTaskIds: Array.from(existingTaskIds),
          knownSubmissionSourceIds: Array.from(knownSubmissionSourceIds),
        }) || [];

        console.log("BID_RULES_DONE", {
          active: activeBids.length,
          submitted: submittedBids.length,
          generated: bidTasks.length,
        });
      } catch (e) {
        console.warn("BID_RULES_ERROR", e && e.stack ? e.stack : e);
        bidTasks = [];
      }
    }

    // ---- Combine all tasks to upsert ----
    const tasksToUpsert = [...focusTasks, ...bidTasks];

    if (!tasksToUpsert.length) {
      console.log("SECRETARY_LOOP_NO_TASKS");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun,
          generated: 0,
          upserted: 0,
          reason: "No rules triggered based on current data.",
        }),
      };
    }

    // ---- Upsert tasks: append new or update existing ----
    const batchUpdates = [];
    let upserted = 0;
    let appended = 0;
    let updated = 0;

    // Header length is 14 (A..N) so safe for A..Z conversion
    const endColLetter = String.fromCharCode(64 + header.length);

    for (const t of tasksToUpsert) {
      if (!t || !t.id || !t.title) continue;

      const existingIdx = findRow(t.id);

      if (existingIdx === -1) {
        // Task doesn't exist - append new row
        if (!dryRun) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: secretarySheetId,
            range: "Tasks!A1",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [buildTaskRow(t)] },
          });
        }
        upserted += 1;
        appended += 1;
      } else {
        // Task exists - update if still open
        const row = data[existingIdx] || [];
        const existingStatus =
          statusIdx === -1 ? "open" : String(row[statusIdx] || "").toLowerCase();

        // Don't resurrect closed tasks
        if (existingStatus === "closed") continue;

        // Build updated row preserving existing data
        const updatedRow = new Array(header.length).fill("");
        for (let i = 0; i < header.length; i++) updatedRow[i] = row[i] ?? "";

        const set = (colName, val) => {
          const idx = header.indexOf(colName);
          if (idx !== -1) updatedRow[idx] = val;
        };

        // Update live fields
        set("title", t.title);
        set("rawText", t.rawText || `Focus Task: ${t.title}`);
        set("notes", t.notes || "");
        set("dueAt", t.dueAt || "");
        set("tz", t.tz || "UTC");
        set("recurrence", t.recurrence || "");
        set("priority", normalizePriority(t.priority));
        set("notifyEveryMins", String(priorityToNotifyMins(t.priority)));
        set("status", "open");

        if (t.contactEmail) set("contactEmail", t.contactEmail);

        const sheetRowNumber = existingIdx + 2;
        batchUpdates.push({
          range: `Tasks!A${sheetRowNumber}:${endColLetter}${sheetRowNumber}`,
          values: [updatedRow],
        });

        upserted += 1;
        updated += 1;
      }
    }

    if (!dryRun && batchUpdates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: secretarySheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batchUpdates,
        },
      });
    }

    console.log("SECRETARY_LOOP_DONE", {
      dryRun,
      generated: tasksToUpsert.length,
      upserted,
      appended,
      updated,
      focusGenerated: focusTasks.length,
      bidGenerated: bidTasks.length,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        dryRun,
        generated: tasksToUpsert.length,
        upserted,
        appended,
        updated,
        focusTasks,
        bidTasks,
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
