// netlify/functions/secretaryRemindDue2.js
// Scheduled every 5 minutes
// Uses ramping based on time-to-due:
//
// Phase Windows:
//  > 30 days before due  -> "dormant"    (no reminders)
//  30–14 days before     -> "white"      (weekly Monday 09:00)
//  14–7 days before      -> "green"      (daily 12:00)
//  7–3 days before       -> "yellow"     (09:00, 12:00, 15:00)
//  3–0 days before       -> "red"        (every 2h 08:00–22:00)
//  1–14 days after due   -> "overdue"    (daily 09:00)
//  14–30 days after due  -> "wayOverdue" (every 3 days 09:00)
//  30+ days after due    -> "expired"    (auto-archive)
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

function parseIsoDate(s) {
  const v = safeStr(s);
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
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

// Map ramp phase -> Pushover priority
function mapPhaseToPushoverPriority(phase) {
  if (phase === "red" || phase === "overdue" || phase === "wayOverdue") return 1;
  if (phase === "white") return -1;
  return 0;
}

// Map ramp phase -> Pushover sound (respecting quiet mode)
function mapPhaseToPushoverSound(phase, inQuiet, quietMode) {
  if (inQuiet && quietMode === "silent") return "none";
  if (phase === "red" || phase === "overdue" || phase === "wayOverdue") return "siren";
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
    const {
      computePhase,
      computeNextRemindAt,
      isExpired,
    } = require("./_utils/ramping");

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
    const statusIdx = idx("status");
    const lastNotifiedAtIdx = idx("lastNotifiedAt");
    const nextRemindAtIdx = idx("nextRemindAt"); // required for ramping
    const dueStatusIdx = idx("dueStatus");       // optional, if present for UI

    if (idIdx === -1) throw new Error("Tasks header missing required column: id");
    if (statusIdx === -1) throw new Error("Tasks header missing required column: status");
    if (dueAtIdx === -1) throw new Error("Tasks header missing required column: dueAt");
    if (lastNotifiedAtIdx === -1) throw new Error("Tasks header missing required column: lastNotifiedAt");
    if (nextRemindAtIdx === -1) throw new Error("Tasks header missing required column: nextRemindAt");

    const now = new Date();
    const nowMs = now.getTime();

    const lastNotifiedColLetter = colToLetter(lastNotifiedAtIdx + 1);
    const nextRemindColLetter = colToLetter(nextRemindAtIdx + 1);
    const statusColLetter = colToLetter(statusIdx + 1);
    const dueStatusColLetter = dueStatusIdx !== -1 ? colToLetter(dueStatusIdx + 1) : null;

    const candidates = [];
    let scanned = 0;

    // We'll collect all sheets updates (status, dueStatus, nextRemindAt, lastNotifiedAt)
    const updates = [];

    for (let i = 0; i < data.length; i++) {
      const r = data[i] || [];
      const status = safeStr(r[statusIdx]).toLowerCase();
      if (status !== "open") continue;

      const dueAtRaw = safeStr(r[dueAtIdx]);
      if (!dueAtRaw) continue;

      const dueAt = parseIsoDate(dueAtRaw);
      if (!dueAt) continue;

      scanned += 1;

      // Phase based on time-to-due
      const phase = computePhase(now, dueAt);

      // Handle expired (30+ days late): archive/close
      if (isExpired(now, dueAt) || phase === "expired") {
        const sheetRowNumber = i + 2;
        updates.push({
          range: `Tasks!${statusColLetter}${sheetRowNumber}`,
          values: [["archived"]],
        });
        if (dueStatusColLetter) {
          updates.push({
            range: `Tasks!${dueStatusColLetter}${sheetRowNumber}`,
            values: [["expired"]],
          });
        }
        continue;
      }

      // Optional: write overdue / wayOverdue / etc. label if column exists
      if (dueStatusColLetter) {
        let dueStatus = "";
        if (phase === "overdue") dueStatus = "overdue";
        else if (phase === "wayOverdue") dueStatus = "way-overdue";
        else if (phase === "red") dueStatus = "imminent";
        else if (phase === "yellow") dueStatus = "near";
        else if (phase === "green") dueStatus = "upcoming";
        else if (phase === "white") dueStatus = "scheduled";
        else if (phase === "dormant") dueStatus = "future";

        if (dueStatus) {
          const sheetRowNumber = i + 2;
          updates.push({
            range: `Tasks!${dueStatusColLetter}${sheetRowNumber}`,
            values: [[dueStatus]],
          });
        }
      }

      // Dormant: no reminders yet
      if (phase === "dormant" || !phase) {
        continue;
      }

      const nextRemindRaw = safeStr(r[nextRemindAtIdx]);
      const nextRemindAt = parseIsoDate(nextRemindRaw);

      const sheetRowNumber = i + 2;

      // If we've just entered an active phase and have no nextRemindAt yet,
      // schedule the first reminder according to the ramp rules, but do NOT send yet.
      if (!nextRemindAt) {
        const initialNext = computeNextRemindAt(phase, now);
        const initialIso = initialNext ? initialNext.toISOString() : "";
        if (initialIso) {
          updates.push({
            range: `Tasks!${nextRemindColLetter}${sheetRowNumber}`,
            values: [[initialIso]],
          });
        }
        continue;
      }

      // Not yet time to fire
      if (nowMs < nextRemindAt.getTime()) {
        continue;
      }

      const taskId = safeStr(r[idIdx]);
      const title = titleIdx !== -1 ? safeStr(r[titleIdx]) : taskId;
      const notes = notesIdx !== -1 ? safeStr(r[notesIdx]) : "";
      const msToDue = dueAt.getTime() - nowMs;

      candidates.push({
        rowIndex: i,
        taskId,
        title,
        notes,
        phase,
        dueAtIso: dueAt.toISOString(),
        msToDue,
      });
    }

    // If suppress mode, bail early during quiet hours (no sends), but still apply housekeeping updates.
    if (inQuiet && quiet.mode === "suppress") {
      console.log("SECRETARY_REMIND_DUE2_QUIET_SUPPRESS", {
        scanned,
        eligible: candidates.length,
        quiet,
      });

      if (!dryRun && updates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: updates,
          },
        });
      }

      const redsCount = candidates.filter((c) => c.phase === "red").length;
      const nonRedsCount = candidates.length - redsCount;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun,
          scanned,
          eligible: candidates.length,
          reds: redsCount,
          nonReds: nonRedsCount,
          sent: 0,
          suppressedByQuietHours: true,
          quiet,
        }),
      };
    }

    // Sort: soonest due first
    candidates.sort((a, b) => a.msToDue - b.msToDue);

    const reds = candidates.filter((c) => c.phase === "red");
    const nonReds = candidates.filter((c) => c.phase !== "red");

    // NO CAP on reds
    const MAX_NON_RED_PER_RUN = 8;
    const toSend = [...reds, ...nonReds.slice(0, MAX_NON_RED_PER_RUN)];

    let sent = 0;

    for (const c of toSend) {
      let pushTitle = "⏳ Task Due";
      if (c.phase === "red") pushTitle = "🔥 RED: Task/Event Imminent";
      else if (c.phase === "overdue" || c.phase === "wayOverdue") pushTitle = "⚠️ Overdue Task";

      const dueText =
        c.msToDue < 0
          ? `OVERDUE since ${c.dueAtIso}`
          : `Due by ${c.dueAtIso}`;

      const message = [
        `${c.title}`,
        "",
        dueText,
        `Phase: ${c.phase}`,
        c.notes ? "" : null,
        c.notes ? c.notes : null,
      ]
        .filter(Boolean)
        .join("\n");

      if (!dryRun) {
        const res = await pushoverSend({
          token: pushoverToken,
          user: pushoverUser,
          title: pushTitle,
          message,
          priority: mapPhaseToPushoverPriority(c.phase),
          sound: mapPhaseToPushoverSound(c.phase, inQuiet, quiet.mode),
        });

        if (!res.ok) {
          console.warn("PUSHOVER_SEND_FAILED", {
            taskId: c.taskId,
            status: res.status,
            text: res.text,
          });
          continue;
        }

        const sheetRowNumber = c.rowIndex + 2;
        const newNext = computeNextRemindAt(c.phase, new Date());
        const newNextIso = newNext ? newNext.toISOString() : "";

        updates.push(
          {
            range: `Tasks!${lastNotifiedColLetter}${sheetRowNumber}`,
            values: [[nowIso()]],
          },
          {
            range: `Tasks!${nextRemindColLetter}${sheetRowNumber}`,
            values: [[newNextIso]],
          }
        );
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

    const redsCount = reds.length;
    const nonRedsCount = nonReds.length;

    console.log("SECRETARY_REMIND_DUE2_DONE", {
      scanned,
      eligible: candidates.length,
      reds: redsCount,
      nonReds: nonRedsCount,
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
        reds: redsCount,
        nonReds: nonRedsCount,
        sent,
        sentIds: toSend.map((x) => x.taskId),
        quiet: { ...quiet, inQuiet },
      }),
    };
  } catch (err) {
    console.error(
      "SECRETARY_REMIND_DUE2_ERROR",
      err && err.stack ? err.stack : err
    );
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};
