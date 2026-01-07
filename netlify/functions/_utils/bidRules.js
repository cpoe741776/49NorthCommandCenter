// netlify/functions/_utils/bidRules.js

import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

/**
 * Safe date parsing helper
 */
function parseDate(value) {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

/**
 * Date math helpers
 */
function daysUntil(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return Infinity;
  return differenceInCalendarDays(d, new Date());
}

function daysSince(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return Infinity;
  return differenceInCalendarDays(new Date(), d);
}

/**
 * RULE A — Code Red Bid Detection
 */
function isCodeRedBid(bid) {
  return (
    bid.Recommendation === "Respond" &&
    Number(bid["Score Details"]) > 12.0 &&
    bid.Relevance === "High" &&
    daysUntil(bid["Due Date"]) < 10 &&
    daysSince(bid["Date Added"]) <= 30
  );
}

/**
 * Generate Code Red tasks from Active_Bids
 */
function evaluateActiveBids(activeBids = [], existingTaskIds = new Set()) {
  const tasks = [];

  for (const bid of activeBids) {
    const linkedId = bid["Source Email ID"];
    if (!linkedId || existingTaskIds.has(linkedId)) continue;
    if (bid.Status && bid.Status !== "New") continue;
    if (daysUntil(bid["Due Date"]) < 0) continue;

    if (isCodeRedBid(bid)) {
      tasks.push({
        type: "Professional",
        title: `🔥 Code Red Bid: ${bid["Entity/Agency"] || "Unknown Agency"}`,
        priority: "Code Red",
        linkedId,
        metadata: {
          dueDate: bid["Due Date"],
          bidSystem: bid["Bid System"],
          country: bid.Country,
          relevance: bid.Relevance,
          score: bid["Score Details"]
        }
      });
    }
  }

  return tasks;
}

/**
 * RULE B — Submission Confirmation (Code White)
 */
function evaluateSubmissionConfirmations(
  submittedBids = [],
  knownSubmissionIds = new Set()
) {
  const tasks = [];

  for (const bid of submittedBids) {
    const linkedId = bid["Source Email ID"];
    if (!linkedId || knownSubmissionIds.has(linkedId)) continue;

    tasks.push({
      type: "Professional",
      title: `📤 Bid Submitted: ${bid["Entity/Agency"] || "Unknown Agency"}`,
      priority: "Code White",
      linkedId,
      autoCompleteAfterHours: 24,
      metadata: {
        submissionDate: bid["Submission Date"],
        bidSystem: bid["Bid System"],
        country: bid.Country
      }
    });
  }

  return tasks;
}

/**
 * RULE C — Bid Opening Pressure
 */
function evaluateBidOpenings(submittedBids = [], existingTaskIds = new Set()) {
  const tasks = [];

  for (const bid of submittedBids) {
    const linkedId = bid["Source Email ID"];
    if (!linkedId || existingTaskIds.has(`${linkedId}-opening`)) continue;

    const days = daysUntil(bid["Formal_Bid_Opening_Date"]);
    if (!isFinite(days) || days > 5 || days < 0) continue;

    const priority =
      days <= 1 ? "Code Red" :
      days <= 5 ? "Code Yellow" :
      null;

    if (!priority) continue;

    tasks.push({
      type: "Professional",
      title: `📂 Bid Opening: ${bid["Entity/Agency"] || "Unknown Agency"}`,
      priority,
      linkedId: `${linkedId}-opening`,
      metadata: {
        openingDate: bid["Formal_Bid_Opening_Date"],
        submissionDate: bid["Submission Date"],
        bidSystem: bid["Bid System"],
        country: bid.Country
      }
    });
  }

  return tasks;
}

/**
 * Public API — called by secretaryLoop
 */
export function evaluateBidRules({
  activeBids = [],
  submittedBids = [],
  existingTaskIds = [],
  knownSubmissionIds = []
}) {
  const existingSet = new Set(existingTaskIds);
  const knownSubmittedSet = new Set(knownSubmissionIds);

  return [
    ...evaluateActiveBids(activeBids, existingSet),
    ...evaluateSubmissionConfirmations(submittedBids, knownSubmittedSet),
    ...evaluateBidOpenings(submittedBids, existingSet)
  ];
}
