// src/components/ExecutiveAssistant.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { PlusCircle, RefreshCw, CheckCircle2, CalendarClock } from "lucide-react";
import { fetchExecutiveTasks, updateReminder } from "../services/reminderService";

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
  const d = new Date(dueAtLocal); // local time
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

function normalizeText(s) {
  if (s == null) return "";
  const str = String(s);
  const trimmed = str.replace(/\r\n/g, "\n").trim();
  const collapseSpaces = trimmed.replace(/[ \t]+/g, " ");
  const collapseBlankLines = collapseSpaces.replace(/\n{3,}/g, "\n\n");
  return collapseBlankLines;
}

function normalizeEmail(s) {
  return normalizeText(s).toLowerCase();
}

function parseISO(s) {
  const t = Date.parse(String(s || ""));
  return Number.isFinite(t) ? new Date(t) : null;
}

function formatLocal(dt) {
  if (!dt) return "";
  try {
    return dt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(dt);
  }
}

const ExecutiveAssistant = () => {
  // Create form
  const [form, setForm] = useState(initialState);
  const [quickHours, setQuickHours] = useState(2);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Task list
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [rescheduleDraft, setRescheduleDraft] = useState({}); // { [id]: "YYYY-MM-DDTHH:mm" }
  const [rowBusy, setRowBusy] = useState({}); // { [id]: true }

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

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError("");
    try {
      const list = await fetchExecutiveTasks();
      setTasks(Array.isArray(list) ? list : []);
    } catch (e) {
      setTasksError(e?.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      const createdAt = new Date().toISOString();

      const type = normalizeText(form.type) || "Personal";
      const title = normalizeText(form.title);
      const notes = normalizeText(form.notes);
      const priority = normalizeText(form.priority) || "code-green";
      const contactEmail = normalizeEmail(form.contactEmail);

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
          await loadTasks();
        } else {
          setErrorMsg(data.error || `Failed to create reminder (HTTP ${res.status}).`);
        }
      } catch (err) {
        setErrorMsg(err?.message || "Unexpected error.");
      } finally {
        setLoading(false);
      }
    },
    [form, loadTasks]
  );

  const sortedTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks.slice() : [];
    const statusRank = (s) => (String(s || "").toLowerCase() === "open" ? 0 : 1);

    list.sort((a, b) => {
      const sa = statusRank(a.status);
      const sb = statusRank(b.status);
      if (sa !== sb) return sa - sb;

      const da = Date.parse(String(a.dueAt || "")) || 0;
      const db = Date.parse(String(b.dueAt || "")) || 0;
      return da - db;
    });

    return list;
  }, [tasks]);

  const startReschedule = (task) => {
    const existing = parseISO(task?.dueAt);
    setRescheduleDraft((prev) => ({
      ...prev,
      [task.id]: existing ? toLocalDateTimeInputValue(existing) : minNowLocal()
    }));
  };

  const saveReschedule = async (taskId) => {
    const local = rescheduleDraft[taskId];
    const iso = toIsoFromLocalDateTime(local);

    if (!iso) {
      setTasksError("Please choose a valid date/time to reschedule.");
      return;
    }

    setRowBusy((p) => ({ ...p, [taskId]: true }));
    try {
      await updateReminder({ id: taskId, action: "reschedule", dueAt: iso });
      setRescheduleDraft((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
      await loadTasks();
    } catch (e) {
      setTasksError(e?.message || "Failed to reschedule");
    } finally {
      setRowBusy((p) => ({ ...p, [taskId]: false }));
    }
  };

  const markComplete = async (taskId) => {
    setRowBusy((p) => ({ ...p, [taskId]: true }));
    try {
      await updateReminder({ id: taskId, action: "complete" });
      await loadTasks();
    } catch (e) {
      setTasksError(e?.message || "Failed to complete task");
    } finally {
      setRowBusy((p) => ({ ...p, [taskId]: false }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4 text-brand-blue">
        Executive Assistant – Create Reminder
      </h2>

      {/* Create Reminder Form */}
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
            >
              +15m
            </button>

            <button
              type="button"
              onClick={() => setDueToDate(addMinutesFromNow(30))}
              className="px-3 py-1 rounded border hover:bg-gray-50"
            >
              +30m
            </button>

            <span className="text-sm text-gray-700 ml-2">In</span>

            <select
              value={quickHours}
              onChange={(e) => setQuickHours(parseInt(e.target.value, 10))}
              className="p-2 border rounded"
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
            >
              Set
            </button>

            <button
              type="button"
              onClick={clearDue}
              className="px-3 py-1 rounded border hover:bg-gray-50 ml-auto"
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-gray-600 mt-1">
            Times are based on your local computer time (England). Saved to the sheet as an ISO timestamp.
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

      {/* Task List */}
      <div className="mt-10 border-t pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">
            Executive Assistant Task List
          </h3>

          <button
            type="button"
            onClick={loadTasks}
            className="px-3 py-1 rounded border hover:bg-gray-50 flex items-center gap-2"
            disabled={tasksLoading}
            title="Refresh tasks"
          >
            <RefreshCw size={16} />
            {tasksLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {tasksError && (
          <div className="text-red-600 font-semibold mt-3">{tasksError}</div>
        )}

        {tasksLoading && (
          <div className="text-gray-600 mt-3">Loading tasks…</div>
        )}

        {!tasksLoading && !sortedTasks.length && (
          <div className="text-gray-600 mt-3">No tasks found.</div>
        )}

        <div className="mt-4 space-y-3">
          {sortedTasks.map((t) => {
            const id = String(t.id || "");
            const isOpen = String(t.status || "").toLowerCase() === "open";
            const due = parseISO(t.dueAt);
            const last = parseISO(t.lastNotifiedAt);
            const busy = !!rowBusy[id];
            const showResched = rescheduleDraft[id] != null;

            return (
              <div key={id} className="border rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {t.title || "Untitled"}
                    </div>

                    <div className="text-sm text-gray-700 mt-1">
                      <span className="font-semibold">Due:</span>{" "}
                      {due ? formatLocal(due) : "(none)"}
                      {"  "}
                      <span className="mx-2">•</span>
                      <span className="font-semibold">Priority:</span>{" "}
                      {String(t.priority || "").toLowerCase()}
                      {"  "}
                      <span className="mx-2">•</span>
                      <span className="font-semibold">Status:</span>{" "}
                      {isOpen ? "open" : "closed"}
                    </div>

                    {(t.notes || t.rawText || last) && (
                      <div className="text-sm text-gray-600 mt-2">
                        {t.notes ? (
                          <div>
                            <span className="font-semibold">Notes:</span> {t.notes}
                          </div>
                        ) : null}
                        {last ? (
                          <div>
                            <span className="font-semibold">Last notified:</span> {formatLocal(last)}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1 rounded border hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => startReschedule(t)}
                      disabled={busy}
                      title="Reschedule this task"
                    >
                      <CalendarClock size={16} />
                      Reschedule
                    </button>

                    <button
                      type="button"
                      className="px-3 py-1 rounded border hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => markComplete(id)}
                      disabled={busy || !isOpen}
                      title="Mark task as completed"
                    >
                      <CheckCircle2 size={16} />
                      Task Completed
                    </button>
                  </div>
                </div>

                {showResched && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      value={rescheduleDraft[id]}
                      min={minNowLocal()}
                      onChange={(e) =>
                        setRescheduleDraft((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      className="p-2 border rounded"
                    />

                    <button
                      type="button"
                      className="px-3 py-1 rounded border hover:bg-gray-50"
                      onClick={() => saveReschedule(id)}
                      disabled={busy}
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      className="px-3 py-1 rounded border hover:bg-gray-50"
                      onClick={() =>
                        setRescheduleDraft((prev) => {
                          const copy = { ...prev };
                          delete copy[id];
                          return copy;
                        })
                      }
                      disabled={busy}
                    >
                      Cancel
                    </button>

                    <div className="text-xs text-gray-600 ml-auto">
                      Rescheduling clears lastNotifiedAt so it can alert again at the new due time.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveAssistant;
