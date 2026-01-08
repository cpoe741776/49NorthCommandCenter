// netlify/functions/secretaryRemindDue2.js
// Scheduled every 5 minutes
// Sends Pushover notifications for Tasks that are due or "due soon",
// with phase-based ramping based on days until due.
//
// Phase Windows (by days until due):
//  > 30 days            => future (dormant)         => no reminders
//  30–15 days           => white phase              => Mondays 09:00 only
//  14–8 days            => green phase              => every day at 12:00
//  7–4 days             => yellow phase             => 09:00, 12:00, 15:00
//  3–0 days (incl. today) => red phase              => every 2 hours, on the hour, from 08:00
//
// Overdue handling (days after due date):
//  1–13 days            => dueStatus = "overdue"
//  14–29 days           => dueStatus = "way-overdue"
//  >=30 days            => auto-removed: status = "closed", dueStatus = "auto-removed"
//
// Eligibility for sending:
//  - status === "open"
//  - dueAt present and parsable
//  - phase is white/green/yellow/red (not future/overdue/auto-removed)
//  - current local time matches phase window (see isInPhaseSendWindow)
//  - lastNotifiedAt is empty OR older than notifyEveryMins
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

function localDayOfWeekIndex(date, timeZone) {
  // Returns 0=Sun, 1=Mon, ..., 6=Sat
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
  }).formatToParts(date);

  const w = parts.find((p) => p.type === "weekday")?.value || "";
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[w] ?? null;
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

// Compute days until / after due date
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntilDue(dueAt, nowMs) {
  if (!dueAt) return Infinity;
  return Math.floor((dueAt.getTime() - nowMs) / MS_PER_DAY);
}

function daysPastDue(dueAt, nowMs) {
  if (!dueAt) return 0;
  if (nowMs <= dueAt.getTime()) return 0;
  return Math.floor((nowMs - dueAt.getTime()) / MS_PER_DAY);
}

// Determine ramping phase + dueStatus string
function classifyPhaseAndStatus(dueAt, nowMs) {
  if (!dueAt) {
    return { phase: null, dueStatus: "no-due-date" };
  }

  const diffMs = dueAt.getTime() - nowMs;
  const daysUntil = daysUntilDue(dueAt, nowMs);

  // Future / upcoming
  if (diffMs >= 0) {
    if (daysUntil > 30) {
      return { phase: "dormant", dueStatus: "future" };
    }
    if (daysUntil > 14) {
      return { phase: "white", dueStatus: "scheduled" };
    }
    if (daysUntil > 7) {
      return { phase: "green", dueStatus: "upcoming" };
    }
    if (daysUntil > 3) {
      return { phase: "yellow", dueStatus: "near" };
    }
    // 0–3 days remaining
    return { phase: "red", dueStatus: "imminent" };
  }

  // Past due
  const daysPast = daysPastDue(dueAt, nowMs);

  if (daysPast >= 30) {
    return { phase: null, dueStatus: "auto-removed" };
  }
  if (daysPast >= 14) {
    return { phase: null, dueStatus: "way-overdue" };
  }
  if (daysPast >= 1) {
    return { phase: null, dueStatus: "overdue" };
  }

  // Slightly past but under 1 full day – treat as red/imminent
  return { phase: "red", dueStatus: "imminent" };
}

