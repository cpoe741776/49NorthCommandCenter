// netlify/functions/_utils/bidRules.js
// No external deps. Pure JS date parsing + rule evaluation.
// Includes:
//  - end-of-day dueAt for date-only inputs
//  - priority derived from due-soon windows (3/7/14/30 days)
//  - fallback dueAt when "Due Date" is missing: Email Date Received + 30d, else Date Added + 30d
//  - deterministic task ids to prevent duplicates

function safeStr(v) {
  return String(v ?? "").trim();
}

function toNumber(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse dates from:
 * - ISO strings
 * - "MM/DD/YYYY" or "M/D/YYYY" (also supports "-" separators)
 * - "June 1, 2026" style
 * - Date objects
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const s = safeStr(value);
  if (!s) return null;

  // Try native Date parse first (handles ISO and "June 1, 2026" in most runtimes)
  const native = new Date(s);
  if (!isNaN(native.getTime())) return native;

  // Try MM/DD/YYYY (or M/D/YYYY), with / or -
  const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const mm = Number(mdy[1]);
    const dd = Number(mdy[2]);
    const yyyy = Number(mdy[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function diffDaysUtc(a, b) {
  // a - b in whole days (UTC)
  const ms = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function daysUntil(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return Infinity;
  return diffDaysUtc(d, new Date());
}

function daysSince(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return Infinity;
  return diffDaysUtc(new Date(), d);
}

function normalizePriority(p) {
  const s = safeStr(p).toLowerCase();
  if (["code-red", "code-yellow", "code-green", "code-white"].includes(s)) return s;
  return "code-yellow";
}

/**
 * If the input looks like a date-only string (no time),
 * treat as end-of-day UTC (23:59).
 */
function looksDateOnly(raw) {
  const s = safeStr(raw);
  if (!s) return false;

  // ISO with time or common time tokens
  if (/[T ]\d{1,2}:\d{2}/.test(s)) return false;
  if (/\b(am|pm|utc|gmt)\b/i.test(s)) return false;

  // MM/DD/YYYY or Month Day, Year or YYYY-MM-DD
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  if (/^[A-Za-z]+\s+\d{1,2},\s*\d{4}$/.test(s)) return true;

  // Conservative default: treat as date-only if it parses but has no explicit time
  return true;
}

function toEndOfDayUtcIso(dateValueRaw) {
  const d = parseDate(dateValueRaw);
  if (!d) return "";
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 0));
  return end.toISOString();
}

function addDaysUtc(dateObj, days) {
  const d = new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    0, 0, 0
  ));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function endOfUtcDayIso(dateObj) {
  const end = new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    23, 59, 0
  ));
  return end.toISOString();
}

function dueDaysToPriority(daysUntilDue) {
  if (!Number.isFinite(daysUntilDue)) return null;
  if (daysUntilDue < 0) return null;
  if (daysUntilDue <= 3) return "code-red";
  if (daysUntilDue <= 7) return "code-yellow";
  if (daysUntilDue <= 14) return "code-green";
  if (daysUntilDue <= 30) return "code-white";
  return null;
}

/**
 * Compute effective dueAt:
 * 1) If Due Date parses -> use it (end-of-day if date-only)
 * 2) Else: fallback = Email Date Received + 30 days
 * 3) Else: fallback = Date Added + 30 days
 * Returns { dueAtIso: "", dueSource: "..." }
 */
function computeEffectiveDueAt(bid) {
  const dueRaw = safeStr(bid["Due Date"]);
  const dueParsed = parseDate(dueRaw);

  if (dueParsed) {
    const iso = looksDateOnly(dueRaw) ? toEndOfDayUtcIso(dueRaw) : dueParsed.toISOString();
    return { dueAtIso: iso, dueSource: "dueDate" };
  }

  const emailRaw = safeStr(bid["Email Date Received"]);
  const emailParsed = parseDate(emailRaw);
  if (emailParsed) {
    const fallback = addDaysUtc(emailParsed, 30);
    return { dueAtIso: endOfUtcDayIso(fallback), dueSource: "fallback(emailDate+30d)" };
  }

  const addedRaw = safeStr(bid["Date Added"]);
  const addedParsed = parseDate(addedRaw);
  if (addedParsed) {
    const fallback = addDaysUtc(addedParsed, 30);
    return { dueAtIso: endOfUtcDayIso(fallback), dueSource: "fallback(dateAdded+30d)" };
  }

  return { dueAtIso: "", dueSource: "missing" };
}

/**
 * Title trimming helper: keeps titles readable.
 */
function trimTitle(s, max = 110) {
  const t = safeStr(s).replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + "…";
}

/**
 * Base criteria for "this is a bid we should push on"
 */
function meetsBaseBidCriteria(bid) {
  return (
    safeStr(bid.Recommendation) === "Respond" &&
    toNumber(bid["Score Details"]) > 12.0 &&
    safeStr(bid.Relevance) === "High" &&
    daysSince(bid["Date Added"]) <= 30
  );
}

/**
 * Deterministic task ids:
 * - bid-due:<Source Email ID>
 * - bid-submitted:<Source Email ID>
 * - bid-opening:<Source Email ID>
 */
function taskId(type, sourceEmailId) {
  return `bid-${type}:${safeStr(sourceEmailId)}`;
}

function safeAgency(bid) {
  const entity = safeStr(bid["Entity/Agency"]);
  if (entity) return entity;

  const subj = safeStr(bid["Email Subject"]);
  if (subj) return subj;

  return "Unknown Agency";
}

/**
 * Generate Due-Soon bid tasks from Active_Bids (priority depends on effective dueAt)
 */
