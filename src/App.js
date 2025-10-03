import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Menu, X, FileText, Video, Share2, LayoutDashboard, ChevronDown, ChevronRight, ExternalLink, Archive, RefreshCw, LogOut } from 'lucide-react';
import { fetchBids } from './services/bidService';
import { fetchTickerItems, generateTickerItemsFromBids, addTickerItem } from './services/tickerService';
import { useAuth } from './components/Auth';
import LoginPage from './components/LoginPage';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bids', label: 'Bid Operations', icon: FileText },
  { id: 'webinars', label: 'Webinar Operations', icon: Video },
  { id: 'social', label: 'Social Media', icon: Share2 }
];

// BidCard Component
const BidCard = ({ bid, onStatusChange, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const isRespond = bid.recommendation === "Respond";
  
  return (
    <div 
     className={`border-l-4 ${
  isRespond ? 'border-green-500 bg-green-50' : 
  bid.recommendation === 'Submitted' ? 'border-blue-500 bg-blue-50' : 
  'border-yellow-500 bg-yellow-50'
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="flex items-start justify-between" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
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
        <button className="ml-4 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 ml-7" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs font-semibold text-gray-600">AI Reasoning:</label>
            <p className="text-sm text-gray-700 mt-1">{bid.reasoning}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">From:</label>
              <p className="text-sm text-gray-700 break-words">{bid.emailFrom}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Due Date:</label>
              <p className="text-sm text-gray-700">{bid.dueDate}</p>
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

// Dashboard Component
const Dashboard = ({ bids, summary, loading, onNavigate }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bid data...</div>
      </div>
    );
  }

  const respondCount = summary?.respondCount || 0;
  const gatherInfoCount = summary?.gatherInfoCount || 0;
  const totalActive = summary?.totalActive || 0;
  
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
              <p className="text-3xl font-bold text-gray-900 mt-1">5</p>
            </div>
            <Video className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Next: Oct 5, 2025
          </div>
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
          <div className="mt-4 text-sm text-gray-600">
            This week: 4 posts
          </div>
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
            <p className="text-sm text-gray-600 mt-1">3 webinars with registration deadlines this week</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Bid Operations Component
const BidOperations = ({ bids, disregardedBids, submittedBids, loading, onRefresh }) => {
  const [showArchive, setShowArchive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBids, setSelectedBids] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [respondPage, setRespondPage] = useState(1);
  const [gatherInfoPage, setGatherInfoPage] = useState(1);
  const [submittedPage, setSubmittedPage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);
  
  const ITEMS_PER_PAGE = 10;
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    setSelectedBids([]);
    setRespondPage(1);
    setGatherInfoPage(1);
    setSubmittedPage(1);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bids...</div>
      </div>
    );
  }
  
  const handleStatusChange = async (bidId, status) => {
    try {
      const response = await fetch('/.netlify/functions/updateBidStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update bid status');
      }

      const result = await response.json();
      alert(`Success! ${result.message}`);
      await onRefresh();
    } catch (err) {
      console.error('Error updating bid status:', err);
      alert(`Error: Failed to update bid status`);
    }
  };
  
  const handleToggleSelect = (bidId) => {
    setSelectedBids(prev => 
      prev.includes(bidId) 
        ? prev.filter(id => id !== bidId)
        : [...prev, bidId]
    );
  };
  
  const handleSelectAll = (bidList) => {
    const bidIds = bidList.map(b => b.id);
    setSelectedBids(prev => {
      const allSelected = bidIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !bidIds.includes(id));
      } else {
        return [...new Set([...prev, ...bidIds])];
      }
    });
  };
  
  const handleBulkAction = async (status) => {
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
        
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
        console.error(`Error updating bid ${bidId}:`, err);
      }
    }
    
    setIsBulkProcessing(false);
    alert(`Bulk action complete!\nSuccess: ${successCount}\nErrors: ${errorCount}`);
    setSelectedBids([]);
    await onRefresh();
  };
  
  const respondBids = bids.filter(b => b.recommendation === "Respond");
  const gatherInfoBids = bids.filter(b => b.recommendation === "Gather More Information");
  
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
              setShowArchive(!showArchive);
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
                {paginatedArchiveBids.map(bid => (
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
                    onClick={() => setArchivePage(prev => prev + 1)}
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
                {respondBids.every(b => selectedBids.includes(b.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          <div className="space-y-3">
            {respondBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No high-priority bids at this time</p>
            ) : (
              <>
                {paginatedRespondBids.map(bid => (
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
                    onClick={() => setRespondPage(prev => prev + 1)}
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
                {gatherInfoBids.every(b => selectedBids.includes(b.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            </div>
          </div>
          <div className="space-y-3">
            {gatherInfoBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No bids need additional information</p>
            ) : (
              <>
                {paginatedGatherInfoBids.map(bid => (
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
                    onClick={() => setGatherInfoPage(prev => prev + 1)}
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
                {paginatedSubmittedBids.map(bid => (
  <BidCard 
    key={bid.id} 
    bid={{...bid, recommendation: 'Submitted'}}
    onStatusChange={handleStatusChange}
    isSelected={selectedBids.includes(bid.id)}
    onToggleSelect={handleToggleSelect}
  />
))}
                {hasMoreSubmitted && (
                  <button
                    onClick={() => setSubmittedPage(prev => prev + 1)}
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

// Placeholder Components
const WebinarOperations = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Webinar Operations</h1>
    <div className="bg-white p-12 rounded-lg shadow text-center">
      <Video className="mx-auto text-gray-300 mb-4" size={64} />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
      <p className="text-gray-600">Webinar scheduling, registration tracking, survey analysis, and marketing tools</p>
    </div>
  </div>
);

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

// Main App Component
const App = () => {
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

  useEffect(() => {
    const styleId = 'ticker-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-animate {
          animation: tickerScroll var(--ticker-duration, 40s) linear infinite;
          will-change: transform;
        }
        .ticker-animate:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .ticker-animate { animation: none; transform: none; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  
  const loadTickerFeed = useCallback(async () => {
    try {
      const items = await fetchTickerItems();
      setTickerItems(items);
      console.log('Loaded ticker items:', items);
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
      console.log('Auto-generated ticker items:', autoTickerItems);
      
      for (const item of autoTickerItems) {
        try {
          await addTickerItem(item);
          console.log('Added ticker item:', item.message);
        } catch (err) {
          console.error('Failed to add ticker item:', err);
        }
      }
      
      await loadTickerFeed();
    } catch (err) {
      setError(err.message);
      console.error('Failed to load bids:', err);
    } finally {
      setLoading(false);
    }
  }, [loadTickerFeed]);

  useEffect(() => {
    if (user) {
      loadBids();
      loadTickerFeed();
    }
  }, [user, loadBids, loadTickerFeed]);

  const displayItems = useMemo(() => {
    const normalized = (tickerItems || [])
      .map(i => ({
        ...i,
        message: (i?.message || '').trim(),
        priority: (i?.priority || 'low').toLowerCase()
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
    switch(currentPage) {
      case 'dashboard': 
        return <Dashboard bids={bids} summary={summary} loading={loading} onNavigate={setCurrentPage} />;
      case 'bids': 
        return <BidOperations 
          bids={bids} 
          disregardedBids={disregardedBids}
          submittedBids={submittedBids}
          loading={loading}
          onRefresh={loadBids}
        />;
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
      <div className={`bg-brand-blue text-white transition-all duration-300 relative ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-lg">49 North</h1>
              <p className="text-xs text-blue-200">Command Center</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-blue-800 rounded transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="p-4 space-y-2 pb-32">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded transition-colors ${
                  currentPage === item.id 
                    ? 'bg-blue-700 text-white' 
                    : 'text-blue-100 hover:bg-blue-800'
                }`}
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
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 pb-20">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              Error loading data: {error}
            </div>
          )}
          {renderPage()}
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 bg-[#003049] text-white py-3 text-sm overflow-hidden z-50 shadow-lg">
          <div className="flex items-center">
            <div className="bg-[#003049] px-4 font-semibold shrink-0 relative z-10">
              Latest Updates:
            </div>
            <div className="flex-1 overflow-hidden">
              <div
                ref={tickerRef}
                className="ticker-animate inline-flex whitespace-nowrap"
              >
                {displayItems.length > 0 ? (
                  <>
                    {displayItems.map((item, index) => (
                      <span key={`ticker-1-${index}`} className="inline-block px-8">
                        {item.message}
                      </span>
                    ))}
                    {displayItems.map((item, index) => (
                      <span key={`ticker-2-${index}`} className="inline-block px-8">
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