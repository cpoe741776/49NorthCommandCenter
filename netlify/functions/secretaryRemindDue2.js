// netlify/functions/secretaryRemindDue2.js
// Scheduled every 5 minutes
// Sends Pushover notifications for Tasks that are due or "due soon" based on priority windows.
//
// Due-soon policy (requested):
// - code-red:    within 72 hours
// - code-yellow: within 7 days
// - code-green:  within 14 days
// - code-white:  within 30 days
//
// Eligibility:
// - status === "open"
// - dueAt is present AND dueAt <= now + window
// - lastNotifiedAt is empty OR older than notifyEveryMins
//
// Sending policy:
// - NO CAP on Code Red (send all eligible reds each run)
// - Cap non-reds per run to prevent spam

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
  if (p === "code-red") return 72 * 60 * 60 * 1000;         // 72 hours
  if (p === "code-yellow") return 7 * 24 * 60 * 60 * 1000;  // 7 days
  if (p === "code-green") return 14 * 24 * 60 * 60 * 1000;  // 14 days
  if (p === "code-white") return 30 * 24 * 60 * 60 * 1000;  // 30 days
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

function mapToPushoverPriority(codePriority) {
  const p = normalizePriority(codePriority);
  if (p === "code-red") return 1;
  if (p === "code-white") return -1;
  return 0;
}

function mapToPushoverSound(codePriority) {
  const p = normalizePriority(codePriority);
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

    // Build candidate list (eligible + not throttled)
    const candidates = [];
    let scanned = 0;

    for (let i = 0; i < data.length; i++) {
      const r = data[i] || [];
      const status = safeStr(r[statusIdx]).toLowerCase();
      if (status !== "open") continue;

      const dueAtRaw = safeStr(r[dueAtIdx]);
      if (!dueAtRaw) continue;

      const dueAt = parseIsoDate(dueAtRaw);
      if (!dueAt) continue;

      const pr = normalizePriority(r[priorityIdx]);
      const windowMs = priorityWindowMs(pr);

      // Eligible if within due-soon window (including overdue)
      const dueSoonCutoff = nowMs + windowMs;
      if (dueAt.getTime() > dueSoonCutoff) continue;

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
        rowIndex: i,
        taskId,
        title,
        notes,
        priority: pr,
        dueAtIso: dueAt.toISOString(),
        msToDue,
      });
    }

    // Sort: soonest due first inside each bucket
    candidates.sort((a, b) => a.msToDue - b.msToDue);

    const reds = candidates.filter((c) => c.priority === "code-red");
    const nonReds = candidates.filter((c) => c.priority !== "code-red");

    // NO CAP on reds
    const MAX_NON_RED_PER_RUN = 8; // adjust if you want more/less noise
    const toSend = [...reds, ...nonReds.slice(0, MAX_NON_RED_PER_RUN)];

    let sent = 0;
    const updates = [];

    for (const c of toSend) {
      const pushTitle = c.priority === "code-red"
        ? "🔥 Code Red: Bid/Task Due Soon"
        : "⏳ Task Due Soon";

      const dueText =
        c.msToDue < 0
          ? `OVERDUE since ${c.dueAtIso}`
          : `Due by ${c.dueAtIso}`;

      const message = [
        `${c.title}`,
        "",
        dueText,
        `Priority: ${c.priority}`,
        c.notes ? "" : null,
        c.notes ? c.notes : null,
      ].filter(Boolean).join("\n");

      if (!dryRun) {
        const res = await pushoverSend({
          token: pushoverToken,
          user: pushoverUser,
          title: pushTitle,
          message,
          priority: mapToPushoverPriority(c.priority),
          sound: mapToPushoverSound(c.priority),
        });

        if (!res.ok) {
          console.warn("PUSHOVER_SEND_FAILED", { taskId: c.taskId, status: res.status, text: res.text });
          continue;
        }

        const sheetRowNumber = c.rowIndex + 2; // header + 1-based indexing
        const lastNotifiedColLetter = String.fromCharCode(65 + lastNotifiedAtIdx); // assumes < 26 cols

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
      nonReds: nonReds.length,
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
        nonReds: nonReds.length,
        sent,
        sentIds: toSend.map((x) => x.taskId),
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
