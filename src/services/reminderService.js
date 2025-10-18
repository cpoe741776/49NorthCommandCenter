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

