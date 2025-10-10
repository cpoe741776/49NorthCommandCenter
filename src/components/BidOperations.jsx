//BidOperations.jsx //

import React, { useState, useCallback, useMemo } from 'react';
import { Archive, RefreshCw } from 'lucide-react';
import BidCard from './BidCard';

const ITEMS_PER_PAGE = 10;

const BidOperations = ({ bids, disregardedBids, submittedBids, loading, onRefresh, onNavigate }) => {
  const [showArchive, setShowArchive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBids, setSelectedBids] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [respondPage, setRespondPage] = useState(1);
  const [gatherInfoPage, setGatherInfoPage] = useState(1);
  const [submittedPage, setSubmittedPage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    setSelectedBids([]);
    setRespondPage(1);
    setGatherInfoPage(1);
    setSubmittedPage(1);
  }, [onRefresh]);

  const handleSystemClick = useCallback((systemName) => {
    // Store the system name to filter by
    localStorage.setItem('filterBySystem', systemName);
    // Navigate to bid-systems page
    if (onNavigate) {
      onNavigate('bid-systems');
    }
  }, [onNavigate]);

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
            'This bid does not have a due date.\n\nWhen is the submission deadline?\n(Format: YYYY-MM-DD or December 31, 2025)'
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
        if (response.ok) successCount++; else errorCount++;
      } catch {
        errorCount++;
      }
    }

    setIsBulkProcessing(false);
    alert(`Bulk action complete!\nSuccess: ${successCount}\nErrors: ${errorCount}`);
    setSelectedBids([]);
    await onRefresh();
  }, [selectedBids, onRefresh]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bids...</div>
      </div>
    );
  }

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
                    onSystemClick={handleSystemClick}
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
                    onSystemClick={handleSystemClick}
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
                    onSystemClick={handleSystemClick}
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

export default BidOperations;