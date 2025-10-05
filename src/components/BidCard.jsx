import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

const BidCard = ({ bid, onStatusChange, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const isRespond = bid.recommendation === 'Respond';

  return (
    <div
      className={`border-l-4 ${
        isRespond ? 'border-green-500 bg-green-50'
          : bid.recommendation === 'Submitted' ? 'border-blue-500 bg-blue-50'
          : 'border-yellow-500 bg-yellow-50'
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(bid.id);
            }}
            className="mt-1 h-4 w-4 text-blue-600 rounded"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  isRespond ? 'bg-green-600 text-white'
                    : bid.recommendation === 'Submitted' ? 'bg-blue-600 text-white'
                    : 'bg-yellow-600 text-white'
                }`}
              >
                {bid.recommendation}
              </span>
              <span className="text-xs text-gray-500">{bid.emailDateReceived}</span>
            </div>
            <h3 className="font-semibold text-gray-900">{bid.emailSubject}</h3>
            <p className="text-sm text-gray-600 mt-1">{bid.emailSummary}</p>
          </div>
        </div>
        <button
          className="ml-4 text-gray-400 hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(v => !v);
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 ml-7" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs font-semibold text-gray-600">Email Summary:</label>
            <p className="text-sm text-gray-700 mt-1">{bid.emailSummary}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">AI Reasoning:</label>
            <p className="text-sm text-gray-700 mt-1">{bid.reasoning}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Relevance:</label>
              <p className="text-sm text-gray-700">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  bid.relevance === 'High' ? 'bg-green-100 text-green-800'
                    : bid.relevance === 'Medium' ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {bid.relevance || 'Unknown'}
                </span>
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Bid System:</label>
              <p className="text-sm text-gray-700">{bid.bidSystem || 'Unknown'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Due Date:</label>
              <p className="text-sm text-gray-700">{bid.dueDate}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">From:</label>
              <p className="text-sm text-gray-700 break-words">{bid.emailFrom}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Entity/Agency:</label>
              <p className="text-sm text-gray-700 break-words">{bid.entity || 'Unknown'}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Keywords Found:</label>
            <p className="text-sm text-gray-700 break-words">{bid.keywordsFound}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Categories:</label>
            <p className="text-sm text-gray-700 break-words">{bid.keywordsCategory}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Significant Snippet:</label>
            <p className="text-sm text-gray-700 italic break-words">"{bid.significantSnippet}"</p>
          </div>

          {bid.url && bid.url !== 'Not provided' && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Original Source:</label>
              <a
                href={bid.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all"
              >
                {bid.url} <ExternalLink size={14} className="flex-shrink-0" />
              </a>
            </div>
          )}

          <details className="border border-gray-200 rounded-lg">
            <summary className="cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-600">
              Full Email Body
            </summary>
            <div className="p-3 text-sm text-gray-700 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {bid.emailBody || 'No email body available'}
            </div>
          </details>

          <div className="flex flex-col gap-2 pt-2 mt-2 border-t border-gray-200">
            {!isRespond && (
              <button
                onClick={() => onStatusChange(bid.id, 'respond')}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium transition-colors"
              >
                Move to Respond
              </button>
            )}
            <button
              onClick={() => onStatusChange(bid.id, 'submitted')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition-colors"
            >
              Mark as Submitted
            </button>
            <button
              onClick={() => onStatusChange(bid.id, 'disregard')}
              className="px-3 py-1.5 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-medium transition-colors"
            >
              Disregard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BidCard;
