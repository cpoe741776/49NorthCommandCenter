// src/services/reminderService.js

export async function fetchReminders() {
  const res = await fetch('/.netlify/functions/getReminders');
  if (!res.ok) throw new Error(`Failed to fetch reminders: ${res.status}`);
  return res.json();
}

export async function createWebinarReminder(webinarId, timing) {
  const res = await fetch('/.netlify/functions/createWebinarReminderEmail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webinarId, timing })
  });
  if (!res.ok) throw new Error(`Failed to create reminder: ${res.status}`);
  return res.json();
}

// ✅ Executive Assistant tasks: pulled from getReminders with a flag (does NOT break existing callers)
export async function fetchExecutiveTasks() {
  const res = await fetch('/.netlify/functions/getReminders?includeExecutiveTasks=1', {
    headers: { 'cache-control': 'no-cache' }
  });
  if (!res.ok) throw new Error(`Failed to fetch executive tasks: ${res.status}`);

  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new Error(data.error || 'Failed to fetch executive tasks');

  return Array.isArray(data.executiveTasks) ? data.executiveTasks : [];
}

// ✅ Update an existing reminder/task (by id): action "reschedule" | "complete"
export async function updateReminder({ id, action, dueAt }) {
  const res = await fetch('/.netlify/functions/updateReminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, dueAt })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to update reminder: ${res.status}`);
  }
  return data;
}
