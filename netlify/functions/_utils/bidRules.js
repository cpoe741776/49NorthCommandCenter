// netlify/functions/_utils/bidRules.js
// No external deps. Pure JS date parsing + rule evaluation.
// Includes:
//  - end-of-day dueAt for date-only inputs
//  - short titles (details stay in notes)

function safeStr(v) {
  return String(v ?? "").trim();
}

function toNumber(v) {
  // ESLint: no-useless-escape -> don't escape '-' inside a char class when placed at the end
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse dates from:
 * - ISO strings
 * - "MM/DD/YYYY" or "M/D/YYYY"
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

  // Try MM/DD/YYYY (or M/D/YYYY)
  // ESLint: no-useless-escape -> inside [] we can use [/-]
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
 * return an ISO string at end-of-day UTC (23:59).
 */
function looksDateOnly(raw) {
  const s = safeStr(raw);
  if (!s) return false;

  // ISO with time
  if (/[T ]\d{1,2}:\d{2}/.test(s)) return false;
  // Common time tokens
  if (/\b(am|pm|utc|gmt)\b/i.test(s)) return false;

  // MM/DD/YYYY or Month Day, Year or YYYY-MM-DD
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  if (/^[A-Za-z]+\s+\d{1,2},\s*\d{4}$/.test(s)) return true;

  // Otherwise: unknown; treat as date-only if it parses but didn't include time
  return true;
}

function toEndOfDayUtcIso(dateValueRaw) {
  const d = parseDate(dateValueRaw);
  if (!d) return "";
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 0));
  return end.toISOString();
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
 * RULE A — Code Red Bid Detection
 */
function isCodeRedBid(bid) {
  return (
    safeStr(bid.Recommendation) === "Respond" &&
    toNumber(bid["Score Details"]) > 12.0 &&
    safeStr(bid.Relevance) === "High" &&
    daysUntil(bid["Due Date"]) < 10 &&
    daysSince(bid["Date Added"]) <= 30
  );
}

/**
 * Deterministic task ids:
 * - bid-codered:<Source Email ID>
 * - bid-submitted:<Source Email ID>
 * - bid-opening:<Source Email ID>
 */
function taskId(type, sourceEmailId) {
  return `bid-${type}:${safeStr(sourceEmailId)}`;
}

function safeAgency(bid) {
  // Prefer Entity/Agency, but it can be messy
  const entity = safeStr(bid["Entity/Agency"]);
  if (entity) return entity;

  // Fallback: Email Subject if available
  const subj = safeStr(bid["Email Subject"]);
  if (subj) return subj;

  return "Unknown Agency";
}

function buildDueAtFromDueDate(dueDateRaw) {
  const raw = safeStr(dueDateRaw);
  if (!raw) return "";

  // If it looks date-only, set end of day UTC; else use parsed ISO directly
  if (looksDateOnly(raw)) return toEndOfDayUtcIso(raw);

  const d = parseDate(raw);
  return d ? d.toISOString() : "";
}

/**
 * Generate Code Red tasks from Active_Bids
 */
function evaluateActiveBids(activeBids = [], existingTaskIdsSet) {
  const tasks = [];

  for (const bid of activeBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    const id = taskId("codered", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    // Suppress if due date passed (by day)
    if (daysUntil(bid["Due Date"]) < 0) continue;

    // Optional: suppress non-new statuses
    if (safeStr(bid.Status) && safeStr(bid.Status) !== "New") continue;

    if (!isCodeRedBid(bid)) continue;

    const agencyRaw = safeAgency(bid);
    const agencyTitle = trimTitle(agencyRaw, 95); // shorter title
    const dueRaw = safeStr(bid["Due Date"]);
    const dueAt = buildDueAtFromDueDate(dueRaw);

    tasks.push({
      id,
      title: `🔥 Code Red Bid: ${agencyTitle}`,
      priority: "code-red",
      dueAt,
      rawText: `Code Red Bid: ${agencyTitle}`,
      notes: [
        `Agency: ${agencyRaw}`,
        `Score: ${safeStr(bid["Score Details"])}`,
        `Relevance: ${safeStr(bid.Relevance)}`,
        `Due: ${dueRaw || "N/A"}`,
        `Bid System: ${safeStr(bid["Bid System"]) || "Unknown"}`,
        `Country: ${safeStr(bid.Country) || "Unknown"}`,
        `URL: ${safeStr(bid.URL) || ""}`
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
        `URL: ${safeStr(bid.URL) || ""}`
      ].join("\n"),
      createdBy: "ExecutiveAssistant",
      tz: "UTC",
    });
  }

  return tasks;
}

/**
 * RULE C — Bid Opening Pressure
 */
function evaluateBidOpenings(submittedBids = [], existingTaskIdsSet) {
  const tasks = [];

  for (const bid of submittedBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    const openingRaw = safeStr(bid["Formal_Bid_Opening_Date"]);
    if (!openingRaw) continue;

    const days = daysUntil(openingRaw);
    if (!isFinite(days) || days > 5 || days < 0) continue;

    const id = taskId("opening", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    const priority = days <= 1 ? "code-red" : "code-yellow";
    const agencyRaw = safeAgency(bid);
    const agencyTitle = trimTitle(agencyRaw, 95);

    const dueAt = looksDateOnly(openingRaw)
      ? toEndOfDayUtcIso(openingRaw)
      : (parseDate(openingRaw)?.toISOString?.() || "");

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
        `URL: ${safeStr(bid.URL) || ""}`
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
