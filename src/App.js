import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Menu, X, FileText, Video, Share2, LayoutDashboard, ChevronDown, ChevronRight,
  ExternalLink, Archive, RefreshCw, LogOut, TrendingUp, Users, Calendar, MessageSquare
} from 'lucide-react';
import { fetchBids } from './services/bidService';
import { fetchTickerItems, generateTickerItemsFromBids, generateSubmittedBidItems } from './services/tickerService';
import { fetchWebinars } from './services/webinarService';
import { useAuth } from './components/Auth';
import LoginPage from './components/LoginPage';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bids', label: 'Bid Operations', icon: FileText },
  { id: 'webinars', label: 'Webinar Operations', icon: Video },
  { id: 'social', label: 'Social Media', icon: Share2 }
];

/* ----------------------- BidCard ----------------------- */
const BidCard = ({ bid, onStatusChange, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const isRespond = bid.recommendation === "Respond";

  return (
    <div
      className={`border-l-4 ${
        isRespond ? 'border-green-500 bg-green-50' :
        bid.recommendation === 'Submitted' ? 'border-blue-500 bg-blue-50' :
        'border-yellow-500 bg-yellow-50'
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
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                isRespond ? 'bg-green-600 text-white' :
                bid.recommendation === 'Submitted' ? 'bg-blue-600 text-white' :
                'bg-yellow-600 text-white'
              }`}>
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
                  bid.relevance === 'High' ? 'bg-green-100 text-green-800' :
                  bid.relevance === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
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

/* ----------------------- Dashboard ----------------------- */
const Dashboard = ({ bids, summary, loading, onNavigate }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bid data...</div>
      </div>
    );
  }

  const respondCount = summary?.respondCount ?? 0;
  const gatherInfoCount = summary?.gatherInfoCount ?? 0;
  const totalActive = summary?.totalActive ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
        <p className="text-gray-600 mt-1">49 North Business Operations Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => onNavigate('bids')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Bids</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalActive}</p>
            </div>
            <FileText className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm">
            <span className="text-green-600 font-semibold">{respondCount} Respond</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-yellow-600 font-semibold">{gatherInfoCount} Need Info</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('webinars')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Webinars</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">2</p>
            </div>
            <Video className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm text-gray-600">Next: Oct 30, 2025</div>
        </div>

        <div
          onClick={() => onNavigate('social')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Social Posts Scheduled</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">12</p>
            </div>
            <Share2 className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm text-gray-600">This week: 4 posts</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => onNavigate('bids')}
            className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Review High-Priority Bids</h3>
            <p className="text-sm text-gray-600 mt-1">{respondCount} bids marked as "Respond" awaiting review</p>
          </div>
          <div
            onClick={() => onNavigate('webinars')}
            className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Check Webinar Registrations</h3>
            <p className="text-sm text-gray-600 mt-1">Track attendance and survey responses</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ----------------------- Bid Operations ----------------------- */
const BidOperations = ({ bids, disregardedBids, submittedBids, loading, onRefresh }) => {
  // State
  const [showArchive, setShowArchive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBids, setSelectedBids] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [respondPage, setRespondPage] = useState(1);
  const [gatherInfoPage, setGatherInfoPage] = useState(1);
  const [submittedPage, setSubmittedPage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Callbacks (top-level)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    setSelectedBids([]);
    setRespondPage(1);
    setGatherInfoPage(1);
    setSubmittedPage(1);
  }, [onRefresh]);

  const handleStatusChange = useCallback(async (bidId, status) => {
    try {
      let dueDateToSend = null;

      if (status === 'submitted') {
        const allBids = [...bids, ...submittedBids];
        const bid = allBids.find((b) => b.id === bidId);

        if (!bid) {
          alert('Error: Could not find bid');
          return;
        }

        if (!bid.dueDate || bid.dueDate === 'Not specified' || bid.dueDate.trim() === '') {
          const dueDate = prompt(
            'This bid does not have a due date.\n\n' +
              'When is the submission deadline?\n' +
              '(Format: YYYY-MM-DD or December 31, 2025)'
          );

          if (!dueDate || dueDate.trim() === '') {
            alert('Due date is required to mark as submitted');
            return;
          }
          dueDateToSend = dueDate.trim();
        }
      }

      const response = await fetch('/.netlify/functions/updateBidStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, status, ...(dueDateToSend && { dueDate: dueDateToSend }) }),
      });

      if (!response.ok) throw new Error('Failed to update bid status');

      const result = await response.json();
      alert(`Success! ${result.message}`);
      await onRefresh();
    } catch (err) {
      console.error('Error updating bid status:', err);
      alert('Error: Failed to update bid status');
    }
  }, [bids, submittedBids, onRefresh]);

  const handleToggleSelect = useCallback((bidId) => {
    setSelectedBids((prev) => (prev.includes(bidId) ? prev.filter((id) => id !== bidId) : [...prev, bidId]));
  }, []);

  const handleSelectAll = useCallback((bidList) => {
    const bidIds = bidList.map((b) => b.id);
    setSelectedBids((prev) => {
      const allSelected = bidIds.every((id) => prev.includes(id));
      return allSelected ? prev.filter((id) => !bidIds.includes(id)) : [...new Set([...prev, ...bidIds])];
    });
  }, []);

  const handleBulkAction = useCallback(async (status) => {
    if (selectedBids.length === 0) {
      alert('Please select at least one bid');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to mark ${selectedBids.length} bid(s) as ${status}?`);
    if (!confirmed) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const bidId of selectedBids) {
      try {
        const response = await fetch('/.netlify/functions/updateBidStatus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidId, status }),
        });
        if (response.ok) successCount++;
        else errorCount++;
      } catch (err) {
        errorCount++;
      }
    }

    setIsBulkProcessing(false);
    alert(`Bulk action complete!\nSuccess: ${successCount}\nErrors: ${errorCount}`);
    setSelectedBids([]);
    await onRefresh();
  }, [selectedBids, onRefresh]);

  // Memos (top-level)
  const respondBids = useMemo(
    () =>
      bids
        .filter((b) => b.recommendation === 'Respond')
        .sort((a, b) => new Date(a.emailDateReceived) - new Date(b.emailDateReceived)),
    [bids]
  );

  const gatherInfoBids = useMemo(
    () =>
      bids
        .filter((b) => b.recommendation === 'Gather More Information')
        .sort((a, b) => new Date(a.emailDateReceived) - new Date(b.emailDateReceived)),
    [bids]
  );

  // Early return AFTER hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bids...</div>
      </div>
    );
  }

  // Pagination slices (pure)
  const paginatedRespondBids = respondBids.slice(0, respondPage * ITEMS_PER_PAGE);
  const paginatedGatherInfoBids = gatherInfoBids.slice(0, gatherInfoPage * ITEMS_PER_PAGE);
  const paginatedSubmittedBids = submittedBids.slice(0, submittedPage * ITEMS_PER_PAGE);
  const paginatedArchiveBids = disregardedBids.slice(0, archivePage * ITEMS_PER_PAGE);

  const hasMoreRespond = paginatedRespondBids.length < respondBids.length;
  const hasMoreGatherInfo = paginatedGatherInfoBids.length < gatherInfoBids.length;
  const hasMoreSubmitted = paginatedSubmittedBids.length < submittedBids.length;
  const hasMoreArchive = paginatedArchiveBids.length < disregardedBids.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bid Operations</h1>
          <p className="text-gray-600 mt-1">Active RFPs and Proposals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              setShowArchive(v => !v);
              setArchivePage(1);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            <Archive size={18} />
            {showArchive ? 'Hide Archive' : 'View Archive'}
          </button>
        </div>
      </div>

      {selectedBids.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-900">
            {selectedBids.length} bid{selectedBids.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('submitted')}
              disabled={isBulkProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Mark as Submitted
            </button>
            <button
              onClick={() => handleBulkAction('disregard')}
              disabled={isBulkProcessing}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Disregard Selected
            </button>
            <button
              onClick={() => setSelectedBids([])}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {showArchive && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Disregarded Bids ({disregardedBids.length})</h2>
          <div className="space-y-2">
            {disregardedBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No disregarded bids</p>
            ) : (
              <>
                {paginatedArchiveBids.map((bid) => (
                  <div key={bid.id} className="bg-white p-4 rounded border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{bid.emailSubject}</h3>
                        <p className="text-sm text-gray-600 mt-1">{bid.reasoning}</p>
                        <p className="text-xs text-gray-500 mt-2">From: {bid.emailFrom} • {bid.emailDateReceived}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMoreArchive && (
                  <button
                    onClick={() => setArchivePage(p => p + 1)}
                    className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium transition-colors"
                  >
                    Load More ({paginatedArchiveBids.length} of {disregardedBids.length} shown)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Respond ({respondBids.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(respondBids)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {respondBids.every((b) => selectedBids.includes(b.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          <div className="space-y-3">
            {respondBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No high-priority bids at this time</p>
            ) : (
              <>
                {paginatedRespondBids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    onStatusChange={handleStatusChange}
                    isSelected={selectedBids.includes(bid.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
                {hasMoreRespond && (
                  <button
                    onClick={() => setRespondPage(p => p + 1)}
                    className="w-full mt-4 px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-medium transition-colors"
                  >
                    Load More ({paginatedRespondBids.length} of {respondBids.length} shown)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Gather More Information ({gatherInfoBids.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(gatherInfoBids)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {gatherInfoBids.every((b) => selectedBids.includes(b.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            </div>
          </div>
          <div className="space-y-3">
            {gatherInfoBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No bids need additional information</p>
            ) : (
              <>
                {paginatedGatherInfoBids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    onStatusChange={handleStatusChange}
                    isSelected={selectedBids.includes(bid.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
                {hasMoreGatherInfo && (
                  <button
                    onClick={() => setGatherInfoPage(p => p + 1)}
                    className="w-full mt-4 px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm font-medium transition-colors"
                  >
                    Load More ({paginatedGatherInfoBids.length} of {gatherInfoBids.length} shown)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Submitted ({submittedBids.length})</h2>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </div>
          <div className="space-y-3">
            {submittedBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No submitted bids yet</p>
            ) : (
              <>
                {paginatedSubmittedBids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={{ ...bid, recommendation: 'Submitted' }}
                    onStatusChange={handleStatusChange}
                    isSelected={selectedBids.includes(bid.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
                {hasMoreSubmitted && (
                  <button
                    onClick={() => setSubmittedPage(p => p + 1)}
                    className="w-full mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium transition-colors"
                  >
                    Load More ({paginatedSubmittedBids.length} of {submittedBids.length} shown)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border-2 border-dashed border-gray-300">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Proposal Workspace</h2>
        <p className="text-gray-600">Document library, templates, and proposal writing tools coming soon...</p>
      </div>
    </div>
  );
};

/* ----------------------- Webinar Operations ----------------------- */
const WebinarOperations = () => {
  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWebinar, setSelectedWebinar] = useState(null);
  const [view, setView] = useState('overview');

  // Callbacks & Effects (top-level)
  const loadWebinarData = useCallback(async () => {
    try {
      setLoading(true);
      const webinarData = await fetchWebinars();
      setData(webinarData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebinarData();
  }, [loadWebinarData]);

  // Derived data (top-level memos)
  // Derived data (top-level memos)
// before:
// const webinars = data?.webinars ?? [];
// const surveys = data?.surveys ?? [];
// const summary = data?.summary ?? { ... };

const webinars = useMemo(() => data?.webinars ?? [], [data]);
const surveys  = useMemo(() => data?.surveys ?? [],  [data]);
const summary  = useMemo(() => ({
  totalWebinars: 0,
  completedCount: 0,
  upcomingCount: 0,
  totalAttendance: 0,
  avgAttendance: 0,
  totalSurveys: 0,
  surveyResponseRate: 0,
  totalRegistrations: 0,
  ...(data?.summary ?? {})
}), [data]);

const upcomingWebinars = useMemo(
  () => webinars.filter(w => w.status === 'Upcoming'),
  [webinars]
);

const completedWebinars = useMemo(
  () => webinars
    .filter(w => w.status === 'Completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date)),
  [webinars]
);


  // Early returns AFTER hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading webinar data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Webinar Operations</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading webinar data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webinar Operations</h1>
          <p className="text-gray-600 mt-1">Training Programs & Engagement</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadWebinarData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {['overview', 'upcoming', 'past', 'analytics'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 font-medium transition-colors ${
              view === v ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Webinars</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalWebinars}</p>
                </div>
                <Calendar className="text-blue-600" size={40} />
              </div>
              <div className="mt-4 text-sm">
                <span className="text-green-600 font-semibold">{summary.completedCount} Completed</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-blue-600 font-semibold">{summary.upcomingCount} Upcoming</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Attendance</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalAttendance}</p>
                </div>
                <Users className="text-blue-600" size={40} />
              </div>
              <div className="mt-4 text-sm text-gray-600">Avg: {summary.avgAttendance} per webinar</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Survey Responses</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalSurveys}</p>
                </div>
                <MessageSquare className="text-blue-600" size={40} />
              </div>
              <div className="mt-4 text-sm text-gray-600">{summary.surveyResponseRate}% response rate</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Registrations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalRegistrations}</p>
                </div>
                <TrendingUp className="text-blue-600" size={40} />
              </div>
              <div className="mt-4 text-sm text-gray-600">Across all series</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Webinars</h2>
            {upcomingWebinars.length === 0 ? (
              <p className="text-gray-500">No upcoming webinars scheduled</p>
            ) : (
              <div className="space-y-3">
                {upcomingWebinars.map(webinar => (
                  <div key={`${webinar.id}-${webinar.date}`} className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{webinar.title}</h3>
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                          <span>📅 {new Date(webinar.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          <span>🕐 {webinar.time}</span>
                          <span>👥 {webinar.registrationCount} registered</span>
                        </div>
                      </div>

                      <a
                        href={webinar.platformLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
                      >
                        Join
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Webinars</h2>
            <div className="space-y-3">
              {completedWebinars.slice(0, 5).map(webinar => (
                <div
                  key={`${webinar.id}-${webinar.date}`}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedWebinar(webinar)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{webinar.title}</h3>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>📅 {new Date(webinar.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>👥 {webinar.attendanceCount} attended</span>
                        <span>📊 {webinar.registrationCount} registered</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'upcoming' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Webinars ({upcomingWebinars.length})</h2>
          {upcomingWebinars.length === 0 ? (
            <p className="text-gray-500">No upcoming webinars scheduled</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingWebinars.map(webinar => (
                <div key={`${webinar.id}-${webinar.date}`} className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">{webinar.title}</h3>
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>{new Date(webinar.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🕐</span>
                      <span>{webinar.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      <span>{webinar.registrationCount} registered (capacity: {webinar.capacity})</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={webinar.platformLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors text-center"
                    >
                      Join Webinar
                    </a>

                    <a
                      href={webinar.registrationFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium transition-colors"
                    >
                      Register
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'past' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Past Webinars ({completedWebinars.length})</h2>
          <div className="space-y-3">
            {completedWebinars.map(webinar => {
              const webinarSurveys = surveys.filter(s => s.webinarId === webinar.id);
              const showRate = webinar.attendanceCount > 0
                ? Math.round((webinarSurveys.length / webinar.attendanceCount) * 100)
                : 0;

              return (
                <div
                  key={`${webinar.id}-${webinar.date}`}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedWebinar(webinar)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{webinar.title}</h3>
                      <div className="flex gap-6 mt-2 text-sm text-gray-600">
                        <span>📅 {new Date(webinar.date).toLocaleDateString()}</span>
                        <span>👥 {webinar.attendanceCount} attended</span>
                        <span>📊 {webinar.registrationCount} registered</span>
                        <span>💬 {webinarSurveys.length} surveys ({showRate}%)</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Attendance Rate</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summary.totalRegistrations > 0
                    ? Math.round((summary.totalAttendance / summary.totalRegistrations) * 100)
                    : 0}%
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {summary.totalAttendance} of {summary.totalRegistrations} registered
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Avg Attendance</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.avgAttendance}</p>
                <p className="text-sm text-gray-600 mt-1">participants per webinar</p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Survey Response</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.surveyResponseRate}%</p>
                <p className="text-sm text-gray-600 mt-1">{summary.totalSurveys} responses collected</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Webinars</h2>
            <div className="space-y-3">
              {completedWebinars
                .filter(w => w.attendanceCount > 0)
                .sort((a, b) => b.attendanceCount - a.attendanceCount)
                .slice(0, 10)
                .map((webinar, index) => (
                  <div key={`${webinar.id}-${webinar.date}`} className="flex items-center gap-4 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{webinar.title}</h3>
                      <p className="text-sm text-gray-600">{new Date(webinar.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{webinar.attendanceCount}</p>
                      <p className="text-sm text-gray-600">attendees</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {selectedWebinar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedWebinar.title}</h2>
                <p className="text-gray-600 mt-1">
                  {new Date(selectedWebinar.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })} • {selectedWebinar.time}
                </p>
              </div>
              <button
                onClick={() => setSelectedWebinar(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Registered</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedWebinar.registrationCount}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Attended</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedWebinar.attendanceCount}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedWebinar.registrationCount > 0
                      ? Math.round((selectedWebinar.attendanceCount / selectedWebinar.registrationCount) * 100)
                      : 0}% attendance rate
                  </p>
                </div>
              </div>

              {selectedWebinar.status === 'Completed' && (() => {
                const webinarSurveys = surveys.filter(s => s.webinarId === selectedWebinar.id);
                const responseRate = selectedWebinar.attendanceCount > 0
                  ? Math.round((webinarSurveys.length / selectedWebinar.attendanceCount) * 100)
                  : 0;

                const relevanceCounts = {};
                webinarSurveys.forEach(s => {
                  const rel = s.relevance || 'Not specified';
                  relevanceCounts[rel] = (relevanceCounts[rel] || 0) + 1;
                });

                const calculateAvg = (field) => {
                  const ratings = webinarSurveys
                    .map(s => {
                      const val = s[field];
                      const match = String(val).match(/(\d+)/);
                      return match ? parseInt(match[1], 10) : null;
                    })
                    .filter(r => r !== null && r >= 1 && r <= 5);
                  return ratings.length > 0
                    ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
                    : 'N/A';
                };

                const rhondaAvg = calculateAvg('rhonda');
                const chrisAvg = calculateAvg('chris');
                const guestAvg = calculateAvg('guest');

                return (
                  <>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Survey Analytics</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Survey Responses</p>
                          <p className="text-xl font-bold text-gray-900">{webinarSurveys.length}</p>
                          <p className="text-sm text-gray-600">{responseRate}% response rate</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Presenter Ratings (avg)</p>
                          <div className="text-sm mt-1 space-y-1">
                            <p><span className="font-semibold">Rhonda:</span> {rhondaAvg}/5</p>
                            <p><span className="font-semibold">Chris:</span> {chrisAvg}/5</p>
                            <p><span className="font-semibold">Guest:</span> {guestAvg}/5</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">Relevance to Organizations:</p>
                        <div className="space-y-1">
                          {Object.entries(relevanceCounts).map(([key, count]) => (
                            <div key={key} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{key}</span>
                              <span className="font-semibold text-gray-900">
                                {count} ({Math.round((count / webinarSurveys.length) * 100)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {webinarSurveys.some(s => s.comments && s.comments.trim()) && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Recent Comments</h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {webinarSurveys
                            .filter(s => s.comments && s.comments.trim())
                            .slice(0, 5)
                            .map((survey, idx) => (
                              <div key={idx} className="border-l-2 border-blue-200 pl-3 py-1">
                                <p className="text-sm text-gray-700 italic">"{survey.comments}"</p>
                                <p className="text-xs text-gray-500 mt-1">{survey.timestamp}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ----------------------- Social Placeholder ----------------------- */
const SocialMediaOperations = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Social Media Operations</h1>
    <div className="bg-white p-12 rounded-lg shadow text-center">
      <Share2 className="mx-auto text-gray-300 mb-4" size={64} />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
      <p className="text-gray-600">Content calendar, post composer, asset library, and performance analytics</p>
    </div>
  </div>
);

/* ----------------------- App ----------------------- */
const App = () => {
  // Auth & core state
  const { user, loading: authLoading, login, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [bids, setBids] = useState([]);
  const [disregardedBids, setDisregardedBids] = useState([]);
  const [submittedBids, setSubmittedBids] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickerItems, setTickerItems] = useState([]);

  const tickerRef = useRef(null);

  // Inject ticker styles once
  useEffect(() => {
    const styleId = 'ticker-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-animate { animation: tickerScroll var(--ticker-duration, 40s) linear infinite; will-change: transform; }
        .ticker-animate:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .ticker-animate { animation: none; transform: none; } }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Data loaders
  const loadTickerFeed = useCallback(async () => {
    try {
      const items = await fetchTickerItems();
      setTickerItems(items);
    } catch (err) {
      console.error('Failed to load ticker feed:', err);
      setTickerItems([
        { message: '🔔 Welcome to 49 North Command Center!', priority: 'high' },
        { message: '📊 Loading latest updates...', priority: 'medium' }
      ]);
    }
  }, []);

  const loadBids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBids();
      setBids(data.activeBids || []);
      setDisregardedBids(data.disregardedBids || []);
      setSubmittedBids(data.submittedBids || []);
      setSummary(data.summary || {});

      const autoTickerItems = generateTickerItemsFromBids(data.activeBids || []);
      const submittedTickerItems = generateSubmittedBidItems(data.submittedBids || []);

      try {
        await fetch('/.netlify/functions/refreshAutoTickerItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [...autoTickerItems, ...submittedTickerItems] })
        });
      } catch (err) {
        console.error('Failed to refresh ticker items:', err);
      }

      await loadTickerFeed();
    } catch (err) {
      setError(err.message);
      console.error('Failed to load bids:', err);
    } finally {
      setLoading(false);
    }
  }, [loadTickerFeed]);

  // Initial loads (top-level effect)
  useEffect(() => {
    if (user) {
      loadBids();
      loadTickerFeed();
    }
  }, [user, loadBids, loadTickerFeed]);

  // Ticker items normalization/deduping (memo)
  const displayItems = useMemo(() => {
    const normalized = (tickerItems || [])
      .map(i => ({
        ...i,
        message: (i?.message || '').trim(),
        priority: (i?.priority || 'low').toLowerCase(),
        target: i?.target || i?.route || null
      }))
      .filter(i => i.message.length > 0);

    const map = new Map();
    for (const i of normalized) {
      if (!map.has(i.message)) map.set(i.message, i);
    }
    const unique = Array.from(map.values());
    if (unique.length === 0) return unique;

    const hi = unique.filter(i => i.priority === 'high');
    const mid = unique.filter(i => i.priority === 'medium');
    const low = unique.filter(i => i.priority !== 'high' && i.priority !== 'medium');

    const out = [];
    const queues = [hi, mid, low];
    let added = true;
    while (added) {
      added = false;
      for (const q of queues) {
        if (q.length) {
          const next = q.shift();
          if (!out.length || out[out.length - 1].message !== next.message) {
            out.push(next);
            added = true;
          }
        }
      }
    }
    return out;
  }, [tickerItems]);

  // Auto duration for ticker animation (effect)
  useEffect(() => {
    if (!tickerRef.current) return;
    const SPEED_PX_PER_SEC = 120;
    const el = tickerRef.current;

    const id = requestAnimationFrame(() => {
      const width = el.scrollWidth || 0;
      if (!width) return;
      const distancePx = width * 0.5;
      const durationSec = Math.max(10, distancePx / SPEED_PX_PER_SEC);
      el.style.setProperty('--ticker-duration', `${durationSec}s`);
    });
    return () => cancelAnimationFrame(id);
  }, [displayItems]);

  // Ticker navigation (callbacks)
  const navigateFromTicker = useCallback((item) => {
    const explicit = (item?.target || '').toLowerCase();
    if (explicit === 'bids' || explicit === 'webinars' || explicit === 'social' || explicit === 'dashboard') {
      setCurrentPage(explicit);
      return;
    }
    const msg = (item?.message || '').toLowerCase();
    if (/webinar|zoom|event|session/.test(msg)) setCurrentPage('webinars');
    else if (/social|post|linkedin|facebook|\bx\b|twitter/.test(msg)) setCurrentPage('social');
    else if (/bid|rfp|tender|proposal|submission/.test(msg)) setCurrentPage('bids');
    else setCurrentPage('dashboard');
  }, []);

  const onTickerKeyDown = useCallback((e, item) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateFromTicker(item);
    }
  }, [navigateFromTicker]);

  // Early auth returns AFTER hooks are declared
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard bids={bids} summary={summary} loading={loading} onNavigate={setCurrentPage} />;
      case 'bids':
        return (
          <BidOperations
            bids={bids}
            disregardedBids={disregardedBids}
            submittedBids={submittedBids}
            loading={loading}
            onRefresh={loadBids}
          />
        );
      case 'webinars':
        return <WebinarOperations />;
      case 'social':
        return <SocialMediaOperations />;
      default:
        return <Dashboard bids={bids} summary={summary} loading={loading} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`bg-brand-blue text-white transition-all duration-300 relative ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-lg">49 North</h1>
              <p className="text-xs text-blue-200">Command Center</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-2 hover:bg-blue-800 rounded transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="p-4 space-y-2 pb-32">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded transition-colors ${
                  active ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-12 left-0 right-0 p-4 border-t border-blue-800 bg-brand-blue">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 p-3 rounded text-blue-100 hover:bg-blue-800 transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 pb-20">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              Error loading data: {error}
            </div>
          )}
          {renderPage()}
        </div>

        {/* Ticker */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#003049] text-white py-3 text-sm overflow-hidden z-50 shadow-lg">
          <div className="flex items-center">
            <div className="bg-[#003049] px-4 font-semibold shrink-0 relative z-10">
              Latest Updates:
            </div>
            <div className="flex-1 overflow-hidden">
              <div ref={tickerRef} className="ticker-animate inline-flex whitespace-nowrap">
                {displayItems.length > 0 ? (
                  <>
                    {displayItems.map((item, index) => (
                      <span
                        key={`ticker-1-${index}`}
                        className="inline-block px-8 underline-offset-2 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/60 rounded"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigateFromTicker(item)}
                        onKeyDown={(e) => onTickerKeyDown(e, item)}
                        title="Open related section"
                      >
                        {item.message}
                      </span>
                    ))}
                    {displayItems.map((item, index) => (
                      <span
                        key={`ticker-2-${index}`}
                        className="inline-block px-8 underline-offset-2 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/60 rounded"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigateFromTicker(item)}
                        onKeyDown={(e) => onTickerKeyDown(e, item)}
                        title="Open related section"
                      >
                        {item.message}
                      </span>
                    ))}
                  </>
                ) : (
                  <>
                    <span className="inline-block px-8">• Loading latest updates...</span>
                    <span className="inline-block px-8">• Loading latest updates...</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
