// src/components/BidCard.jsx
import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight, ExternalLink, Database } from 'lucide-react';

const withHttp = (url) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const BidCard = ({ bid, onStatusChange, isSelected, onToggleSelect, onSystemClick }) => {
  const [expanded, setExpanded] = useState(false);
  const isRespond = bid.recommendation === 'Respond';

  // parse score once
  const scoreNum = useMemo(() => {
    const n = parseFloat(bid?.scoreDetails);
    return Number.isNaN(n) ? null : n;
  }, [bid?.scoreDetails]);

  const scorePillClass = useMemo(() => {
    if (scoreNum === null) return 'bg-gray-100 text-gray-800';
    if (scoreNum >= 9) return 'bg-green-100 text-green-800';
    if (scoreNum >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  }, [scoreNum]);

  const recPillClass = isRespond
    ? 'bg-green-600 text-white'
    : bid.recommendation === 'Submitted'
      ? 'bg-blue-600 text-white'
      : 'bg-yellow-600 text-white';

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div
      className={`border-l-4 ${
        isRespond ? 'border-green-500 bg-green-50'
          : bid.recommendation === 'Submitted' ? 'border-blue-500 bg-blue-50'
          : 'border-yellow-500 bg-yellow-50'
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Header row */}
      <div
        className="flex items-start justify-between"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse bid details' : 'Expand bid details'}
      >
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect?.(bid.id);
            }}
            className="mt-1 h-4 w-4 text-blue-600 rounded"
            aria-label={isSelected ? 'Deselect bid' : 'Select bid'}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${recPillClass}`}>
                {bid.recommendation}
              </span>

              {bid.scoreDetails && (
                <span className={`px-2 py-1 rounded text-xs font-bold ${scorePillClass}`}>
                  Score: {bid.scoreDetails}
                </span>
              )}

              {bid.bidSystem && bid.bidSystem !== 'Unknown' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSystemClick?.(bid.bidSystem);
                  }}
                  className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-200 transition-colors flex items-center gap-1"
                  title="View this bid system"
                >
                  <Database size={12} />
                  {bid.bidSystem}
                </button>
              )}

              <span className="text-xs text-gray-500">{bid.emailDateReceived}</span>
            </div>

            <h3 className="font-semibold text-gray-900 mb-2">{bid.emailSubject}</h3>
            
            {/* Enhanced summary section - always visible */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600 leading-relaxed">
                {bid.aiSummary || bid.emailSummary || 'No summary available'}
              </p>
              
              {/* Key details row */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {bid.entity && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Agency:</span>
                    <span className="truncate max-w-32">{bid.entity}</span>
                  </span>
                )}
                
                {bid.dueDate && bid.dueDate !== 'Not specified' && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Due:</span>
                    <span>{bid.dueDate}</span>
                  </span>
                )}
                
                {bid.relevance && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    bid.relevance === 'High' ? 'bg-green-100 text-green-800'
                      : bid.relevance === 'Medium' ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {bid.relevance} Relevance
                  </span>
                )}
              </div>
              
              {/* AI Reasoning preview */}
              {bid.aiReasoning && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                  <span className="font-medium">AI Analysis:</span> {bid.aiReasoning.substring(0, 120)}
                  {bid.aiReasoning.length > 120 && '...'}
                </div>
              )}
              
              {/* Quick action links */}
              <div className="flex items-center gap-2 text-xs">
                {bid.url && bid.url !== 'Not provided' && (
                  <a
                    href={withHttp(bid.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink size={12} />
                    View Source
                  </a>
                )}
                
                {bid.emailFrom && (
                  <span className="text-gray-500">
                    From: {bid.emailFrom}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          className="ml-4 text-gray-400 hover:text-gray-600"
          onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 ml-7" onClick={(e) => e.stopPropagation()}>
          {/* Score Badge */}
          {bid.scoreDetails && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">Score:</label>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${scorePillClass}`}>
                {bid.scoreDetails}
              </span>
            </div>
          )}

          {/* AI Email Summary */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Email Summary:</label>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              {bid.aiSummary || bid.emailSummary || 'No summary available'}
            </p>
          </div>

          {/* AI Reasoning */}
          <div>
            <label className="text-xs font-semibold text-gray-600">AI Reasoning:</label>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              {bid.aiReasoning || bid.reasoning || 'No reasoning available'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Relevance:</label>
              <p className="text-sm text-gray-700">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    bid.relevance === 'High' ? 'bg-green-100 text-green-800'
                      : bid.relevance === 'Medium' ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {bid.relevance || 'Unknown'}
                </span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Bid System:</label>
              {bid.bidSystem && bid.bidSystem !== 'Unknown' ? (
                <button
                  onClick={() => onSystemClick?.(bid.bidSystem)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                >
                  <Database size={14} />
                  {bid.bidSystem}
                </button>
              ) : (
                <p className="text-sm text-gray-700">{bid.bidSystem || 'Unknown'}</p>
              )}
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

          {!!bid.url && bid.url !== 'Not provided' && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Original Source:</label>
              <a
                href={withHttp(bid.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all"
              >
                {withHttp(bid.url)} <ExternalLink size={14} className="flex-shrink-0" />
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

          <div className="flex flex-col gap-2 pt-2 mt-2 border-top border-gray-200">
            {!isRespond && (
              <button
                onClick={() => onStatusChange?.(bid.id, 'respond')}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium transition-colors"
              >
                Move to Respond
              </button>
            )}
            <button
              onClick={() => onStatusChange?.(bid.id, 'submitted')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition-colors"
            >
              Mark as Submitted
            </button>
            <button
              onClick={() => onStatusChange?.(bid.id, 'disregard')}
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

BidCard.propTypes = {
  bid: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    recommendation: PropTypes.string,
    scoreDetails: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    bidSystem: PropTypes.string,
    emailDateReceived: PropTypes.string,
    emailSubject: PropTypes.string,
    aiSummary: PropTypes.string,
    emailSummary: PropTypes.string,
    aiReasoning: PropTypes.string,
    reasoning: PropTypes.string,
    relevance: PropTypes.string,
    dueDate: PropTypes.string,
    emailFrom: PropTypes.string,
    entity: PropTypes.string,
    keywordsFound: PropTypes.string,
    keywordsCategory: PropTypes.string,
    significantSnippet: PropTypes.string,
    url: PropTypes.string,
    emailBody: PropTypes.string,
  }).isRequired,
  onStatusChange: PropTypes.func,
  isSelected: PropTypes.bool,
  onToggleSelect: PropTypes.func,
  onSystemClick: PropTypes.func,
};

BidCard.defaultProps = {
  onStatusChange: undefined,
  isSelected: false,
  onToggleSelect: undefined,
  onSystemClick: undefined,
};

export default BidCard;
