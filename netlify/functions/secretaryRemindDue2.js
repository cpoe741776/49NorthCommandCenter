// netlify/functions/secretaryRemindDue2.js
// Scheduled every 5 minutes
// Sends Pushover notifications for Tasks that are due or "due soon" based on *due date phases*.
//
// Due-soon policy (Boss policy):
// - code-red:    within 72 hours (or overdue)
// - code-yellow: within 7 days
// - code-green:  within 14 days
// - code-white:  within 30 days
//
// Guarantees:
// - NO CAP for Code Red notifications (within 72h / overdue)
// - CAP for non-red notifications to prevent spam
// - Phase is determined from dueAt even if the row's priority is wrong
// - Throttle cadence (notifyEveryMins) is effectively enforced by phase so Red can’t be “stuck” at 480 mins

function nowIso() {
  return new Date().toISOString();
}

function toBool(v) {
  return String(v || "").trim() === "1" || String(v || "").toLowerCase() === "true";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function parseIsoDate(s) {
  const v = safeStr(s);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minsSince(iso) {
  const d = parseIsoDate(iso);
  if (!d) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (60 * 1000));
}

function buildBaseUrl(event) {
  const site = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (site) return site.replace(/\/$/, "");

  const proto =
    event?.headers?.["x-forwarded-proto"] ||
    event?.headers?.["X-Forwarded-Proto"] ||
    "https";
  const host = event?.headers?.host || event?.headers?.Host;

  return host ? `${proto}://${host}` : "https://49northcommandcenter.netlify.app";
}

// Convert 1-based column index to letters (A, B, ..., Z, AA, AB, ...)
function colToLetter(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// Phase logic derived from due date proximity
function phaseFromMsToDue(msToDue) {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (msToDue <= 72 * hour) return "code-red";     // includes overdue (negative)
  if (msToDue <= 7 * day) return "code-yellow";
  if (msToDue <= 14 * day) return "code-green";
  if (msToDue <= 30 * day) return "code-white";
  return null; // not due soon enough to notify
}

function phaseNotifyEveryMins(phase) {
  if (phase === "code-red") return 15;
  if (phase === "code-yellow") return 60;
  if (phase === "code-green") return 240;
  if (phase === "code-white") return 480;
  return 60;
}

function mapToPushoverPriority(phase) {
  if (phase === "code-red") return 1;
  if (phase === "code-white") return -1;
  return 0;
}

function mapToPushoverSound(phase) {
  if (phase === "code-red") return "siren";
  return "pushover";
}

async function pushoverSend({ token, user, title, message, priority, sound }) {
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      user,
      title: title || "49N Executive Assistant",
      message: message || "",
      priority: String(priority ?? 0),
      sound: sound || "pushover",
    }).toString(),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

exports.handler = async (event) => {
  const startIso = nowIso();
  console.log("SECRETARY_REMIND_DUE2_START", startIso, event?.queryStringParameters || {});

  try {
    const qs = event?.queryStringParameters || {};
    const dryRun = toBool(qs.dryRun);

    const { google } = require("googleapis");
    const { getSecret } = require("./_utils/secrets");
    const { getGoogleAuth } = require("./_utils/google");

    const sheetId = await getSecret("SECRETARY_TASKS_SHEET_ID");
    if (!sheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

    const pushoverToken = await getSecret("PUSHOVER_APP_TOKEN");
    const pushoverUser = await getSecret("PUSHOVER_USER_KEY");
    if (!pushoverToken || !pushoverUser) {
      throw new Error("Missing PUSHOVER_APP_TOKEN or PUSHOVER_USER_KEY");
    }

    const googleAuth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Read Tasks
    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Tasks!A:Z",
    });

    const rows = read.data.values || [];
    if (!rows.length) throw new Error("Tasks tab is empty (missing header row)");

    const header = rows[0] || [];
    const data = rows.slice(1);

    const idx = (name) => header.indexOf(name);

    const idIdx = idx("id");
    const titleIdx = idx("title");
    const notesIdx = idx("notes");
    const dueAtIdx = idx("dueAt");
    const statusIdx = idx("status");
    const lastNotifiedAtIdx = idx("lastNotifiedAt");

    if (idIdx === -1) throw new Error("Tasks header missing required column: id");
    if (statusIdx === -1) throw new Error("Tasks header missing required column: status");
    if (dueAtIdx === -1) throw new Error("Tasks header missing required column: dueAt");
    if (lastNotifiedAtIdx === -1) throw new Error("Tasks header missing required column: lastNotifiedAt");

    const nowMs = Date.now();
    const baseUrl = buildBaseUrl(event);

    let scanned = 0;

    // Candidate list = tasks due within 30 days (or overdue), phase computed from dueAt
    const candidates = [];

    for (let i = 0; i < data.length; i++) {
      const r = data[i] || [];
      const status = safeStr(r[statusIdx]).toLowerCase();
      if (status !== "open") continue;

      const dueAtRaw = safeStr(r[dueAtIdx]);
      if (!dueAtRaw) continue;

      const dueAt = parseIsoDate(dueAtRaw);
      if (!dueAt) continue;

      const msToDue = dueAt.getTime() - nowMs;
      const phase = phaseFromMsToDue(msToDue);
      if (!phase) continue; // not within 30-day window

      scanned += 1;

      const lastNotifiedAt = safeStr(r[lastNotifiedAtIdx]);
      const minutesSinceLast = lastNotifiedAt ? minsSince(lastNotifiedAt) : Infinity;

      // Effective cadence based on phase, so urgent tasks don’t get stuck
      const effectiveEvery = phaseNotifyEveryMins(phase);

      if (minutesSinceLast < effectiveEvery) continue;

      const taskId = safeStr(r[idIdx]);
      const title = titleIdx !== -1 ? safeStr(r[titleIdx]) : taskId;
      const notes = notesIdx !== -1 ? safeStr(r[notesIdx]) : "";

      candidates.push({
        rowIndex: i, // 0-based within data
        taskId,
        title,
        notes,
        phase,
        dueAtIso: dueAt.toISOString(),
        msToDue,
        effectiveEvery,
      });
    }

    // Sort within phase by soonest due
    candidates.sort((a, b) => a.msToDue - b.msToDue);

    // Split reds vs others
    const reds = candidates.filter((c) => c.phase === "code-red");
    const others = candidates.filter((c) => c.phase !== "code-red");

    // Cap ONLY non-red
    const MAX_OTHER_SEND_PER_RUN = 5;
    const toSend = [...reds, ...others.slice(0, MAX_OTHER_SEND_PER_RUN)];

    let sent = 0;
    const updates = [];

    for (const c of toSend) {
      const title =
        c.phase === "code-red"
          ? "🔥 Code Red: Due within 72 hours"
          : "⏳ Task Due Soon";

      const dueText =
        c.msToDue < 0
          ? `OVERDUE since ${c.dueAtIso}`
          : `Due by ${c.dueAtIso}`;

      const message = [
        `${c.title}`,
        "",
        `${dueText}`,
        `Phase: ${c.phase}`,
        c.notes ? "" : null,
        c.notes ? c.notes : null,
      ].filter(Boolean).join("\n");

      if (!dryRun) {
        const res = await pushoverSend({
          token: pushoverToken,
          user: pushoverUser,
          title,
          message,
          priority: mapToPushoverPriority(c.phase),
          sound: mapToPushoverSound(c.phase),
        });

        if (!res.ok) {
          console.warn("PUSHOVER_SEND_FAILED", { taskId: c.taskId, status: res.status, text: res.text });
          continue;
        }

        // Update lastNotifiedAt in sheet
        const sheetRowNumber = c.rowIndex + 2; // header + 1-based
        const lastNotifiedColLetter = colToLetter(lastNotifiedAtIdx + 1); // 1-based col

        updates.push({
          range: `Tasks!${lastNotifiedColLetter}${sheetRowNumber}`,
          values: [[nowIso()]],
        });
      }

      sent += 1;
    }

    if (!dryRun && updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates,
        },
      });
    }

    console.log("SECRETARY_REMIND_DUE2_DONE", {
      scanned,
      eligible: candidates.length,
      reds: reds.length,
      others: others.length,
      sent,
      dryRun,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        dryRun,
        scanned,
        eligible: candidates.length,
        reds: reds.length,
        others: others.length,
        sent,
        sentIds: toSend.map((x) => x.taskId),
        baseUrl,
      }),
    };
  } catch (err) {
    console.error("SECRETARY_REMIND_DUE2_ERROR", err && err.stack ? err.stack : err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};
