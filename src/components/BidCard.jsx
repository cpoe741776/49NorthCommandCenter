// src/components/BidCard.jsx - REDESIGN
import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight, ExternalLink, Database, Clock, Zap, CheckCircle, HelpCircle } from 'lucide-react';

// --- Utility Functions (Keep the existing ones) ---

const withHttp = (url) => { /* ... existing code ... */ };
const coalesce = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '') || '';
const parseDate = (d) => { /* ... existing code ... */ };

const daysUntil = (dateStr) => {
  const d = parseDate(dateStr);
  if (!d) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
    const d = parseDate(dateStr);
    if (!d) return 'Not specified';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
  return 'bg-yellow-600 text-white'; // Gather More Information
};

const relevanceClass = (rel) => {
  if (rel === 'High') return 'bg-green-100 text-green-800 border-green-300';
  if (rel === 'Medium') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-gray-100 text-gray-800 border-gray-300';
};

const BidCard = ({ bid, onStatusChange, isSelected, onToggleSelect, onSystemClick }) => {
  const [expanded, setExpanded] = useState(false);

  // Consolidated Data Extraction
  const recommendation = coalesce(bid.recommendation);
  const score = coalesce(bid.recommendationScoreDetails, bid.scoreDetails); // Use RecommendationScore if present
  const emailSubject = coalesce(bid.emailSubject, bid.subject);
  const emailSummary = coalesce(bid.aiEmailSummary, bid.emailSummary, bid.aiSummary);
  const aiReasoning = coalesce(bid.aiReasoning, bid.reasoning);
  const agency = coalesce(bid.entity, bid.agency);
  const dueDate = coalesce(bid.dueDate);
  const relevance = coalesce(bid.relevance);
  const bidSystem = coalesce(bid.bidSystem);
  const keywordsFound = coalesce(bid.keywordsFound);
  const keywordsCategory = coalesce(bid.keywordsCategory);
  const sourceUrl = coalesce(bid.url);
  const emailDateReceived = coalesce(bid.emailDateReceived);

  // Memoized Calculated Values
  const scoreClass = useMemo(() => scorePillClass(score), [score]);
  const recClass = useMemo(() => recPillClass(recommendation), [recommendation]);
  const relClass = useMemo(() => relevanceClass(relevance), [relevance]);
  const dueInDays = useMemo(() => daysUntil(dueDate), [dueDate]);

  // UI state for expansion
  const toggleExpand = useCallback((e) => {
      // Prevent toggling if the click was on the checkbox or an action button
      if (e && (e.target.closest('button, a, input[type="checkbox"]'))) return;
      setExpanded((v) => !v);
  }, []);

  // Card styling based on recommendation
  const cardBorderClass = useMemo(() => {
    const rec = String(recommendation).toLowerCase();
    if (rec === 'respond') return 'border-green-500';
    if (rec === 'submitted') return 'border-blue-500';
    return 'border-yellow-500'; // Gather More Information
  }, [recommendation]);
  
  const DueDatePill = ({ days }) => {
    if (days === null) return <span className="text-gray-500 text-xs">No Due Date</span>;
    const colorClass = days < 3 ? 'bg-red-500 text-white' : days < 7 ? 'bg-orange-400 text-white' : 'bg-green-500 text-white';
    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
        <Clock size={12} /> Due in {days} {days === 1 ? 'day' : 'days'}
      </div>
    );
  };

  const RecommendationIcon = () => {
    const rec = String(recommendation).toLowerCase();
    if (rec === 'respond') return <Zap size={16} className="text-green-600 flex-shrink-0" />;
    if (rec === 'submitted') return <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />;
    return <HelpCircle size={16} className="text-yellow-600 flex-shrink-0" />;
  };

  return (
    <div
      className={`border-l-4 ${cardBorderClass} bg-white transition-all duration-300 ease-in-out p-4 rounded-xl mb-4 shadow-lg hover:shadow-xl ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
    >
      {/* Header (Always Visible) */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(e); } }}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={!!isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onToggleSelect?.(bid.id); }}
            className="mt-1 h-5 w-5 text-blue-600 rounded cursor-pointer"
          />

          <RecommendationIcon />

          <div className="flex-1 min-w-0">
            {/* Main Subject */}
            <h3 className="font-bold text-lg text-gray-900 mb-1 leading-snug truncate">
              {emailSubject || 'No Subject Provided'}
            </h3>

            {/* Sub-Info Row: Summary and Agency */}
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <p className="truncate flex-1">
                <span className="font-semibold text-gray-700">Agency:</span> {agency || 'Unknown'}
              </p>
            </div>
            
            {/* Pills & Due Date */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${recClass}`}>
                {recommendation || '—'}
              </span>
              {score && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scoreClass}`}>
                Score: {score}
              </span>}
              {relevance && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${relClass}`}>
                  {relevance}
                </span>
              )}
              <DueDatePill days={dueInDays} />
              {bidSystem && bidSystem !== 'Unknown' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSystemClick?.(bidSystem); }}
                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold hover:bg-indigo-100 transition-colors"
                  title="View this bid system"
                >
                  <Database size={12} /> {bidSystem}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          className="ml-4 p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full"
          onClick={(e) => { e.stopPropagation(); toggleExpand(e); }}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
        </button>
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-6">
          
          {/* Section 1: AI Analysis */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h4 className="flex items-center gap-2 text-md font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2">
              <Zap size={18} /> AI Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-blue-700">Reasoning:</label>
                <p className="text-sm text-blue-900 mt-1 leading-relaxed">{aiReasoning || 'No reasoning available'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-blue-700">Summary:</label>
                <p className="text-sm text-blue-900 mt-1 leading-relaxed">{emailSummary || 'No summary available'}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Core Bid Details */}
          <div className="space-y-3">
             <h4 className="text-md font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">Core Bid Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <DetailItem label="Due Date" value={formatDate(dueDate) || 'N/A'} />
              <DetailItem label="Entity/Agency" value={agency || 'N/A'} />
              <DetailItem label="Country" value={bid.country || 'N/A'} />
              <DetailItem label="Keywords Category" value={keywordsCategory || 'None'} />
              <DetailItem label="Keywords Found" value={keywordsFound || 'None'} colSpan={2} />
              <DetailItem label="Status" value={bid.status || 'Unknown'} />
            </div>
          </div>
          
          {/* Section 3: Source & Metadata */}
          <div className="space-y-3">
             <h4 className="text-md font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">Source & Metadata</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <DetailItem label="From Email" value={bid.emailFrom || 'N/A'} />
              <DetailItem label="Email Received" value={formatDate(emailDateReceived) || 'N/A'} />
              <DetailItem label="Date Added" value={formatDate(bid.dateAdded) || 'N/A'} />
              <DetailItem label="Email Domain" value={bid.emailDomain || 'N/A'} />
              <DetailItem label="Source Email ID" value={bid.sourceEmailId || 'N/A'} colSpan={2} />
            </div>
          </div>


          {/* Significant Snippet */}
          {bid.significantSnippet && (
            <div className="pt-2">
              <label className="text-xs font-semibold text-gray-600">Significant Snippet:</label>
              <div className="text-sm text-gray-700 italic bg-gray-100 p-3 rounded mt-1 border-l-4 border-gray-400">"{bid.significantSnippet}"</div>
            </div>
          )}

          {/* Source Link */}
          {!!sourceUrl && sourceUrl !== 'Not provided' && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Original Source:</label>
              <a href={withHttp(sourceUrl)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2 break-all mt-1 hover:underline font-medium">
                <ExternalLink size={14} className="flex-shrink-0" /> {sourceUrl}
              </a>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 mt-4 border-t border-gray-200">
            {String(recommendation).toLowerCase() !== 'respond' && (
              <button onClick={() => onStatusChange?.(bid.id, 'Respond')} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition-colors min-w-fit">
                <Zap size={14} className="inline mr-1" /> Move to Respond
              </button>
            )}
            {String(recommendation).toLowerCase() !== 'submitted' && (
              <button onClick={() => onStatusChange?.(bid.id, 'Submitted')} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors min-w-fit">
                <CheckCircle size={14} className="inline mr-1" /> Mark as Submitted
              </button>
            )}
            <button onClick={() => onStatusChange?.(bid.id, 'Disregard')} className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-sm font-semibold transition-colors min-w-fit">
              Disregard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for cleaner detail list
const DetailItem = ({ label, value, colSpan = 1 }) => (
  <div className={`col-span-${colSpan}`}>
    <label className="text-xs font-semibold text-gray-600 block">{label}</label>
    <p className="text-gray-800 mt-0.5 break-words">{value}</p>
  </div>
);

// --- PropTypes (Keep the existing ones, ensure RecommendationScoreDetails is included) ---

BidCard.propTypes = {
  bid: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    recommendation: PropTypes.string,
    recommendationScoreDetails: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Added for Recommended bids
    scoreDetails: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Fallback
    // ... all other existing props ...
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
    agency: PropTypes.string, // Fallback for entity
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
    submissionDate: PropTypes.string, // For Submitted bids
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