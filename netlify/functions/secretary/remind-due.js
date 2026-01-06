const { getAllTasks, updateTaskCell } = require("./lib/sheets");
const { sendPushover } = require("./lib/pushover");

function parseISO(s) {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

exports.handler = async () => {
  const { header, data } = await getAllTasks();
  if (!header || header.length === 0) return { statusCode: 200, body: "No header" };

  const colIndex = (name) => header.indexOf(name);

  const idx = {
    title: colIndex("title"),
    dueAt: colIndex("dueAt"),
    status: colIndex("status"),
    lastNotifiedAt: colIndex("lastNotifiedAt"),
    notifyEveryMins: colIndex("notifyEveryMins")
  };

  const now = Date.now();
  let sent = 0;

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const status = String(row[idx.status] || "").toLowerCase();
    if (status !== "open") continue;

    const dueAt = String(row[idx.dueAt] || "");
    const dueMs = parseISO(dueAt);
    if (!dueMs) continue;

    if (dueMs > now) continue; // only notify once due (MVP)

    const title = String(row[idx.title] || "Task");
    const lastNotified = parseISO(String(row[idx.lastNotifiedAt] || "")) || 0;
    const everyMins = parseInt(String(row[idx.notifyEveryMins] || "60"), 10) || 60;

    if (now - lastNotified < everyMins * 60 * 1000) continue;

    await sendPushover(`⏰ Due: ${title}`);
    sent++;

    // Update lastNotifiedAt (column letter calculation)
    const sheetRowNumber = r + 2; // header row is 1
    const colLetter = String.fromCharCode("A".charCodeAt(0) + idx.lastNotifiedAt);
    await updateTaskCell(`Tasks!${colLetter}${sheetRowNumber}`, new Date().toISOString());
  }

  return { statusCode: 200, body: `Reminders sent: ${sent}` };
};

// Netlify Scheduled Function (runs in UTC)
exports.config = {
  schedule: "*/5 * * * *"
};
