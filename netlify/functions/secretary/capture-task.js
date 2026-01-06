const { appendTaskRow } = require("./lib/sheets");
const { parseTask } = require("./lib/parseTask");
const { sendPushover } = require("./lib/pushover");

function uid() {
  return `tsk_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST" };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const rawText = String(body.rawText || "");
  const createdBy = String(body.createdBy || "Top");

  if (!rawText.trim()) return { statusCode: 400, body: "rawText required" };

  const parsed = parseTask(rawText);
  const id = uid();
  const createdAt = new Date().toISOString();

  await appendTaskRow([
    id,
    createdAt,
    createdBy,
    rawText,
    parsed.title,
    parsed.notes,
    parsed.dueAtISO || "",
    parsed.tz,
    "", // recurrence
    String(parsed.priority),
    "open",
    "", // lastNotifiedAt
    String(parsed.notifyEveryMins)
  ]);

  await sendPushover(`Captured: ${parsed.title}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, id })
  };
};
