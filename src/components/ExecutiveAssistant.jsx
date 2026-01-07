// src/components/ExecutiveAssistant.jsx
import React, { useState, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';

const initialState = {
  type: 'Personal',
  title: '',
  notes: '',
  priority: 'code-green',
  contactEmail: '',
};

const ExecutiveAssistant = () => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      ...form,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/.netlify/functions/createReminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Reminder created successfully.');
        setForm(initialState);
      } else {
        setErrorMsg(data.error || 'Failed to create reminder.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4 text-brand-blue">Executive Assistant – Create Reminder</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Reminder Type</label>
          <select name="type" value={form.type} onChange={handleChange} className="w-full p-2 border rounded">
            <option value="Personal">Personal</option>
            <option value="Professional">Professional</option>
            <option value="CRM">CRM-Linked</option>
          </select>
        </div>

        {form.type === 'CRM' && (
          <div>
            <label className="block font-semibold mb-1">CRM Contact Email</label>
            <input type="email" name="contactEmail" value={form.contactEmail} onChange={handleChange} className="w-full p-2 border rounded" placeholder="someone@example.com" />
          </div>
        )}

        <div>
          <label className="block font-semibold mb-1">Title</label>
          <input type="text" name="title" value={form.title} onChange={handleChange} className="w-full p-2 border rounded" placeholder="What should I remind you about?" />
        </div>

        <div>
          <label className="block font-semibold mb-1">Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full p-2 border rounded" rows="3" placeholder="Optional notes" />
        </div>

        <div>
          <label className="block font-semibold mb-1">Priority</label>
          <select name="priority" value={form.priority} onChange={handleChange} className="w-full p-2 border rounded">
            <option value="code-red">🔥 Code Red – Every 15 min</option>
            <option value="code-yellow">⚠️ Code Yellow – Every 1 hour</option>
            <option value="code-green">✅ Code Green – Every 4 hours</option>
            <option value="code-white">📘 Code White – Every 8 hours</option>
          </select>
        </div>

        <button type="submit" disabled={loading} className="bg-brand-blue hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2">
          <PlusCircle size={18} />
          {loading ? 'Creating…' : 'Create Reminder'}
        </button>

        {successMsg && <div className="text-green-600 font-semibold mt-2">{successMsg}</div>}
        {errorMsg && <div className="text-red-600 font-semibold mt-2">{errorMsg}</div>}
      </form>
    </div>
  );
};

export default ExecutiveAssistant;
