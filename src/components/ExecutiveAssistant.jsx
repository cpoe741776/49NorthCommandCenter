// src/components/ExecutiveAssistant.jsx
import React, { useState, useCallback } from "react";
import { PlusCircle } from "lucide-react";

const initialState = {
  type: "Personal",
  title: "",
  notes: "",
  priority: "code-green",
  contactEmail: "",
  // UI uses local time via datetime-local. We'll convert to ISO on submit.
  dueAtLocal: "" // e.g. "2026-01-07T15:00"
};

function toIsoFromLocalDateTime(dueAtLocal) {
  if (!dueAtLocal || !String(dueAtLocal).trim()) return "";
  const d = new Date(dueAtLocal); // interpreted as local time
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return "";
  return d.toISOString();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalDateTimeInputValue(dateObj) {
  // Convert Date -> "YYYY-MM-DDTHH:mm" in local time for datetime-local input
  const yyyy = dateObj.getFullYear();
  const mm = pad2(dateObj.getMonth() + 1);
  const dd = pad2(dateObj.getDate());
  const hh = pad2(dateObj.getHours());
  const mi = pad2(dateObj.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function minNowLocal() {
  return toLocalDateTimeInputValue(new Date());
}

function todayAt(hour24, minute = 0) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour24, minute, 0, 0);
  // If that time already passed today, keep it today anyway (user intent),
  // but min=now will prevent selecting in the past unless you clear min.
  return d;
}

function tomorrowAt(hour24, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setSeconds(0, 0);
  d.setHours(hour24, minute, 0, 0);
  return d;
}

const ExecutiveAssistant = () => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setDueQuick = (dateObj) => {
    setForm((prev) => ({
      ...prev,
      dueAtLocal: toLocalDateTimeInputValue(dateObj)
    }));
  };

  const clearDue = () => {
    setForm((prev) => ({ ...prev, dueAtLocal: "" }));
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      const createdAt = new Date().toISOString();
      const dueAtIso = toIsoFromLocalDateTime(form.dueAtLocal);

      const payload = {
        type: form.type,
        title: form.title,
        notes: form.notes,
        priority: form.priority,
        contactEmail: form.contactEmail,
        createdAt,
        // If blank, backend defaults dueAt to createdAt (immediate).
        // If set, backend will defer activation until this timestamp.
        dueAt: dueAtIso || ""
      };

      try {
        const res = await fetch("/.netlify/functions/createReminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setSuccessMsg("Reminder created successfully.");
          setForm(initialState);
        } else {
          setErrorMsg(data.error || `Failed to create reminder (HTTP ${res.status}).`);
        }
      } catch (err) {
        setErrorMsg(err?.message || "Unexpected error.");
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4 text-brand-blue">
        Executive Assistant – Create Reminder
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Reminder Type</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            <option value="Personal">Personal</option>
            <option value="Professional">Professional</option>
            <option value="CRM">CRM-Linked</option>
          </select>
        </div>

        {form.type === "CRM" && (
          <div>
            <label className="block font-semibold mb-1">CRM Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              value={form.contactEmail}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="someone@example.com"
            />
          </div>
        )}

        <div>
          <label className="block font-semibold mb-1">Title</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            placeholder="What should I remind you about?"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            rows="3"
            placeholder="Optional notes"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Due Date/Time</label>
          <input
            type="datetime-local"
            name="dueAtLocal"
            value={form.dueAtLocal}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            min={minNowLocal()}
          />

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => setDueQuick(todayAt(15, 0))}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Sets due time to today at 3:00 PM (local)"
            >
              Today 3 PM
            </button>

            <button
              type="button"
              onClick={() => setDueQuick(tomorrowAt(9, 0))}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Sets due time to tomorrow at 9:00 AM (local)"
            >
              Tomorrow 9 AM
            </button>

            <button
              type="button"
              onClick={clearDue}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Clears due time (starts immediately)"
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-gray-600 mt-1">
            Leave blank to start reminders immediately. Pick a date/time to defer activation.
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Priority</label>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            <option value="code-red">🔥 Code Red – Every 15 min</option>
            <option value="code-yellow">⚠️ Code Yellow – Every 1 hour</option>
            <option value="code-green">✅ Code Green – Every 4 hours</option>
            <option value="code-white">📘 Code White – Every 8 hours</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-blue hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <PlusCircle size={18} />
          {loading ? "Creating…" : "Create Reminder"}
        </button>

        {successMsg && <div className="text-green-600 font-semibold mt-2">{successMsg}</div>}
        {errorMsg && <div className="text-red-600 font-semibold mt-2">{errorMsg}</div>}
      </form>
    </div>
  );
};

export default ExecutiveAssistant;
