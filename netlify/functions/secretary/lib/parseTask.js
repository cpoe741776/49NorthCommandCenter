function parseTask(rawText) {
  const tz = "Europe/London";
  const text = (rawText || "").trim();

  let dueAtISO = null;
  let notifyEveryMins = 60;
  let priority = 3;

  // "in 30m" / "in 2h"
  const inMatch = text.match(/\bin\s+(\d+)\s*(m|min|mins|h|hr|hrs)\b/i);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    const ms = unit.startsWith("h") ? n * 60 * 60 * 1000 : n * 60 * 1000;
    dueAtISO = new Date(Date.now() + ms).toISOString();
    notifyEveryMins = Math.max(5, unit.startsWith("h") ? 30 : 5);
  }

  // "at YYYY-MM-DD HH:MM"
  const atMatch = text.match(/\bat\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\b/i);
  if (atMatch) {
    const date = atMatch[1];
    const time = atMatch[2];
    // MVP: store as ISO using Z; next iteration we’ll do proper London TZ handling
    dueAtISO = new Date(`${date}T${time}:00Z`).toISOString();
    notifyEveryMins = 60;
  }

  const title = text.replace(/^remind me to\s+/i, "").slice(0, 120) || "Task";
  return { title, notes: text, dueAtISO, tz, notifyEveryMins, priority };
}

module.exports = { parseTask };
