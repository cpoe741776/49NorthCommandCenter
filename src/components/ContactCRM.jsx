// src/components/ContactCRM.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, RefreshCw, Search, Filter, Download,
  TrendingUp, Star, Calendar, AlertCircle, UserPlus, X
} from 'lucide-react';
import ContactDetailModal from './ContactDetailModal';

const ContactCRM = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, hot-leads, webinar-attendees, cold-leads
  const [selectedContact, setSelectedContact] = useState(null);
  const [page, setPage] = useState(0);
  const [emailLookup, setEmailLookup] = useState('');
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    email: '',
    firstName: '',
    lastName: '',
    organization: '',
    phone: '',
    jobTitle: ''
  });

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('limit', '1000');
      params.append('offset', page * 1000);
      if (filterType !== 'all') params.append('filter', filterType);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`/.netlify/functions/getContacts?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setContacts(data.contacts || []);
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, searchQuery, page]);

  const handleEmailLookup = async () => {
    if (!emailLookup.trim() || !emailLookup.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      const res = await fetch(`/.netlify/functions/getContactDetail?email=${encodeURIComponent(emailLookup.trim())}`);
      const data = await res.json();
      
      if (data.success && data.contact?.exists) {
        setSelectedContact(data.contact);
        setEmailLookup('');
      } else {
        alert(`Contact not found: ${emailLookup}`);
      }
    } catch (err) {
      alert(`Error looking up contact: ${err.message}`);
    }
  };

  const handleCreateContact = async () => {
    if (!newContact.email || !newContact.email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/createContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ Contact created: ${newContact.email}`);
        setShowNewContactModal(false);
        setNewContact({ email: '', firstName: '', lastName: '', organization: '', phone: '', jobTitle: '' });
        loadContacts(); // Refresh list
      } else {
        alert(data.error || 'Failed to create contact');
      }
    } catch (err) {
      alert(`Error creating contact: ${err.message}`);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSync = async () => {
    if (!window.confirm('Sync all webinar registrants and attendees to Brevo? This may take a few minutes.')) {
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/.netlify/functions/syncWebinarContactsToBrevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ Sync complete!\n\nCreated: ${data.created}\nUpdated: ${data.updated}\nErrors: ${data.errors}`);
        loadContacts();
      } else {
        alert(`❌ Sync failed: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const exportToCSV = () => {
    if (contacts.length === 0) {
      alert('No contacts to export');
      return;
    }

    const headers = ['Email', 'Name', 'Organization', 'Job Title', 'Phone', 'City', 'State', 'Lead Status', 'Webinars Attended', 'Survey Contact'];
    const rows = contacts.map(c => [
      c.email,
      c.name,
      c.organization,
      c.jobTitle,
      c.phone,
      c.city,
      c.state,
      c.leadStatus,
      c.webinarsAttendedCount || 0,
      c.surveyContact
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLeadStatusBadge = (status) => {
    if (status === 'Hot Lead') return 'bg-red-100 text-red-800 border-red-300';
    if (status === 'Warm') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-600 border-gray-300';
  };

  const getLeadStatusIcon = (status) => {
    if (status === 'Hot Lead') return '🔥';
    if (status === 'Warm') return '⚡';
    return '❄️';
  };

  if (loading && !contacts.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="text-gray-600">Loading contacts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-blue-600" size={36} />
            Contact CRM
          </h1>
          <p className="text-gray-600 mt-1">Unified contact management powered by Brevo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewContactModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <UserPlus size={18} />
            New Contact
          </button>
          <button
            onClick={loadContacts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <TrendingUp size={18} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Webinars'}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Contacts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalContacts}</p>
              </div>
              <Users className="text-blue-600" size={32} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-lg shadow border-2 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-semibold">Hot Leads</p>
                <p className="text-3xl font-bold text-red-900 mt-1">{summary.hotLeads}</p>
              </div>
              <Star className="text-red-600" size={32} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Webinar Attendees</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.webinarAttendees}</p>
              </div>
              <Users className="text-purple-600" size={32} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Follow-Ups</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.pendingFollowUps}</p>
              </div>
              <Calendar className="text-yellow-600" size={32} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cold Contacts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.coldContacts}</p>
              </div>
              <AlertCircle className="text-gray-400" size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Direct Email Lookup */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg shadow border border-blue-200">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-blue-900 mb-1">
              📧 Direct Contact Lookup (for contacts beyond first 1,000)
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailLookup}
                onChange={(e) => setEmailLookup(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEmailLookup()}
                placeholder="Enter email address to find any contact..."
                className="flex-1 px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleEmailLookup}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Find Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={18} className="text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or organization..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Contacts</option>
              <option value="hot-leads">🔥 Hot Leads</option>
              <option value="webinar-attendees">🎥 Webinar Attendees</option>
              <option value="cold-leads">❄️ Cold Leads</option>
            </select>
          </div>

          <span className="text-sm text-gray-600">
            Showing {contacts.length} of {summary?.totalContacts || 0}
          </span>
        </div>

        {/* Pagination */}
        {summary && summary.totalContacts > 1000 && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page + 1} of {Math.ceil(summary.totalContacts / 1000)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * 1000 >= summary.totalContacts}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Lead Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact Info</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr
                      key={contact.email}
                      onClick={() => setSelectedContact(contact)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">{contact.name}</div>
                          <div className="text-sm text-gray-600">{contact.email}</div>
                          {contact.jobTitle && (
                            <div className="text-xs text-gray-500 mt-1">{contact.jobTitle}</div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {contact.organization || '—'}
                        {contact.organizationType && (
                          <div className="text-xs text-gray-500 mt-1">{contact.organizationType}</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {contact.city && contact.state ? `${contact.city}, ${contact.state}` : 
                         contact.state || contact.city || '—'}
                        {contact.country && (
                          <div className="text-xs text-gray-500 mt-1">{contact.country}</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getLeadStatusBadge(contact.leadStatus)}`}>
                            {getLeadStatusIcon(contact.leadStatus)} {contact.leadStatus}
                          </span>
                          {contact.surveyContact === 'Yes' && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium" title="Survey: Contact me">
                              📋 Survey
                            </span>
                          )}
                        </div>
                        {contact.leadScore > 0 && (
                          <div className="text-xs text-gray-500 mt-1">Score: {contact.leadScore}/100</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-sm">
                        <div className="space-y-1">
                          {contact.webinarsAttendedCount > 0 && (
                            <div className="text-purple-700">
                              🎥 {contact.webinarsAttendedCount} webinar{contact.webinarsAttendedCount > 1 ? 's' : ''}
                            </div>
                          )}
                          {contact.notesCount > 0 && (
                            <div className="text-blue-700">
                              📝 {contact.notesCount} note{contact.notesCount > 1 ? 's' : ''}
                            </div>
                          )}
                          {contact.pendingTasks > 0 && (
                            <div className="text-orange-700 font-semibold">
                              ⏰ {contact.pendingTasks} pending task{contact.pendingTasks > 1 ? 's' : ''}
                            </div>
                          )}
                          {contact.webinarsAttendedCount === 0 && contact.notesCount === 0 && contact.pendingTasks === 0 && (
                            <div className="text-gray-400">No activity</div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {contact.phoneMobile && (
                          <div>📱 {contact.phoneMobile}</div>
                        )}
                        {contact.phoneOffice && (
                          <div>📞 {contact.phoneOffice}</div>
                        )}
                        {contact.linkedin && (
                          <div className="text-blue-600">
                            <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              in/ LinkedIn
                            </a>
                          </div>
                        )}
                        {!contact.phoneMobile && !contact.phoneOffice && !contact.linkedin && '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={loadContacts}
        />
      )}

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="text-purple-600" size={28} />
                <h2 className="text-2xl font-bold text-gray-900">Create New Contact</h2>
              </div>
              <button
                onClick={() => {
                  setShowNewContactModal(false);
                  setNewContact({ email: '', firstName: '', lastName: '', organization: '', phone: '', jobTitle: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newContact.jobTitle}
                    onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
                    placeholder="e.g., HR Director"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    placeholder="First name"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    placeholder="Last name"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Organization</label>
                  <input
                    type="text"
                    value={newContact.organization}
                    onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                    placeholder="Organization name"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Contact will be added to Brevo's DATABASE MASTER list (ID 108)
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewContactModal(false);
                  setNewContact({ email: '', firstName: '', lastName: '', organization: '', phone: '', jobTitle: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateContact}
                className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
              >
                Create Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactCRM;

