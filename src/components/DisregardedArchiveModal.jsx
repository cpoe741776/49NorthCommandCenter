// DisregardedArchiveModal.jsx //

import React, { useState } from 'react';
import { X, Mail, Calendar, Building2, Eye, RotateCcw, AlertCircle } from 'lucide-react';

const DisregardedArchiveModal = ({ isOpen, onClose, emails, onRevive, onRefresh }) => {
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [reviving, setReviving] = useState(null);

  if (!isOpen) return null;

  const handleRevive = async (email, newRecommendation) => {
    if (!window.confirm(
      `Revive this email as "${newRecommendation}"?\n\n` +
      `This will move it back to Active_Bids where you can work on it.`
    )) return;
    
    setReviving(email.id);
    try {
      await onRevive(email, newRecommendation);
      setSelectedEmail(null); // Clear selection after revival
      onRefresh();
    } catch (err) {
      alert('Failed to revive: ' + err.message);
    } finally {
      setReviving(null);
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
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Disregarded Archive</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and revive emails that were previously disregarded
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
                <p>No disregarded emails</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedEmail?.id === email.id
                        ? 'bg-orange-50 border-l-4 border-orange-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {email.bidSystem !== 'Unknown' && (
                            <>
                              <Building2 size={14} className="text-gray-500 shrink-0" />
                              <span className="text-xs font-semibold text-gray-700 truncate">
                                {email.bidSystem}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                          {email.emailSubject}
                        </h3>
                      </div>
                      <AlertCircle size={16} className="text-orange-500 shrink-0 ml-2" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar size={12} />
                      {formatDate(email.emailDateReceived)}
                    </div>
                    {email.scoreDetails && (
                      <div className="mt-2 text-xs text-gray-500">
                        Score: {email.scoreDetails}
                      </div>
                    )}
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
                        {selectedEmail.bidSystem !== 'Unknown' && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="font-semibold">System:</span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                              {selectedEmail.bidSystem}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-semibold">Date:</span>
                          <span>{formatDate(selectedEmail.emailDateReceived)}</span>
                        </div>
                        {selectedEmail.scoreDetails && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="font-semibold">Score:</span>
                            <span>{selectedEmail.scoreDetails}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleRevive(selectedEmail, 'Respond')}
                        disabled={reviving === selectedEmail.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={16} />
                        {reviving === selectedEmail.id ? 'Processing...' : 'Revive as Respond'}
                      </button>
                      <button
                        onClick={() => handleRevive(selectedEmail, 'Gather More Information')}
                        disabled={reviving === selectedEmail.id}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={16} />
                        {reviving === selectedEmail.id ? 'Processing...' : 'Revive as Gather Info'}
                      </button>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  {selectedEmail.aiReasoning && (
                    <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm font-semibold text-orange-900 mb-2">Why it was disregarded:</p>
                      <p className="text-sm text-gray-700">{selectedEmail.aiReasoning}</p>
                    </div>
                  )}

                  {/* Keywords */}
                  {selectedEmail.keywordsFound && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Keywords Found:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmail.keywordsFound.split(',').map((kw, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Body */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedEmail.emailBody}
                  </p>
                </div>

                {/* Additional Info */}
                {(selectedEmail.url !== 'Not provided' || selectedEmail.dueDate !== 'Not specified' || selectedEmail.entity !== 'Unknown') && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedEmail.url !== 'Not provided' && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">URL</p>
                        <a 
                          href={selectedEmail.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate block"
                        >
                          {selectedEmail.url}
                        </a>
                      </div>
                    )}
                    {selectedEmail.dueDate !== 'Not specified' && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Due Date</p>
                        <p className="text-sm text-gray-900">{selectedEmail.dueDate}</p>
                      </div>
                    )}
                    {selectedEmail.entity !== 'Unknown' && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Entity/Agency</p>
                        <p className="text-sm text-gray-900">{selectedEmail.entity}</p>
                      </div>
                    )}
                  </div>
                )}
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

export default DisregardedArchiveModal;