function evaluateActiveBids(activeBids = [], existingTaskIdsSet) {
  const tasks = [];

  for (const bid of activeBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    // Optional: suppress non-new statuses
    const st = safeStr(bid.Status);
    if (st && st !== "New") continue;

    if (!meetsBaseBidCriteria(bid)) continue;

    const { dueAtIso, dueSource } = computeEffectiveDueAt(bid);
    if (!dueAtIso) continue;

    const dueDays = daysUntil(dueAtIso);
    const pr = dueDaysToPriority(dueDays);
    if (!pr) continue; // outside 30-day horizon or past due

    const id = taskId("due", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    const agencyRaw = safeAgency(bid);
    const agencyTitle = trimTitle(agencyRaw, 95);

    const marker =
      pr === "code-red" ? "🔥" :
      pr === "code-yellow" ? "🟡" :
      pr === "code-green" ? "🟢" :
      "⚪";

    tasks.push({
      id,
      title: `${marker} Bid Due Soon: ${agencyTitle}`,
      priority: pr,
      dueAt: dueAtIso,
      rawText: `Bid Due Soon: ${agencyTitle}`,
      notes: [
        `Agency: ${agencyRaw}`,
        `Score: ${safeStr(bid["Score Details"])}`,
        `Relevance: ${safeStr(bid.Relevance)}`,
        `Effective DueAt: ${dueAtIso}`,
        `Due Source: ${dueSource}`,
        `Original Due Date: ${safeStr(bid["Due Date"]) || "N/A"}`,
        `Email Date Received: ${safeStr(bid["Email Date Received"]) || "N/A"}`,
        `Date Added: ${safeStr(bid["Date Added"]) || "N/A"}`,
        `Bid System: ${safeStr(bid["Bid System"]) || "Unknown"}`,
        `Country: ${safeStr(bid.Country) || "Unknown"}`,
        `URL: ${safeStr(bid.URL) || ""}`,
      ].join("\n"),
      createdBy: "ExecutiveAssistant",
      tz: "UTC",
    });
  }

  return tasks;
}

/**
 * RULE B — Submission Confirmation (Code White)
 */
function evaluateSubmissionConfirmations(submittedBids = [], knownSubmissionSourceIdsSet, existingTaskIdsSet) {
  const tasks = [];

  for (const bid of submittedBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    if (knownSubmissionSourceIdsSet.has(sourceId)) continue;

    const id = taskId("submitted", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    const agencyRaw = safeAgency(bid);
    const agencyTitle = trimTitle(agencyRaw, 95);

    tasks.push({
      id,
      title: `📤 Bid Submitted: ${agencyTitle}`,
      priority: "code-white",
      dueAt: "",
      rawText: `Bid Submitted: ${agencyTitle}`,
      notes: [
        `Agency: ${agencyRaw}`,
        `Submission Date: ${safeStr(bid["Submission Date"]) || "N/A"}`,
        `Opening Date: ${safeStr(bid["Formal_Bid_Opening_Date"]) || "N/A"}`,
        `Bid System: ${safeStr(bid["Bid System"]) || "Unknown"}`,
        `Country: ${safeStr(bid.Country) || "Unknown"}`,
        `URL: ${safeStr(bid.URL) || ""}`,
      ].join("\n"),
      createdBy: "ExecutiveAssistant",
      tz: "UTC",
    });
  }

  return tasks;
}

/**
 * RULE C — Bid Opening Pressure
 * Keep as-is: opening date is its own trigger.
 */
function evaluateBidOpenings(submittedBids = [], existingTaskIdsSet) {
  const tasks = [];

  for (const bid of submittedBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    const openingRaw = safeStr(bid["Formal_Bid_Opening_Date"]);
    if (!openingRaw) continue;

    const d = parseDate(openingRaw);
    if (!d) continue;

    const days = daysUntil(d);
    if (!Number.isFinite(days) || days > 5 || days < 0) continue;

    const id = taskId("opening", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    const priority = days <= 1 ? "code-red" : "code-yellow";
    const agencyRaw = safeAgency(bid);
    const agencyTitle = trimTitle(agencyRaw, 95);

    const dueAt = looksDateOnly(openingRaw) ? toEndOfDayUtcIso(openingRaw) : d.toISOString();

    tasks.push({
      id,
      title: `📂 Bid Opening: ${agencyTitle}`,
      priority: normalizePriority(priority),
      dueAt,
      rawText: `Bid Opening: ${agencyTitle}`,
      notes: [
        `Agency: ${agencyRaw}`,
        `Opening Date: ${openingRaw}`,
        `Submission Date: ${safeStr(bid["Submission Date"]) || "N/A"}`,
        `Bid System: ${safeStr(bid["Bid System"]) || "Unknown"}`,
        `Country: ${safeStr(bid.Country) || "Unknown"}`,
        `URL: ${safeStr(bid.URL) || ""}`,
      ].join("\n"),
      createdBy: "ExecutiveAssistant",
      tz: "UTC",
    });
  }

  return tasks;
}

export function evaluateBidRules({
  activeBids = [],
  submittedBids = [],
  existingTaskIds = [],
  knownSubmissionSourceIds = [],
}) {
  const existingSet = new Set((existingTaskIds || []).map((x) => safeStr(x)).filter(Boolean));
  const knownSubmittedSet = new Set((knownSubmissionSourceIds || []).map((x) => safeStr(x)).filter(Boolean));

  return [
    ...evaluateActiveBids(activeBids, existingSet),
    ...evaluateSubmissionConfirmations(submittedBids, knownSubmittedSet, existingSet),
    ...evaluateBidOpenings(submittedBids, existingSet),
  ];
}
