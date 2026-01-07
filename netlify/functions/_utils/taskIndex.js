// netlify/functions/_utils/taskIndex.js
// Builds idempotency indexes from Tasks rows using your current header schema.
//
// Expected headers:
// id, createdAt, createdBy, rawText, title, contactEmail, notes, dueAt, tz,
// recurrence, priority, status, lastNotifiedAt, notifyEveryMins
//
// We return:
// - existingTaskIds: Set of all existing task ids (for upsert suppression)
// - knownSubmissionSourceIds: Set of source IDs already confirmed as "submitted"
//   (derived from task ids like bid-submitted:<sourceId>)

function safeLower(s) {
  return String(s || "").trim().toLowerCase();
}

/**
 * Extracts a "source id" embedded in a task id, if using the convention:
 *   bid-codered:<sourceEmailId>
 *   bid-submitted:<sourceEmailId>
 *   bid-opening:<sourceEmailId>
 */
function extractSourceIdFromTaskId(taskId) {
  const id = String(taskId || "").trim();
  const m = id.match(/^bid-(?:codered|submitted|opening):(.+)$/i);
  return m ? String(m[1]).trim() : null;
}

export function buildTaskIndexes({ header = [], rows = [] } = {}) {
  const idIdx = header.indexOf("id");
  const statusIdx = header.indexOf("status");

  if (idIdx === -1) {
    throw new Error("Tasks header missing required column: id");
  }

  const existingTaskIds = new Set();
  const knownSubmissionSourceIds = new Set();

  for (const r of rows) {
    const id = String(r[idIdx] || "").trim();
    if (!id) continue;

    existingTaskIds.add(id);

    // Ignore closed items for "known submission"? (Optional)
    const status = statusIdx === -1 ? "open" : safeLower(r[statusIdx]);
    if (status === "closed") continue;

    // If we've ever created a submitted confirmation task, we consider that source "known".
    if (id.toLowerCase().startsWith("bid-submitted:")) {
      const src = extractSourceIdFromTaskId(id);
      if (src) knownSubmissionSourceIds.add(src);
    }
  }

  return {
    existingTaskIds,            // Set<string> of task ids
    knownSubmissionSourceIds,   // Set<string> of Source Email IDs already confirmed submitted
  };
}
