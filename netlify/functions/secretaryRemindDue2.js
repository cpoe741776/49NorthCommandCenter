// netlify/functions/secretaryRemindDue2.js
// Scheduled every 5 minutes
// Sends Pushover notifications for Tasks that are due or "due soon" based on priority windows.
//
// Due-soon policy (requested):
// - code-red:   within 72 hours
// - code-yellow: within 7 days
// - code-green:  within 14 days
// - code-white:  within 30 days
//
// Eligibility:
// - status === "open"
// - dueAt is present AND dueAt <= now + window
// - lastNotifiedAt is empty OR older than notifyEveryMins
//
// Writes back lastNotifiedAt when a notification is sent.

function nowIso() {
  return new Date().toISOString();
}

function toBool(v) {
  return String(v || "").trim() === "1" || String(v || "").toLowerCase() === "true";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function normalizePriority(p) {
  const s = safeStr(p).toLowerCase();
  if (["code-red", "code-yellow", "code-green", "code-white"].includes(s)) return s;
  return "code-yellow";
}

function priorityWindowMs(priority) {
  const p = normalizePriority(priority);

  // Boss policy
  if (p === "code-red") return 72 * 60 * 60 * 1000;        // 72 hours
  if (p === "code-yellow") return 7 * 24 * 60 * 60 * 1000; // 7 days
  if (p === "code-green") return 14 * 24 * 60 * 60 * 1000; // 14 days
  if (p === "code-white") return 30 * 24 * 60 * 60 * 1000; // 30 days

  return 7 * 24 * 60 * 60 * 1000;
}

function parseIsoDate(s) {
  const v = safeStr(s);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function minsSince(iso) {
  const d = parseIsoDate(iso);
  if (!d) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (60 * 1000));
}

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
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

async function pushoverSend({ token, user, title, message, priority, sound }) {
  // Node 18+ has fetch
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      user,
      title: title || "49N Executive Assistant",
      message: message || "",
      // Pushover priority is -2..2; we map gently:
      // code-red => 1, code-yellow => 0, code-green => 0, code-white => -1
      priority: String(priority ?? 0),
      sound: sound || "pushover",
    }).toString(),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function mapToPushoverPriority(codePriority) {
  const p = normalizePriority(codePriority);
  if (p === "code-red") return 1;
  if (p === "code-white") return -1;
  return 0;
}

function mapToPushoverSound(codePriority) {
  const p = normalizePriority(codePriority);
  // You can change these later; keeping it simple + noticeable for red.
  if (p === "code-red") return "siren";
  return "pushover";
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
    const priorityIdx = idx("priority");
    const statusIdx = idx("status");
    const lastNotifiedAtIdx = idx("lastNotifiedAt");
    const notifyEveryMinsIdx = idx("notifyEveryMins");

    if (idIdx === -1) throw new Error("Tasks header missing required column: id");
    if (statusIdx === -1) throw new Error("Tasks header missing required column: status");
    if (dueAtIdx === -1) throw new Error("Tasks header missing required column: dueAt");
    if (priorityIdx === -1) throw new Error("Tasks header missing required column: priority");
    if (lastNotifiedAtIdx === -1) throw new Error("Tasks header missing required column: lastNotifiedAt");
    if (notifyEveryMinsIdx === -1) throw new Error("Tasks header missing required column: notifyEveryMins");

    const nowMs = Date.now();
    const baseUrl = buildBaseUrl(event);

    // Build candidate list
    const candidates = [];
    let scanned = 0;

    for (let i = 0; i < data.length; i++) {
      const r = data[i] || [];
      const status = safeStr(r[statusIdx]).toLowerCase();
      if (status !== "open") continue;

      const dueAtRaw = safeStr(r[dueAtIdx]);
      if (!dueAtRaw) continue; // due-soon logic requires dueAt

      const dueAt = parseIsoDate(dueAtRaw);
      if (!dueAt) continue;

      const pr = normalizePriority(r[priorityIdx]);
      const windowMs = priorityWindowMs(pr);

      // Eligible if due date is within window (including overdue)
      const dueSoonCutoff = nowMs + windowMs;
      if (dueAt.getTime() > dueSoonCutoff) continue;

      // Throttle by notifyEveryMins and lastNotifiedAt
      const notifyEvery = toInt(r[notifyEveryMinsIdx], 60);
      const lastNotifiedAt = safeStr(r[lastNotifiedAtIdx]);
      const minutesSinceLast = lastNotifiedAt ? minsSince(lastNotifiedAt) : Infinity;

      scanned += 1;

      if (minutesSinceLast < notifyEvery) continue;

      const taskId = safeStr(r[idIdx]);
      const title = titleIdx !== -1 ? safeStr(r[titleIdx]) : taskId;
      const notes = notesIdx !== -1 ? safeStr(r[notesIdx]) : "";

      const msToDue = dueAt.getTime() - nowMs;

      candidates.push({
        rowIndex: i, // 0-based within data (not counting header)
        taskId,
        title,
        notes,
        priority: pr,
        dueAtIso: dueAt.toISOString(),
        msToDue,
        notifyEvery,
      });
    }

    // Sort: Code Red first, then soonest due
    const prRank = (p) => {
      const x = normalizePriority(p);
      if (x === "code-red") return 0;
      if (x === "code-yellow") return 1;
      if (x === "code-green") return 2;
      if (x === "code-white") return 3;
      return 9;
    };

    candidates.sort((a, b) => {
      const ra = prRank(a.priority);
      const rb = prRank(b.priority);
      if (ra !== rb) return ra - rb;
      return a.msToDue - b.msToDue;
    });

    // Send limit per run (prevents spam)
    const MAX_SEND_PER_RUN = 5;
    const toSend = candidates.slice(0, MAX_SEND_PER_RUN);

    let sent = 0;
    const updates = [];

    for (const c of toSend) {
      const title = c.priority === "code-red"
        ? "🔥 Code Red: Due Soon"
        : "⏳ Task Due Soon";

      const dueText =
        c.msToDue < 0
          ? `OVERDUE since ${c.dueAtIso}`
          : `Due by ${c.dueAtIso}`;

      const message = [
        `${c.title}`,
        ``,
        `${dueText}`,
        `Priority: ${c.priority}`,
        c.notes ? `` : null,
        c.notes ? c.notes : null,
      ].filter(Boolean).join("\n");

      if (!dryRun) {
        const res = await pushoverSend({
          token: pushoverToken,
          user: pushoverUser,
          title,
          message,
          priority: mapToPushoverPriority(c.priority),
          sound: mapToPushoverSound(c.priority),
        });

        if (!res.ok) {
          console.warn("PUSHOVER_SEND_FAILED", { taskId: c.taskId, status: res.status, text: res.text });
          continue;
        }

        // Update lastNotifiedAt in sheet
        const sheetRowNumber = c.rowIndex + 2; // + header row, 1-based indexing
        const lastNotifiedCol = String.fromCharCode(65 + lastNotifiedAtIdx); // A=65

        updates.push({
          range: `Tasks!${lastNotifiedCol}${sheetRowNumber}`,
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

    console.log("SECRETARY_REMIND_DUE2_DONE", { scanned, sent, dryRun });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        dryRun,
        scanned,
        eligible: candidates.length,
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
