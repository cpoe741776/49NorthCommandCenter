// netlify/functions/_utils/bidRules.js
// No external deps. Pure JS date parsing + rule evaluation.

function safeStr(v) {
  return String(v ?? "").trim();
}

function toNumber(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
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
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
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
 * RULE A — Code Red Bid Detection
 * Columns:
 * - Recommendation (A)
 * - Score Details (B)
 * - Relevance (I)
 * - Due Date (M)
 * - Date Added (T)
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
 * Build deterministic task ids:
 * - bid-codered:<Source Email ID>
 * - bid-submitted:<Source Email ID>
 * - bid-opening:<Source Email ID>
 */
function taskId(type, sourceEmailId) {
  return `bid-${type}:${safeStr(sourceEmailId)}`;
}

function safeAgency(bid) {
  return safeStr(bid["Entity/Agency"]) || "Unknown Agency";
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

    // Suppress if due date passed
    if (daysUntil(bid["Due Date"]) < 0) continue;

    // Optional: suppress non-new statuses
    if (safeStr(bid.Status) && safeStr(bid.Status) !== "New") continue;

    if (isCodeRedBid(bid)) {
      const agency = safeAgency(bid);
      const due = safeStr(bid["Due Date"]);

      tasks.push({
        id,
        title: `🔥 Code Red Bid: ${agency}`,
        priority: "code-red",
        dueAt: due ? parseDate(due)?.toISOString?.() || "" : "",
        rawText: `Code Red Bid: ${agency}`,
        notes: [
          `Agency: ${agency}`,
          `Score: ${safeStr(bid["Score Details"])}`,
          `Relevance: ${safeStr(bid.Relevance)}`,
          `Due: ${due || "N/A"}`,
          `Bid System: ${safeStr(bid["Bid System"])}`,
          `Country: ${safeStr(bid.Country)}`
        ].join("\n"),
        createdBy: "ExecutiveAssistant",
        tz: "UTC",
      });
    }
  }

  return tasks;
}

/**
 * RULE B — Submission Confirmation (Code White)
 * Trigger: submitted row exists and we have not created bid-submitted:<id> before.
 */
function evaluateSubmissionConfirmations(submittedBids = [], knownSubmissionSourceIdsSet, existingTaskIdsSet) {
  const tasks = [];

  for (const bid of submittedBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    // If we already know this source was confirmed as submitted, skip
    if (knownSubmissionSourceIdsSet.has(sourceId)) continue;

    const id = taskId("submitted", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    const agency = safeAgency(bid);

    tasks.push({
      id,
      title: `📤 Bid Submitted: ${agency}`,
      priority: "code-white",
      dueAt: "", // not required
      rawText: `Bid Submitted: ${agency}`,
      notes: [
        `Agency: ${agency}`,
        `Submission Date: ${safeStr(bid["Submission Date"]) || "N/A"}`,
        `Opening Date: ${safeStr(bid["Formal_Bid_Opening_Date"]) || "N/A"}`,
        `Bid System: ${safeStr(bid["Bid System"])}`,
        `Country: ${safeStr(bid.Country)}`
      ].join("\n"),
      createdBy: "ExecutiveAssistant",
      tz: "UTC",
    });
  }

  return tasks;
}

/**
 * RULE C — Bid Opening Pressure
 * Trigger: Formal_Bid_Opening_Date within 5 days (inclusive), not past.
 * Priority:
 * - <= 1 day: code-red
 * - <= 5 days: code-yellow
 */
function evaluateBidOpenings(submittedBids = [], existingTaskIdsSet) {
  const tasks = [];

  for (const bid of submittedBids) {
    const sourceId = safeStr(bid["Source Email ID"]);
    if (!sourceId) continue;

    const opening = bid["Formal_Bid_Opening_Date"];
    const days = daysUntil(opening);
    if (!isFinite(days) || days > 5 || days < 0) continue;

    const id = taskId("opening", sourceId);
    if (existingTaskIdsSet.has(id)) continue;

    const priority = days <= 1 ? "code-red" : "code-yellow";
    const agency = safeAgency(bid);

    tasks.push({
      id,
      title: `📂 Bid Opening: ${agency}`,
      priority: normalizePriority(priority),
      dueAt: parseDate(opening)?.toISOString?.() || "",
      rawText: `Bid Opening: ${agency}`,
      notes: [
        `Agency: ${agency}`,
        `Opening Date: ${safeStr(bid["Formal_Bid_Opening_Date"])}`,
        `Submission Date: ${safeStr(bid["Submission Date"]) || "N/A"}`,
        `Bid System: ${safeStr(bid["Bid System"])}`,
        `Country: ${safeStr(bid.Country)}`
      ].join("\n"),
      createdBy: "ExecutiveAssistant",
      tz: "UTC",
    });
  }

  return tasks;
}

/**
 * Public API
 * NOTE: secretaryLoop passes:
 *  - existingTaskIds: array of task ids that already exist in Tasks tab
 *  - knownSubmissionSourceIds: array of Source Email IDs already confirmed submitted (from taskIndex)
 */
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
