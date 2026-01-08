"use strict";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffInDays(dueAt, now) {
  const dueDay = startOfDay(dueAt).getTime();
  const nowDay = startOfDay(now).getTime();
  return Math.floor((dueDay - nowDay) / MS_PER_DAY);
}

function diffLateDays(dueAt, now) {
  const dueDay = startOfDay(dueAt).getTime();
  const nowDay = startOfDay(now).getTime();
  return Math.floor((nowDay - dueDay) / MS_PER_DAY);
}

function atTime(date, hour, minute) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Phases:
 *  - "dormant"    > 30 days before due
 *  - "white"      30 > daysOut > 14
 *  - "green"      14 >= daysOut > 7
 *  - "yellow"     7 >= daysOut > 3
 *  - "red"        3 >= daysOut >= 0
 *  - "overdue"    1 <= daysLate < 14
 *  - "wayOverdue" 14 <= daysLate < 30
 *  - "expired"    30+ days late
 */
function computePhase(now, dueAt) {
  if (!dueAt) return null;

  const daysOut = diffInDays(dueAt, now);

  if (daysOut > 30) return "dormant";
  if (daysOut > 14) return "white";
  if (daysOut > 7) return "green";
  if (daysOut > 3) return "yellow";
  if (daysOut >= 0) return "red";

  const daysLate = diffLateDays(dueAt, now);
  if (daysLate >= 30) return "expired";
  if (daysLate >= 14) return "wayOverdue";
  if (daysLate >= 1) return "overdue";

  return "red";
}

function computeStatus(now, dueAt) {
  const phase = computePhase(now, dueAt);
  return phase;
}

function nextMondayAt0900(now) {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun, 1=Mon,...6=Sat

  // If today is Monday and before 09:00, use today 09:00
  if (day === 1) {
    const todayAt = atTime(d, 9, 0);
    if (todayAt.getTime() > now.getTime()) return todayAt;
  }

  // Otherwise, find next Monday
  const daysUntilMonday = (1 - day + 7) % 7 || 7;
  const nextMon = addDays(startOfDay(d), daysUntilMonday);
  return atTime(nextMon, 9, 0);
}

function nextDailyAt(now, hour, minute) {
  const todayAt = atTime(now, hour, minute);
  if (todayAt.getTime() > now.getTime()) return todayAt;
  const tomorrow = addDays(startOfDay(now), 1);
  return atTime(tomorrow, hour, minute);
}

function nextFromSlots(now, slots) {
  const todayStart = startOfDay(now);
  for (const slot of slots) {
    const candidate = atTime(todayStart, slot.hour, slot.minute);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  const tomorrow = addDays(todayStart, 1);
  const first = slots[0];
  return atTime(tomorrow, first.hour, first.minute);
}

function nextRedSlot(now) {
  const slots = [];
  for (let h = 8; h <= 22; h += 2) {
    slots.push({ hour: h, minute: 0 });
  }
  return nextFromSlots(now, slots);
}

function nextOverdue(now) {
  return nextDailyAt(now, 9, 0);
}

function nextWayOverdue(now) {
  const threeDays = addDays(startOfDay(now), 3);
  return atTime(threeDays, 9, 0);
}

function computeNextRemindAt(phase, now) {
  switch (phase) {
    case "dormant":
      return null;
    case "white":
      return nextMondayAt0900(now);
    case "green":
      return nextDailyAt(now, 12, 0);
    case "yellow":
      return nextFromSlots(now, [
        { hour: 9, minute: 0 },
        { hour: 12, minute: 0 },
        { hour: 15, minute: 0 },
      ]);
    case "red":
      return nextRedSlot(now);
    case "overdue":
      return nextOverdue(now);
    case "wayOverdue":
      return nextWayOverdue(now);
    case "expired":
      return null;
    default:
      return null;
  }
}

function isExpired(now, dueAt) {
  const phase = computePhase(now, dueAt);
  return phase === "expired";
}

module.exports = {
  computePhase,
  computeStatus,
  computeNextRemindAt,
  isExpired,
  diffInDays,
  diffLateDays,
};
