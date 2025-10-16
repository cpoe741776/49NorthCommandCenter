// src/components/BidCard.jsx
import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight, ExternalLink, Database } from 'lucide-react';

const withHttp = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const coalesce = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '') || '';

const parseDate = (d) => {
  if (!d || String(d).toLowerCase() === 'not specified') return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t);
};

const daysUntil = (dateStr) => {
  const d = parseDate(dateStr);
  if (!d) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

const scorePillClass = (score) => {
  const n = parseFloat(score);
  if (Number.isNaN(n)) return 'bg-gray-100 text-gray-800';
  if (n >= 9) return 'bg-green-100 text-green-800';
  if (n >= 6) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
};

const recPillClass = (rec) => {
  const r = String(rec || '').toLowerCase();
  if (r === 'respond') return 'bg-green-600 text-white';
  if (r === 'submitted') return 'bg-blue-600 text-white';
  return 'bg-yellow-600 text-white';
};

const relevanceClass = (rel) => {
  if (rel === 'High') return 'bg-green-100 text-green-800';
  if (rel === 'Medium') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
};

const BidCard = ({ bid, onStatusChange, isSelected, onToggleSelect, onSystemClick }) => {
  const [expanded, setExpanded] = useState(false);

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

  const scoreClass = useMemo(() => scorePillClass(score), [score]);
  const recClass = useMemo(() => recPillClass(recommendation), [recommendation]);
  const relClass = useMemo(() => relevanceClass(relevance), [relevance]);
  const dueInDays = useMemo(() => daysUntil(dueDate), [dueDate]);

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div className={`border-l-4 ${recommendation === 'Respond' ? 'border-green-500 bg-green-50' : recommendation === 'Submitted' ? 'border-blue-500 bg-blue-50' : 'border-yellow-500 bg-yellow-50'} ${isSelected ? 'ring-2 ring-blue-500' : ''} p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow`}> 
      {/* Header */}
      <div
        className="flex items-start justify-between"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={!!isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onToggleSelect?.(bid.id); }}
            className="mt-1 h-4 w-4 text-blue-600 rounded"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${recClass}`}>{recommendation || '—'}</span>
              {score && <span className={`px-2 py-1 rounded text-xs font-bold ${scoreClass}`}>Score: {score}</span>}
              {bidSystem && bidSystem !== 'Unknown' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSystemClick?.(bidSystem); }}
                  className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-200 transition-colors"
                  title="View this bid system"
                >
                  <Database size={12} />
                </button>
              )}
              {relevance && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${relClass}`}>{relevance} Relevance</span>
              )}
            </div>

            <h3 className="font-semibold text-gray-900 mb-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{emailSubject || 'No subject'}</h3>

            <div className="space-y-2">
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-medium text-gray-600">Summary:</span> {emailSummary || 'No summary available'}
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium text-gray-600">Agency:</span>
                  <div className="text-gray-800 truncate">{agency || 'Unknown'}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Due:</span>
                  <div className="text-gray-800">{dueDate || 'Not specified'}{dueInDays !== null ? ` (${dueInDays}d)` : ''}</div>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-600">Keywords:</span>
                  <div className="text-gray-800 truncate">{keywordsFound || 'None'}</div>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-600">Category:</span>
                  <div className="text-gray-800 truncate">{keywordsCategory || 'None'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {!!sourceUrl && sourceUrl !== 'Not provided' && (
                  <a
                    href={withHttp(sourceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink size={12} /> View Source
                  </a>
                )}
                {bid.emailFrom && <span className="text-gray-500 truncate">From: {bid.emailFrom}</span>}
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

      {/* Expanded body */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4 ml-7" onClick={(e) => e.stopPropagation()}>
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">AI Analysis</h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-blue-700">Reasoning:</label>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">{aiReasoning || 'No reasoning available'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-blue-700">Summary:</label>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">{emailSummary || 'No summary available'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Bid System:</label>
                {bidSystem && bidSystem !== 'Unknown' ? (
                  <button onClick={() => onSystemClick?.(bidSystem)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline mt-1">
                    <Database size={14} /> {bidSystem}
                  </button>
                ) : (
                  <p className="text-sm text-gray-700 mt-1">{bidSystem || 'Unknown'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Country:</label>
                <p className="text-sm text-gray-700 mt-1">{bid.country || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Email Domain:</label>
                <p className="text-sm text-gray-700 mt-1">{bid.emailDomain || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Date Added:</label>
                <p className="text-sm text-gray-700 mt-1">{bid.dateAdded || 'Unknown'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">From:</label>
                <p className="text-sm text-gray-700 mt-1 break-words">{bid.emailFrom || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Entity/Agency:</label>
                <p className="text-sm text-gray-700 mt-1 break-words">{agency || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Status:</label>
                <p className="text-sm text-gray-700 mt-1">{bid.status || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Source Email ID:</label>
                <p className="text-xs text-gray-700 mt-1 font-mono">{bid.sourceEmailId || 'Unknown'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Keywords Found:</label>
              <p className="text-sm text-gray-700 mt-1 break-words">{keywordsFound || 'None'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Keywords Category:</label>
              <p className="text-sm text-gray-700 mt-1 break-words">{keywordsCategory || 'None'}</p>
            </div>
          </div>

          {bid.significantSnippet && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Significant Snippet:</label>
              <div className="text-sm text-gray-700 italic bg-gray-50 p-2 rounded mt-1 border-l-4 border-gray-300">"{bid.significantSnippet}"</div>
            </div>
          )}

          {!!sourceUrl && sourceUrl !== 'Not provided' && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Original Source:</label>
              <a href={withHttp(sourceUrl)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all mt-1">
                {withHttp(sourceUrl)} <ExternalLink size={14} className="flex-shrink-0" />
              </a>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 mt-2 border-t border-gray-200">
            {String(recommendation).toLowerCase() !== 'respond' && (
              <button onClick={() => onStatusChange?.(bid.id, 'respond')} className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium transition-colors">Move to Respond</button>
            )}
            <button onClick={() => onStatusChange?.(bid.id, 'submitted')} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition-colors">Mark as Submitted</button>
            <button onClick={() => onStatusChange?.(bid.id, 'disregard')} className="px-3 py-1.5 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-medium transition-colors">Disregard</button>
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
    subject: PropTypes.string,
    aiSummary: PropTypes.string,
    emailSummary: PropTypes.string,
    aiEmailSummary: PropTypes.string,
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
    country: PropTypes.string,
    emailDomain: PropTypes.string,
    status: PropTypes.string,
    dateAdded: PropTypes.string,
    sourceEmailId: PropTypes.string,
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