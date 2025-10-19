// src/components/ContactDetailModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Mail, Phone, Building, MapPin, Calendar, 
  FileText, CheckCircle2, Edit, Save, Plus,
  ExternalLink, Video, MessageSquare, Clock
} from 'lucide-react';

const ContactDetailModal = ({ contact, isOpen, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [addingNote, setAddingNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ noteType: 'Note', note: '', followUpDate: '' });
  const [addingTask, setAddingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ task: '', dueDate: '' });

  const loadDetails = useCallback(async () => {
    if (!contact?.email) return;
    
    try {
      setLoading(true);
      const res = await fetch(`/.netlify/functions/getContactDetail?email=${encodeURIComponent(contact.email)}`);
      const data = await res.json();
      
      if (data.success) {
        setDetails(data);
        setEditForm({
          firstName: data.contact?.firstName || '',
          lastName: data.contact?.lastName || '',
          organization: data.contact?.organization || '',
          jobTitle: data.contact?.jobTitle || '',
          phoneMobile: data.contact?.phoneMobile || '',
          phoneOffice: data.contact?.phoneOffice || '',
          city: data.contact?.city || '',
          state: data.contact?.state || '',
          country: data.contact?.country || '',
          linkedin: data.contact?.linkedin || ''
        });
      }
    } catch (err) {
      console.error('Failed to load contact details:', err);
    } finally {
      setLoading(false);
    }
  }, [contact]);

  useEffect(() => {
    if (isOpen) {
      loadDetails();
    }
  }, [isOpen, loadDetails]);

  const handleSaveEdit = async () => {
    try {
      const res = await fetch('/.netlify/functions/updateContact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contact.email, ...editForm })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('✅ Contact updated!');
        setEditing(false);
        loadDetails();
        onUpdate?.();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed to update: ${err.message}`);
    }
  };

  const handleAddNote = async () => {
    if (!noteForm.note.trim()) {
      alert('Please enter a note');
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/addContactNote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contact.email,
          noteType: noteForm.noteType,
          note: noteForm.note,
          createdBy: 'user',
          followUpDate: noteForm.followUpDate
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('✅ Note added!');
        setNoteForm({ noteType: 'Note', note: '', followUpDate: '' });
        setAddingNote(false);
        loadDetails();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed to add note: ${err.message}`);
    }
  };

  const handleAddTask = async () => {
    if (!taskForm.task.trim()) {
      alert('Please enter a task');
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/addFollowUpTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contact.email,
          contactName: contact.name,
          task: taskForm.task,
          dueDate: taskForm.dueDate
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('✅ Task created!');
        setTaskForm({ task: '', dueDate: '' });
        setAddingTask(false);
        loadDetails();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed to create task: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="text-white" size={28} />
            <div>
              <h2 className="text-xl font-bold">{contact.name}</h2>
              <p className="text-blue-100 text-sm">{contact.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
            <p className="text-gray-600">Loading contact details...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Contact Information */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-blue-600" />
                  Contact Information
                </h3>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    <Edit size={14} /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <Save size={14} /> Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Organization</label>
                    <input
                      type="text"
                      value={editForm.organization}
                      onChange={(e) => setEditForm({...editForm, organization: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={editForm.jobTitle}
                      onChange={(e) => setEditForm({...editForm, jobTitle: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Phone</label>
                    <input
                      type="text"
                      value={editForm.phoneMobile}
                      onChange={(e) => setEditForm({...editForm, phoneMobile: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Office Phone</label>
                    <input
                      type="text"
                      value={editForm.phoneOffice}
                      onChange={(e) => setEditForm({...editForm, phoneOffice: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">LinkedIn URL</label>
                    <input
                      type="text"
                      value={editForm.linkedin}
                      onChange={(e) => setEditForm({...editForm, linkedin: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-600">Name:</span>
                    <div className="text-gray-900">{details?.contact?.name || '—'}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Email:</span>
                    <div className="text-gray-900">{details?.contact?.email || '—'}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Organization:</span>
                    <div className="text-gray-900">{details?.contact?.organization || '—'}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Job Title:</span>
                    <div className="text-gray-900">{details?.contact?.jobTitle || '—'}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Mobile:</span>
                    <div className="text-gray-900">{details?.contact?.phoneMobile || '—'}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Office:</span>
                    <div className="text-gray-900">{details?.contact?.phoneOffice || '—'}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Location:</span>
                    <div className="text-gray-900">
                      {details?.contact?.city && details?.contact?.state 
                        ? `${details.contact.city}, ${details.contact.state}`
                        : details?.contact?.state || details?.contact?.city || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">LinkedIn:</span>
                    <div className="text-gray-900">
                      {details?.contact?.linkedin ? (
                        <a href={details.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View Profile
                        </a>
                      ) : '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Webinar History */}
            {details?.webinarHistory && details.webinarHistory.length > 0 && (
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Video size={20} className="text-purple-600" />
                  Webinar Activity ({details.webinarHistory.length})
                </h3>
                <div className="space-y-2">
                  {details.webinarHistory.map((wh, idx) => (
                    <div key={idx} className="bg-white rounded p-3 border border-purple-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{wh.webinarTitle}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {wh.webinarDate} at {wh.webinarTime}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            ✓ Registered
                          </span>
                          {wh.attended ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              ✓ Attended
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              No-show
                            </span>
                          )}
                        </div>
                      </div>
                      {wh.duration && (
                        <div className="text-xs text-gray-500 mt-2">
                          Duration: {wh.duration} minutes
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Survey Responses */}
            {details?.surveyResponses && details.surveyResponses.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <MessageSquare size={20} className="text-green-600" />
                  Survey Responses ({details.surveyResponses.length})
                </h3>
                <div className="space-y-2">
                  {details.surveyResponses.map((survey, idx) => (
                    <div key={idx} className="bg-white rounded p-3 border border-green-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm text-gray-600">
                          {new Date(survey.timestamp).toLocaleDateString()}
                        </div>
                        {survey.contactMe === 'Yes' && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                            📞 Wants Contact
                          </span>
                        )}
                      </div>
                      {survey.relevance && (
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">Relevance:</span> {survey.relevance}
                        </div>
                      )}
                      {survey.challenges && (
                        <div className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">Challenges:</span> {survey.challenges}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-yellow-600" />
                  Notes & Interactions ({details?.notes?.length || 0})
                </h3>
                <button
                  onClick={() => setAddingNote(!addingNote)}
                  className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                >
                  <Plus size={14} /> Add Note
                </button>
              </div>

              {/* Add Note Form */}
              {addingNote && (
                <div className="bg-white rounded p-4 border border-yellow-300 mb-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Note Type</label>
                      <select
                        value={noteForm.noteType}
                        onChange={(e) => setNoteForm({...noteForm, noteType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      >
                        <option value="Note">General Note</option>
                        <option value="Call">Phone Call</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Follow-up">Follow-up</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Note</label>
                      <textarea
                        value={noteForm.note}
                        onChange={(e) => setNoteForm({...noteForm, note: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        rows="3"
                        placeholder="Enter note details..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up Date (optional)</label>
                      <input
                        type="date"
                        value={noteForm.followUpDate}
                        onChange={(e) => setNoteForm({...noteForm, followUpDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddNote}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium"
                      >
                        Save Note
                      </button>
                      <button
                        onClick={() => {
                          setAddingNote(false);
                          setNoteForm({ noteType: 'Note', note: '', followUpDate: '' });
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes List */}
              {details?.notes && details.notes.length > 0 ? (
                <div className="space-y-2">
                  {details.notes.map((note, idx) => (
                    <div key={idx} className="bg-white rounded p-3 border border-yellow-100">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs font-semibold">
                            {note.noteType}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.timestamp).toLocaleDateString()} - {note.createdBy}
                          </span>
                        </div>
                        {note.followUpDate && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            📅 Follow-up: {note.followUpDate}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{note.note}</p>
                    </div>
                  ))}
                </div>
              ) : !addingNote && (
                <p className="text-sm text-gray-500">No notes yet. Click "Add Note" to start tracking interactions.</p>
              )}
            </div>

            {/* Follow-Up Tasks */}
            {details?.tasks && details.tasks.length > 0 && (
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Clock size={20} className="text-orange-600" />
                  Pending Tasks ({details.tasks.filter(t => t.status === 'Open').length})
                </h3>
                <div className="space-y-2">
                  {details.tasks.filter(t => t.status === 'Open').map((task, idx) => (
                    <div key={idx} className="bg-white rounded p-3 border border-orange-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{task.task}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {new Date(task.createdDate).toLocaleDateString()}
                          </div>
                        </div>
                        {task.dueDate && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            new Date(task.dueDate) < new Date() 
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            Due: {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Mail size={16} /> Send Email
              </button>
              {contact.phoneMobile && (
                <button
                  onClick={() => window.open(`tel:${contact.phoneMobile}`, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Phone size={16} /> Call Mobile
                </button>
              )}
              <button
                onClick={() => setAddingTask(!addingTask)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                <Plus size={16} /> Add Task
              </button>
            </div>

            {/* Add Task Form */}
            {addingTask && (
              <div className="bg-orange-50 rounded p-4 border border-orange-300">
                <h4 className="font-semibold text-gray-900 mb-3">Create Follow-Up Task</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Task Description</label>
                    <textarea
                      value={taskForm.task}
                      onChange={(e) => setTaskForm({...taskForm, task: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      rows="2"
                      placeholder="e.g., Send Q1 training proposal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddTask}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm font-medium"
                    >
                      Create Task
                    </button>
                    <button
                      onClick={() => {
                        setAddingTask(false);
                        setTaskForm({ task: '', dueDate: '' });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactDetailModal;

