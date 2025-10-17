// src/components/BidOperations.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { Archive, RefreshCw } from 'lucide-react';
import BidCard from './BidCard';
import DisregardedArchiveModal from './DisregardedArchiveModal';
import BidDetailModal from './BidDetailModal';

const ITEMS_PER_PAGE = 10;

const withAuthHeaders = (init = {}, jsonBody = null) => {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined' && window.__APP_TOKEN) {
    headers.set('X-App-Token', window.__APP_TOKEN);
  }
  const body = jsonBody ? JSON.stringify(jsonBody) : init.body;
  return { ...init, headers, body };
};

const parseDate = (d) => {
  if (!d || d === 'Not specified') return 0;
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
};

const normalizeRecommendation = (s) => String(s || '').trim().toLowerCase();

const BidOperations = ({ bids = [], disregardedBids = [], submittedBids = [], loading, onRefresh, onNavigate }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBids, setSelectedBids] = useState([]);
  const [respondPage, setRespondPage] = useState(1);
  const [gatherInfoPage, setGatherInfoPage] = useState(1);
  const [submittedPage, setSubmittedPage] = useState(1);

  const [showDisregardedModal, setShowDisregardedModal] = useState(false);
  const [disregardedEmails, setDisregardedEmails] = useState([]);
  const [loadingDisregarded, setLoadingDisregarded] = useState(false);

  const [selectedBidForModal, setSelectedBidForModal] = useState(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
      setSelectedBids([]);
      setRespondPage(1);
      setGatherInfoPage(1);
      setSubmittedPage(1);
    }
  }, [onRefresh]);

  const handleSystemClick = useCallback((systemName) => {
    localStorage.setItem('filterBySystem', systemName);
    onNavigate?.('bid-systems');
  }, [onNavigate]);

  const handleStatusChange = useCallback(async (bidId, status) => {
    try {
      const response = await fetch(
        '/.netlify/functions/updateBidStatus',
        withAuthHeaders({ method: 'POST' }, { bidId, status })
      );
      if (!response.ok) throw new Error('Failed to update bid status');
      const result = await response.json();
      alert(`Success! ${result.message}`);
      await onRefresh?.();
    } catch (err) {
      console.error('Error updating bid status:', err);
      alert('Error: Failed to update bid status');
    }
  }, [onRefresh]);

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

    try {
      let dueDate = undefined;
      if (status === 'submitted') {
        // If any selected bid has no due date, ask once for a common due date
        const allBids = [...bids, ...submittedBids];
        const selected = allBids.filter(b => selectedBids.includes(b.id));
        const needsDue = selected.some(b => !b?.dueDate || String(b.dueDate).trim() === '' || String(b.dueDate).toLowerCase() === 'not specified');
        if (needsDue) {
          const input = prompt('Some selected bids are missing a Due Date. Enter a due date to apply to all (YYYY-MM-DD or Month DD, YYYY). Leave blank to skip.');
          if (input && input.trim() !== '') dueDate = input.trim();
        }
      }

      const res = await fetch('/.netlify/functions/updateBidStatus', withAuthHeaders({ method: 'POST' }, { bidIds: selectedBids, status, ...(dueDate ? { dueDate } : {}) }));
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Bulk action failed');
      }
      alert(`Bulk action complete! Updated ${data.ok || selectedBids.length}/${data.total || selectedBids.length}.`);
      setSelectedBids([]);
      await onRefresh?.();
    } catch (e) {
      console.error('Bulk action error:', e);
      alert('Error performing bulk action');
    }
  }, [selectedBids, onRefresh, bids, submittedBids]);

  const loadDisregardedEmails = useCallback(async () => {
    try {
      setLoadingDisregarded(true);
      const response = await fetch('/.netlify/functions/getDisregardedEmails', withAuthHeaders());
      const data = await response.json();
      if (data.success) {
        setDisregardedEmails(data.emails || []);
      } else {
        console.error('Failed to load disregarded emails:', data.error);
      }
    } catch (err) {
      console.error('Failed to load disregarded emails:', err);
    } finally {
      setLoadingDisregarded(false);
    }
  }, []);

  const respondBids = useMemo(() => (
    bids
      .filter((b) => normalizeRecommendation(b.recommendation) === 'respond')
      .sort((a, b) => parseDate(a.emailDateReceived) - parseDate(b.emailDateReceived))
  ), [bids]);

  const gatherInfoBids = useMemo(() => (
    bids
      .filter((b) => {
        const s = normalizeRecommendation(b.recommendation);
        return s === 'gather more information' || s === 'gather info' || s === 'need info' || s === 'needs info' || s === 'research';
      })
      .sort((a, b) => parseDate(a.emailDateReceived) - parseDate(b.emailDateReceived))
  ), [bids]);

  const paginatedRespondBids = respondBids.slice(0, respondPage * ITEMS_PER_PAGE);
  const paginatedGatherInfoBids = gatherInfoBids.slice(0, gatherInfoPage * ITEMS_PER_PAGE);
  const paginatedSubmittedBids = submittedBids.slice(0, submittedPage * ITEMS_PER_PAGE);

  const hasMoreRespond = paginatedRespondBids.length < respondBids.length;
  const hasMoreGatherInfo = paginatedGatherInfoBids.length < gatherInfoBids.length;
  const hasMoreSubmitted = paginatedSubmittedBids.length < submittedBids.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bids...</div>
      </div>
    );
  }

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
            onClick={() => { loadDisregardedEmails(); setShowDisregardedModal(true); }}
            disabled={loadingDisregarded}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors relative disabled:opacity-50"
          >
            <Archive size={18} />
            {loadingDisregarded ? 'Loading...' : 'View Archive'}
            {disregardedBids.length > 0 && !loadingDisregarded && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {disregardedBids.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {selectedBids.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-900">{selectedBids.length} bid{selectedBids.length > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button onClick={() => handleBulkAction('respond')} className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium">Move to Respond</button>
            <button onClick={() => handleBulkAction('submitted')} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium">Mark as Submitted</button>
            <button onClick={() => handleBulkAction('disregard')} className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs font-medium">Disregard</button>
            <button onClick={() => setSelectedBids([])} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs font-medium">Clear</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Respond */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Respond ({respondBids.length})</h2>
              <p className="text-sm text-gray-600 mt-1">High-priority bids requiring immediate action</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSelectAll(respondBids)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                {respondBids.length > 0 && respondBids.every((b) => selectedBids.includes(b.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-3 h-3 bg-green-500 rounded-full" />
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
                    isSelected={selectedBids.includes(bid.id)}
                    onToggleSelect={handleToggleSelect}
                    onSystemClick={handleSystemClick}
                    onCardClick={setSelectedBidForModal}
                  />
                ))}
                {hasMoreRespond && (
                  <button onClick={() => setRespondPage((p) => p + 1)} className="w-full mt-4 px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-medium transition-colors">
                    Load More ({paginatedRespondBids.length} of {respondBids.length} shown)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Gather More Info */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Gather More Information ({gatherInfoBids.length})</h2>
              <p className="text-sm text-gray-600 mt-1">Bids requiring additional research or information</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSelectAll(gatherInfoBids)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                {gatherInfoBids.length > 0 && gatherInfoBids.every((b) => selectedBids.includes(b.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
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
                    isSelected={selectedBids.includes(bid.id)}
                    onToggleSelect={handleToggleSelect}
                    onSystemClick={handleSystemClick}
                    onCardClick={setSelectedBidForModal}
                  />
                ))}
                {hasMoreGatherInfo && (
                  <button onClick={() => setGatherInfoPage((p) => p + 1)} className="w-full mt-4 px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm font-medium transition-colors">
                    Load More ({paginatedGatherInfoBids.length} of {gatherInfoBids.length} shown)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Submitted */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Submitted ({submittedBids.length})</h2>
              <p className="text-sm text-gray-600 mt-1">Bids that have been submitted for consideration</p>
            </div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
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
                    isSelected={selectedBids.includes(bid.id)}
                    onToggleSelect={handleToggleSelect}
                    onSystemClick={handleSystemClick}
                    onCardClick={setSelectedBidForModal}
                  />
                ))}
                {hasMoreSubmitted && (
                  <button onClick={() => setSubmittedPage((p) => p + 1)} className="w-full mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium transition-colors">
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

      {showDisregardedModal && (
        <DisregardedArchiveModal
          isOpen={showDisregardedModal}
          onClose={() => setShowDisregardedModal(false)}
          emails={disregardedEmails}
          onRevive={loadDisregardedEmails}
          onRefresh={loadDisregardedEmails}
        />
      )}

      <BidDetailModal
        bid={selectedBidForModal}
        isOpen={!!selectedBidForModal}
        onClose={() => setSelectedBidForModal(null)}
        onStatusChange={handleStatusChange}
        onSystemClick={handleSystemClick}
      />
    </div>
  );
};

export default BidOperations;