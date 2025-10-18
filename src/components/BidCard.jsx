// src/components/BidCard.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { ExternalLink, Database } from 'lucide-react';

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

const BidCard = ({ bid, isSelected, onToggleSelect, onSystemClick, onCardClick, isUpdating, pendingStatus }) => {
  const recommendation = coalesce(bid.recommendation);
  const score = coalesce(bid.scoreDetails);
  const emailSubject = coalesce(bid.emailSubject, bid.subject);
  const emailSummary = coalesce(bid.aiEmailSummary, bid.emailSummary, bid.aiSummary);
  const agency = coalesce(bid.entity);
  const dueDate = coalesce(bid.dueDate);
  const relevance = coalesce(bid.relevance);
  const bidSystem = coalesce(bid.bidSystem);
  const keywordsFound = coalesce(bid.keywordsFound);
  const keywordsCategory = coalesce(bid.keywordsCategory);
  const sourceUrl = coalesce(bid.url);
  const emailFrom = coalesce(bid.emailFrom, bid.from);

  const scoreClass = useMemo(() => scorePillClass(score), [score]);
  const recClass = useMemo(() => recPillClass(recommendation), [recommendation]);
  const relClass = useMemo(() => relevanceClass(relevance), [relevance]);
  const dueInDays = useMemo(() => daysUntil(dueDate), [dueDate]);

  return (
    <div
      className={`border-l-4 ${
        recommendation === 'Respond' ? 'border-green-500 bg-green-50' :
        recommendation === 'Submitted' ? 'border-blue-500 bg-blue-50' :
        'border-yellow-500 bg-yellow-50'
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isUpdating ? 'opacity-60' : ''} p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative`}
      onClick={() => onCardClick?.(bid)}
    >
      {/* Loading overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-white bg-opacity-50 rounded-lg flex items-center justify-center">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Updating...</span>
          </div>
        </div>
      )}
      
      {/* Pending status banner */}
      {pendingStatus && !isUpdating && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white text-xs font-semibold px-3 py-1 rounded-t-lg">
          ⏳ Pending: Will move to "{pendingStatus}" on next cache refresh
        </div>
      )}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={!!isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onToggleSelect?.(bid.id); }}
          className="mt-1 h-4 w-4 text-blue-600 rounded flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${recClass}`}>{recommendation || '—'}</span>
            {score && <span className={`px-2 py-1 rounded text-xs font-bold ${scoreClass}`}>Score: {score}</span>}
            {bidSystem && bidSystem !== 'Unknown' && (
              <button
                onClick={(e) => { e.stopPropagation(); onSystemClick?.(bidSystem); }}
                className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-200 transition-colors flex items-center gap-1"
                title="View this bid system"
              >
                <Database size={12} />
                {bidSystem}
              </button>
            )}
            {relevance && <span className={`px-2 py-0.5 rounded text-xs font-medium ${relClass}`}>{relevance} Relevance</span>}
          </div>

          <h3 className="font-semibold text-gray-900 mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {emailSubject || 'No subject'}
          </h3>

          <div className="space-y-2">
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
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

            <div className="flex items-center gap-3 text-xs pt-1">
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
              {emailFrom && <span className="text-gray-500 truncate">From: {emailFrom}</span>}
            </div>
          </div>
        </div>
      </div>
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
  isSelected: PropTypes.bool,
  onToggleSelect: PropTypes.func,
  onSystemClick: PropTypes.func,
  onCardClick: PropTypes.func,
  isUpdating: PropTypes.bool,
  pendingStatus: PropTypes.string,
};

BidCard.defaultProps = {
  isSelected: false,
  onToggleSelect: undefined,
  onSystemClick: undefined,
  onCardClick: undefined,
  isUpdating: false,
  pendingStatus: undefined,
};

export default BidCard;
