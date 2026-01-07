// src/components/ExecutiveAssistant.jsx
import React, { useState, useCallback } from "react";
import { PlusCircle } from "lucide-react";

const initialState = {
  type: "Personal",
  title: "",
  notes: "",
  priority: "code-green",
  contactEmail: "",
  dueAtLocal: ""
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalDateTimeInputValue(dateObj) {
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

function toIsoFromLocalDateTime(dueAtLocal) {
  if (!dueAtLocal || !String(dueAtLocal).trim()) return "";
  const d = new Date(dueAtLocal); // interpreted as local time
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return "";
  return d.toISOString();
}

function addMinutesFromNow(mins) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

function addHoursFromNow(hours) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + hours);
  return d;
}

// Normalization: trim, collapse whitespace, normalize newlines
function normalizeText(s) {
  if (s == null) return "";
  const str = String(s);

  // Convert CRLF to LF, trim outer whitespace
  const trimmed = str.replace(/\r\n/g, "\n").trim();

  // Collapse runs of spaces/tabs; keep newlines but collapse multiple blank lines
  const collapseSpaces = trimmed.replace(/[ \t]+/g, " ");
  const collapseBlankLines = collapseSpaces.replace(/\n{3,}/g, "\n\n");

  return collapseBlankLines;
}

function normalizeEmail(s) {
  const e = normalizeText(s).toLowerCase();
  return e;
}

const ExecutiveAssistant = () => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [quickHours, setQuickHours] = useState(2);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setDueToDate = (dateObj) => {
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

      // Normalize user inputs
      const type = normalizeText(form.type) || "Personal";
      const title = normalizeText(form.title);
      const notes = normalizeText(form.notes);
      const priority = normalizeText(form.priority) || "code-green";
      const contactEmail = normalizeEmail(form.contactEmail);

      // Local time (England for you) -> ISO
      const dueAtIso = toIsoFromLocalDateTime(form.dueAtLocal);

      const payload = {
        type,
        title,
        notes,
        priority,
        contactEmail,
        createdAt,
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

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-gray-700">Quick set:</span>

            <button
              type="button"
              onClick={() => setDueToDate(addMinutesFromNow(15))}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Set due time to 15 minutes from now (local)"
            >
              +15m
            </button>

            <button
              type="button"
              onClick={() => setDueToDate(addMinutesFromNow(30))}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Set due time to 30 minutes from now (local)"
            >
              +30m
            </button>

            <span className="text-sm text-gray-700 ml-2">In</span>

            <select
              value={quickHours}
              onChange={(e) => setQuickHours(parseInt(e.target.value, 10))}
              className="p-2 border rounded"
              title="Choose hours from now (local)"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                <option key={h} value={h}>
                  {h} hour{h === 1 ? "" : "s"}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setDueToDate(addHoursFromNow(quickHours))}
              className="px-3 py-1 rounded border hover:bg-gray-50"
              title="Set due time to selected hours from now (local)"
            >
              Set
            </button>

            <button
              type="button"
              onClick={clearDue}
              className="px-3 py-1 rounded border hover:bg-gray-50 ml-auto"
              title="Clear due time (starts immediately)"
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-gray-600 mt-1">
            Times are based on your local computer time (England). The system stores an ISO timestamp.
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
