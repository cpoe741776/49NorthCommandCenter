// netlify/functions/secretaryRemindDue2.js
// Scheduled every 5 minutes
// Sends Pushover notifications for Tasks that are due or "due soon" based on priority windows.
//
// Due-soon policy:
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
//
// Quiet Hours (from ExecutiveAssistant_Settings tab):
// - quietHoursEnabled (true/false)
// - quietStart (HH:MM) default 21:00
// - quietEnd (HH:MM) default 08:00
// - quietTimeZone default Europe/London
// - quietMode: silent|suppress (default silent)
//
// silent   => still sends, but sound=none
// suppress => sends nothing during quiet hours

function nowIso() {
  return new Date().toISOString();
}

function toBool(v) {
  return String(v || "").trim() === "1" || String(v || "").toLowerCase() === "true";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
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
  return Number.isFinite(d.getTime()) ? d : null;
}

function minsSince(iso) {
  const d = parseIsoDate(iso);
  if (!d) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (60 * 1000));
}

function parseHHMM(s) {
  const m = String(s || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hh = Number(parts.find((p) => p.type === "hour")?.value);
  const mm = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function isInQuietHours({ enabled, startHHMM, endHHMM, timeZone }) {
  if (!enabled) return false;

  const start = parseHHMM(startHHMM);
  const end = parseHHMM(endHHMM);
  if (start == null || end == null) return false;

  const nowMins = minutesInTimeZone(new Date(), timeZone || "Europe/London");
  if (nowMins == null) return false;

  // handles wrap-around windows like 21:00 -> 08:00
  if (start < end) return nowMins >= start && nowMins < end;
  return nowMins >= start || nowMins < end;
}

function toBoolLoose(v) {
  const s = String(v || "").toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "y";
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

async function readEaSettings({ sheets, spreadsheetId }) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ExecutiveAssistant_Settings!A:B",
    });
    const rows = res.data.values || [];
    const out = {};
    for (const r of rows.slice(1)) {
      const k = String(r[0] || "").trim();
      const v = String(r[1] || "").trim();
      if (k) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
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

function mapToPushoverSound(codePriority, inQuiet, quietMode) {
  if (inQuiet && quietMode === "silent") return "none";
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

    // Read settings ONCE
    const settings = await readEaSettings({ sheets, spreadsheetId: sheetId });
    const quiet = {
      enabled: toBoolLoose(settings.quietHoursEnabled ?? "true"),
      start: settings.quietStart ?? "21:00",
      end: settings.quietEnd ?? "08:00",
      tz: settings.quietTimeZone ?? "Europe/London",
      mode: (settings.quietMode || "silent").toLowerCase(), // silent|suppress
    };

    const inQuiet = isInQuietHours({
      enabled: quiet.enabled,
      startHHMM: quiet.start,
      endHHMM: quiet.end,
      timeZone: quiet.tz,
    });

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

    // If suppress mode, bail early during quiet hours
    if (inQuiet && quiet.mode === "suppress") {
      console.log("SECRETARY_REMIND_DUE2_QUIET_SUPPRESS", {
        scanned,
        eligible: candidates.length,
        quiet,
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun,
          scanned,
          eligible: candidates.length,
          reds: candidates.filter((c) => c.priority === "code-red").length,
          nonReds: candidates.filter((c) => c.priority !== "code-red").length,
          sent: 0,
          suppressedByQuietHours: true,
          quiet,
        }),
      };
    }

    // Sort: soonest due first
    candidates.sort((a, b) => a.msToDue - b.msToDue);

    const reds = candidates.filter((c) => c.priority === "code-red");
    const nonReds = candidates.filter((c) => c.priority !== "code-red");

    // NO CAP on reds
    const MAX_NON_RED_PER_RUN = 8;
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
          sound: mapToPushoverSound(c.priority, inQuiet, quiet.mode),
        });

        if (!res.ok) {
          console.warn("PUSHOVER_SEND_FAILED", { taskId: c.taskId, status: res.status, text: res.text });
          continue;
        }

        const sheetRowNumber = c.rowIndex + 2; // header + 1-based indexing
        const lastNotifiedColLetter = colToLetter(lastNotifiedAtIdx + 1);

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
      quiet: { ...quiet, inQuiet },
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
        quiet: { ...quiet, inQuiet },
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
