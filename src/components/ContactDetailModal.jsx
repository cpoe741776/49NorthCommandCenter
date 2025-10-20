// src/components/ContactDetailModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Mail, Phone, FileText, Edit, Save, Plus,
  Video, MessageSquare, Clock, Users, RefreshCw
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
          email: data.contact?.email || '',
          jobTitle: data.contact?.jobTitle || '',
          credentials: data.contact?.attributes?.CREDENTIALS || '',
          organization: data.contact?.organization || '',
          organizationType: data.contact?.organizationType || '',
          organizationSize: data.contact?.attributes?.ORGANIZATION_SIZE || '',
          organizationAddress: data.contact?.organizationAddress || '',
          city: data.contact?.city || '',
          state: data.contact?.state || '',
          county: data.contact?.county || '',
          zipCode: data.contact?.zipCode || '',
          country: data.contact?.country || '',
          phoneOffice: data.contact?.phoneOffice || '',
          phoneMobile: data.contact?.phoneMobile || '',
          phoneExtension: data.contact?.phoneExtension || '',
          whatsapp: data.contact?.whatsapp || '',
          linkedin: data.contact?.linkedin || '',
          areasOfInterest: data.contact?.areasOfInterest || '',
          customTag: data.contact?.customTag || '',
          sourcedFrom: data.contact?.sourcedFrom || ''
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
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  {/* Basic Contact Info */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email (Read-Only)</label>
                        <input
                          type="email"
                          value={editForm.email}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Job Title</label>
                        <input
                          type="text"
                          value={editForm.jobTitle}
                          onChange={(e) => setEditForm({...editForm, jobTitle: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Credentials</label>
                        <input
                          type="text"
                          value={editForm.credentials}
                          onChange={(e) => setEditForm({...editForm, credentials: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., PhD, MBA, etc."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Organization Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">Organization</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Organization Name</label>
                        <input
                          type="text"
                          value={editForm.organization}
                          onChange={(e) => setEditForm({...editForm, organization: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Organization Type</label>
                        <input
                          type="text"
                          value={editForm.organizationType}
                          onChange={(e) => setEditForm({...editForm, organizationType: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Agency, Non-Profit, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Organization Size</label>
                        <input
                          type="text"
                          value={editForm.organizationSize}
                          onChange={(e) => setEditForm({...editForm, organizationSize: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 50-200, 1000+, etc."
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Organization Address</label>
                        <input
                          type="text"
                          value={editForm.organizationAddress}
                          onChange={(e) => setEditForm({...editForm, organizationAddress: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">Location</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                        <input
                          type="text"
                          value={editForm.city}
                          onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">State/Province</label>
                        <input
                          type="text"
                          value={editForm.state}
                          onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">County</label>
                        <input
                          type="text"
                          value={editForm.county}
                          onChange={(e) => setEditForm({...editForm, county: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Zip/Postal Code</label>
                        <input
                          type="text"
                          value={editForm.zipCode}
                          onChange={(e) => setEditForm({...editForm, zipCode: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Country/Region</label>
                        <input
                          type="text"
                          value={editForm.country}
                          onChange={(e) => setEditForm({...editForm, country: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Methods */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">Contact Methods</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Office Phone</label>
                        <input
                          type="tel"
                          value={editForm.phoneOffice}
                          onChange={(e) => setEditForm({...editForm, phoneOffice: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Phone</label>
                        <input
                          type="tel"
                          value={editForm.phoneMobile}
                          onChange={(e) => setEditForm({...editForm, phoneMobile: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Extension</label>
                        <input
                          type="text"
                          value={editForm.phoneExtension}
                          onChange={(e) => setEditForm({...editForm, phoneExtension: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp</label>
                        <input
                          type="tel"
                          value={editForm.whatsapp}
                          onChange={(e) => setEditForm({...editForm, whatsapp: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">LinkedIn Profile</label>
                        <input
                          type="url"
                          value={editForm.linkedin}
                          onChange={(e) => setEditForm({...editForm, linkedin: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">Additional Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Areas of Interest</label>
                        <textarea
                          value={editForm.areasOfInterest}
                          onChange={(e) => setEditForm({...editForm, areasOfInterest: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          rows="2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Sourced From</label>
                        <input
                          type="text"
                          value={editForm.sourcedFrom}
                          onChange={(e) => setEditForm({...editForm, sourcedFrom: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Webinar, Website, Referral"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Custom Tag</label>
                        <input
                          type="text"
                          value={editForm.customTag}
                          onChange={(e) => setEditForm({...editForm, customTag: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                    <strong>Note:</strong> Webinar data, ratings, survey responses, and timestamps are read-only and managed automatically.
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Basic Contact Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-600">First Name:</span>
                      <div className="text-gray-900">{details?.contact?.firstName || '—'}</div>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Last Name:</span>
                      <div className="text-gray-900">{details?.contact?.lastName || '—'}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold text-gray-600">Email:</span>
                      <div className="text-gray-900">{details?.contact?.email || '—'}</div>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Job Title:</span>
                      <div className="text-gray-900">{details?.contact?.jobTitle || '—'}</div>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Credentials:</span>
                      <div className="text-gray-900">{details?.contact?.attributes?.CREDENTIALS || '—'}</div>
                    </div>
                  </div>

                  {/* Organization Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Organization</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">Organization Name:</span>
                        <div className="text-gray-900">{details?.contact?.organization || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Organization Type:</span>
                        <div className="text-gray-900">{details?.contact?.organizationType || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Organization Size:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.ORGANIZATION_SIZE || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Organization Address:</span>
                        <div className="text-gray-900">{details?.contact?.organizationAddress || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Location Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Location</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">City:</span>
                        <div className="text-gray-900">{details?.contact?.city || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">State/Province:</span>
                        <div className="text-gray-900">{details?.contact?.state || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">County:</span>
                        <div className="text-gray-900">{details?.contact?.county || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Zip/Postal Code:</span>
                        <div className="text-gray-900">{details?.contact?.zipCode || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Country/Region:</span>
                        <div className="text-gray-900">{details?.contact?.country || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Methods */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Contact Methods</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">Office Phone:</span>
                        <div className="text-gray-900">{details?.contact?.phoneOffice || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Mobile Phone:</span>
                        <div className="text-gray-900">{details?.contact?.phoneMobile || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Phone Extension:</span>
                        <div className="text-gray-900">{details?.contact?.phoneExtension || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">WhatsApp:</span>
                        <div className="text-gray-900">{details?.contact?.whatsapp || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">LinkedIn Profile:</span>
                        <div className="text-gray-900">
                          {details?.contact?.linkedin ? (
                            <a href={details.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {details.contact.linkedin}
                            </a>
                          ) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Webinar & Engagement Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Webinar & Engagement</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">Webinars Attended Count:</span>
                        <div className="text-gray-900">{details?.contact?.webinarsAttendedCount || 0}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Attended Webinar:</span>
                        <div className="text-gray-900">
                          {details?.contact?.attendedWebinar === 'Yes' ? (
                            <span className="text-green-600 font-semibold">✓ Yes</span>
                          ) : (
                            <span className="text-gray-500">No</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Survey Contact Request:</span>
                        <div className="text-gray-900">
                          {details?.contact?.surveyContact === 'Yes' ? (
                            <span className="text-green-600 font-semibold">✓ Yes - Contact Me</span>
                          ) : (
                            <span className="text-gray-500">No</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Webinar ID:</span>
                        <div className="text-gray-900">{details?.contact?.webinarId || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Webinar Topic:</span>
                        <div className="text-gray-900">{details?.contact?.webinarTopic || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Webinar Start Time:</span>
                        <div className="text-gray-900">{details?.contact?.webinarStartTime || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Registration Time:</span>
                        <div className="text-gray-900">{details?.contact?.registrationTime || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Survey & Interest Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Survey & Interests</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Areas of Interest:</span>
                        <div className="text-gray-900">{details?.contact?.areasOfInterest || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Importance of Mental Strength:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.IMPORTANCE_OF_MENTAL_STRENGTH || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Implemented Initiative:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.IMPLEMENTED_INITIATIVE || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Webinar Gain Expectation:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.WEBINAR_GAIN_EXPECTATION || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Org Promotes Mental Strength:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.ORG_PROMOTES_MENTAL_STRENGTH || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Org Has Effective Initiative:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.ORG_HAS_EFFECTIVE_INITIATIVE || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Leadership Mental Strength View:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.LEADERSHIP_MENTAL_STRENGTH_VIEW || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Will Share:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.WILL_SHARE || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Will Attend Again:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.WILL_ATTEND_AGAIN || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Quote Interest:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.QUOTE_INTEREST || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-600">Comments:</span>
                        <div className="text-gray-900 whitespace-pre-wrap">{details?.contact?.attributes?.COMMENTS || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Ratings */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Ratings & Feedback</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">Relevance Rating:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.RELEVANCE_RATING || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Rating - Rhonda:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.RATING_RHONDA || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Rating - Chris:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.RATING_CHRIS || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Rating - Guest:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.RATING_GUEST || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Source & Metadata */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Source & Tracking</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">Sourced From:</span>
                        <div className="text-gray-900">{details?.contact?.sourcedFrom || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">How Can We Assist:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.ASST_ORG_HOW || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Referral/How Heard:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.REFERRAL_HEAR || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Contact ID:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.CONTACT_ID || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Initial Contact Time:</span>
                        <div className="text-gray-900">{details?.contact?.initialContactTime || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Last Changed:</span>
                        <div className="text-gray-900">{details?.contact?.lastChanged || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Survey Submitted Time:</span>
                        <div className="text-gray-900">{details?.contact?.attributes?.SURVEY_SUBMITTED_TIME || '—'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Custom Tag:</span>
                        <div className="text-gray-900">{details?.contact?.customTag || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Duration & Attendance Details */}
                  {(details?.contact?.attributes?.JOIN_TIME || details?.contact?.attributes?.LEAVE_TIME || details?.contact?.attributes?.DURATION_MINUTES) && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Attendance Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-600">Join Time:</span>
                          <div className="text-gray-900">{details?.contact?.attributes?.JOIN_TIME || '—'}</div>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">Leave Time:</span>
                          <div className="text-gray-900">{details?.contact?.attributes?.LEAVE_TIME || '—'}</div>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">Duration (Minutes):</span>
                          <div className="text-gray-900">{details?.contact?.attributes?.DURATION_MINUTES || '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
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

