// SystemsCorrespondenceModal.jsx //

import React, { useState } from 'react';
import { X, Mail, Calendar, Building2, Eye, Trash2 } from 'lucide-react';

const SystemsCorrespondenceModal = ({ isOpen, onClose, emails, onArchive, onRefresh }) => {
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [deleting, setDeleting] = useState(null);

  if (!isOpen) return null;

  const handleDelete = async (email) => {
    if (!window.confirm(`Delete this message from ${email.bidSystem}? This action cannot be undone.`)) return;
    
    setDeleting(email.id);
    try {
      await onArchive(email); // Still uses onArchive prop for backend compatibility
      onRefresh();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Systems Correspondence</h2>
            <p className="text-sm text-gray-600 mt-1">
              Administrative notifications from bid systems
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Email List */}
          <div className="w-2/5 border-r border-gray-200 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No system correspondence</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedEmail?.id === email.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 size={14} className="text-gray-500 shrink-0" />
                          <span className="text-xs font-semibold text-gray-700 truncate">
                            {email.bidSystem}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                          {email.emailSubject}
                        </h3>
                      </div>
                      {email.status === 'New' && (
                        <span className="ml-2 shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar size={12} />
                      {formatDate(email.emailDateReceived)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Detail */}
          <div className="flex-1 overflow-y-auto">
            {selectedEmail ? (
              <div className="p-6">
                {/* Email Header */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {selectedEmail.emailSubject}
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-semibold">From:</span>
                          <span>{selectedEmail.emailFrom}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-semibold">System:</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {selectedEmail.bidSystem}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-semibold">Date:</span>
                          <span>{formatDate(selectedEmail.emailDateReceived)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(selectedEmail)}
                      disabled={deleting === selectedEmail.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                      {deleting === selectedEmail.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Email Body */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedEmail.emailBody}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Eye size={48} className="mx-auto mb-4" />
                  <p>Select an email to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemsCorrespondenceModal;