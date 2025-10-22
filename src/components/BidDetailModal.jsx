// src/components/BidDetailModal.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { X, ExternalLink, Database } from 'lucide-react';

const withHttp = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const coalesce = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '') || '';

const BidDetailModal = ({ bid, isOpen, onClose, onStatusChange, onSystemClick }) => {
  if (!isOpen || !bid) return null;

  // Debug: log the bid object to see what fields are actually present
  console.log('[BidDetailModal] Bid data:', {
    emailFrom: bid.emailFrom,
    emailDateReceived: bid.emailDateReceived,
    emailSubject: bid.emailSubject,
    aiEmailSummary: bid.aiEmailSummary,
    allKeys: Object.keys(bid)
  });

  const recommendation = coalesce(bid.recommendation);
  const score = coalesce(bid.scoreDetails);
  const emailSubject = coalesce(bid.emailSubject, bid.subject);
  const emailSummary = coalesce(bid.aiEmailSummary, bid.emailSummary, bid.aiSummary);
  const aiReasoning = coalesce(bid.aiReasoning, bid.reasoning);
  const agency = coalesce(bid.entity);
  const dueDate = coalesce(bid.dueDate);
  const relevance = coalesce(bid.relevance);
  const bidSystem = coalesce(bid.bidSystem);
  const keywordsFound = coalesce(bid.keywordsFound);
  const keywordsCategory = coalesce(bid.keywordsCategory);
  const sourceUrl = coalesce(bid.url);
  const emailFrom = coalesce(bid.emailFrom);
  const emailDateReceived = coalesce(bid.emailDateReceived);
  const emailDomain = coalesce(bid.emailDomain);
  const country = coalesce(bid.country);
  const status = coalesce(bid.status);
  const dateAdded = coalesce(bid.dateAdded);
  const sourceEmailId = coalesce(bid.sourceEmailId);
  const significantSnippet = coalesce(bid.significantSnippet);

  const relevanceClass = (rel) => {
    if (rel === 'High') return 'bg-green-100 text-green-800';
    if (rel === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{emailSubject || 'Bid Details'}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                recommendation === 'Respond' ? 'bg-green-600 text-white' :
                recommendation === 'Submitted' ? 'bg-blue-600 text-white' :
                'bg-yellow-600 text-white'
              }`}>
                {recommendation || '—'}
              </span>
              {score && <span className="px-3 py-1 rounded text-sm font-bold bg-gray-100 text-gray-800">Score: {score}</span>}
              {relevance && <span className={`px-3 py-1 rounded text-sm font-medium ${relevanceClass(relevance)}`}>{relevance} Relevance</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* AI Analysis */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">AI Analysis</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-blue-700">Summary:</label>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">{emailSummary || 'No summary available'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-blue-700">Reasoning:</label>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">{aiReasoning || 'No reasoning available'}</p>
              </div>
            </div>
          </div>

          {/* Key Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600">Entity/Agency:</label>
                <p className="text-base text-gray-900 mt-1">{agency || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Due Date:</label>
                <p className="text-base text-gray-900 mt-1">{dueDate || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Email From:</label>
                <p className="text-base text-gray-900 mt-1 break-words">{emailFrom || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Email Date Received:</label>
                <p className="text-base text-gray-900 mt-1">{emailDateReceived || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Email Domain:</label>
                <p className="text-base text-gray-900 mt-1">{emailDomain || 'Unknown'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600">Bid System:</label>
                {bidSystem && bidSystem !== 'Unknown' ? (
                  <button
                    onClick={() => onSystemClick?.(bidSystem)}
                    className="text-base font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 mt-1"
                  >
                    <Database size={16} /> {bidSystem}
                  </button>
                ) : (
                  <p className="text-base text-gray-900 mt-1">{bidSystem || 'Unknown'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Country:</label>
                <p className="text-base text-gray-900 mt-1">{country || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Status:</label>
                <p className="text-base text-gray-900 mt-1">{status || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Date Added:</label>
                <p className="text-base text-gray-900 mt-1">{dateAdded || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Source Email ID:</label>
                <p className="text-xs text-gray-700 mt-1 font-mono">{sourceEmailId || 'Unknown'}</p>
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-600">Keywords Found:</label>
              <p className="text-base text-gray-900 mt-1 break-words">{keywordsFound || 'None'}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600">Keywords Category:</label>
              <p className="text-base text-gray-900 mt-1 break-words">{keywordsCategory || 'None'}</p>
            </div>
          </div>

          {/* Significant Snippet */}
          {significantSnippet && (
            <div>
              <label className="text-sm font-semibold text-gray-600">Significant Snippet:</label>
              <div className="text-base text-gray-900 italic bg-gray-50 p-3 rounded mt-2 border-l-4 border-gray-300">
                "{significantSnippet}"
              </div>
            </div>
          )}

          {/* Original Source */}
          {!!sourceUrl && sourceUrl !== 'Not provided' && (
            <div>
              <label className="text-sm font-semibold text-gray-600">Original Source:</label>
              <a
                href={withHttp(sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base text-blue-600 hover:text-blue-800 flex items-center gap-2 break-all mt-2"
              >
                {withHttp(sourceUrl)} <ExternalLink size={16} className="flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Full Email Body */}
          <details className="border border-gray-200 rounded-lg">
            <summary className="cursor-pointer px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-600">
              Full Email Body
            </summary>
            <div className="p-4 text-sm text-gray-700 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {coalesce(bid.emailBody) || 'No email body available'}
            </div>
          </details>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            {String(recommendation).toLowerCase() !== 'respond' && (
              <button
                onClick={() => { onStatusChange?.(bid.id, 'respond'); onClose(); }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium transition-colors"
              >
                Move to Respond
              </button>
            )}
            <button
              onClick={() => { onStatusChange?.(bid.id, 'submitted'); onClose(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              Mark as Submitted
            </button>
            <button
              onClick={() => { onStatusChange?.(bid.id, 'system-admin'); onClose(); }}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium transition-colors"
              title="Move to System Administration (misclassified bid)"
            >
              → System Admin
            </button>
            <button
              onClick={() => { onStatusChange?.(bid.id, 'disregard'); onClose(); }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium transition-colors"
            >
              Disregard
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium transition-colors ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

BidDetailModal.propTypes = {
  bid: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func,
  onSystemClick: PropTypes.func,
};

BidDetailModal.defaultProps = {
  bid: null,
  onStatusChange: undefined,
  onSystemClick: undefined,
};

export default BidDetailModal;