// Check if now (in local tz) is inside the sending window for this phase
function isInPhaseSendWindow(phase, localDow, localHour, localMinute) {
  if (localDow == null || !Number.isFinite(localHour) || !Number.isFinite(localMinute)) {
    // Fallback: if we can't resolve local time, don't gate by phase windows
    return true;
  }

  switch (phase) {
    case "dormant":
      return false;

    // White: weekly Monday at 09:00
    case "white":
      return localDow === 1 && localHour === 9 && localMinute === 0;

    // Green: every day at 12:00
    case "green":
      return localHour === 12 && localMinute === 0;

    // Yellow: 09:00, 12:00, 15:00
    case "yellow":
      return (localHour === 9 || localHour === 12 || localHour === 15) && localMinute === 0;

    // Red: every 2 hours on the hour from 08:00 (08:00, 10:00, 12:00, ...)
    case "red":
      if (localHour < 8) return false;
      return localMinute === 0 && localHour % 2 === 0;

    default:
      return false;
  }
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
    // Used via nextRemindColLetter calculation
// eslint-disable-next-line no-unused-vars
const nextRemindAtIdx = idx("nextRemindAt");

    const dueStatusIdx = idx("dueStatus");

    if (idIdx === -1) throw new Error("Tasks header missing required column: id");
    if (statusIdx === -1) throw new Error("Tasks header missing required column: status");
    if (dueAtIdx === -1) throw new Error("Tasks header missing required column: dueAt");
    if (priorityIdx === -1) throw new Error("Tasks header missing required column: priority");
    if (lastNotifiedAtIdx === -1) throw new Error("Tasks header missing required column: lastNotifiedAt");
    if (notifyEveryMinsIdx === -1) throw new Error("Tasks header missing required column: notifyEveryMins");
    // nextRemindAt and dueStatus are optional; we won't throw if missing.

    const now = new Date();
    const nowMs = now.getTime();

    const localMinutes = minutesInTimeZone(now, quiet.tz);
    const localHour = localMinutes != null ? Math.floor(localMinutes / 60) : null;
    const localMinute = localMinutes != null ? localMinutes % 60 : null;
    const localDow = localDayOfWeekIndex(now, quiet.tz);

    // Build candidate list (eligible + not throttled), also track status updates
    const candidates = [];
    let scanned = 0;

    const cellUpdates = []; // { range, values }

    for (let i = 0; i < data.length; i++) {
      const r = data[i] || [];
      let status = safeStr(r[statusIdx]).toLowerCase();
      if (status !== "open") continue;

      const dueAtRaw = safeStr(r[dueAtIdx]);
      if (!dueAtRaw) {
        // Update dueStatus if the column exists
        if (dueStatusIdx !== -1) {
          const current = safeStr(r[dueStatusIdx]);
          if (current !== "no-due-date") {
            const rowNumber = i + 2;
            const colLetter = colToLetter(dueStatusIdx + 1);
            cellUpdates.push({
              range: `Tasks!${colLetter}${rowNumber}`,
              values: [["no-due-date"]],
            });
          }
        }
        continue;
      }

      const dueAt = parseIsoDate(dueAtRaw);
      if (!dueAt) continue;

      scanned += 1;

      // Phase & dueStatus classification
      const { phase, dueStatus } = classifyPhaseAndStatus(dueAt, nowMs);

      // Handle overdue auto-removal (>=30 days after due)
      if (dueStatus === "auto-removed") {
        if (!dryRun) {
          const rowNumber = i + 2;

          if (dueStatusIdx !== -1) {
            const dueStatusCol = colToLetter(dueStatusIdx + 1);
            cellUpdates.push({
              range: `Tasks!${dueStatusCol}${rowNumber}`,
              values: [[dueStatus]],
            });
          }

          // Set status to "closed" (soft delete)
          const statusCol = colToLetter(statusIdx + 1);
          cellUpdates.push({
            range: `Tasks!${statusCol}${rowNumber}`,
            values: [["closed"]],
          });
        }
        continue;
      }

      // Update dueStatus if we have a column
      if (dueStatusIdx !== -1) {
        const current = safeStr(r[dueStatusIdx]);
        if (current !== dueStatus) {
          const rowNumber = i + 2;
          const colLetter = colToLetter(dueStatusIdx + 1);
          cellUpdates.push({
            range: `Tasks!${colLetter}${rowNumber}`,
            values: [[dueStatus]],
          });
        }
      }

      // Only white/green/yellow/red phases are eligible for reminders
      if (!phase || phase === "dormant") continue;

      // Time-of-day gating based on phase window
      if (!isInPhaseSendWindow(phase, localDow, localHour, localMinute)) continue;

      // Throttle based on lastNotifiedAt + notifyEveryMins
      const notifyEvery = toInt(r[notifyEveryMinsIdx], 60);
      const lastNotifiedAt = safeStr(r[lastNotifiedAtIdx]);
      const minutesSinceLast = lastNotifiedAt ? minsSince(lastNotifiedAt) : Infinity;
      if (minutesSinceLast < notifyEvery) continue;

      const pr = normalizePriority(r[priorityIdx]);
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

    // If suppress mode, bail early during quiet hours (no sending)
    if (inQuiet && quiet.mode === "suppress") {
      console.log("SECRETARY_REMIND_DUE2_QUIET_SUPPRESS", {
        scanned,
        eligible: candidates.length,
        quiet,
      });

      // Still apply dueStatus/status updates accumulated so far
      if (!dryRun && cellUpdates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: cellUpdates,
          },
        });
      }

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

        cellUpdates.push({
          range: `Tasks!${lastNotifiedColLetter}${sheetRowNumber}`,
          values: [[nowIso()]],
        });
      }

      sent += 1;
    }

    // Apply all pending cell updates (dueStatus, status, lastNotifiedAt)
    if (!dryRun && cellUpdates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: cellUpdates,
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
