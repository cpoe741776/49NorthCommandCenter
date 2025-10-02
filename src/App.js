import React, { useState, useEffect, useCallback } from 'react';
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
const BidCard = ({ bid, onStatusChange }) => {
  const [expanded, setExpanded] = useState(false);
  const isRespond = bid.recommendation === "Respond";
  
  return (
    <div 
      className={`border-l-4 ${
        isRespond ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'
      } p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              isRespond ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
            }`}>
              {bid.recommendation}
            </span>
            <span className="text-xs text-gray-500">{bid.emailDateReceived}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{bid.emailSubject}</h3>
          <p className="text-sm text-gray-600 mt-1">{bid.emailSummary}</p>
        </div>
        <button className="ml-4 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs font-semibold text-gray-600">AI Reasoning:</label>
            <p className="text-sm text-gray-700 mt-1">{bid.reasoning}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">From:</label>
              <p className="text-sm text-gray-700">{bid.emailFrom}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Due Date:</label>
              <p className="text-sm text-gray-700">{bid.dueDate}</p>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Keywords Found:</label>
            <p className="text-sm text-gray-700">{bid.keywordsFound}</p>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Categories:</label>
            <p className="text-sm text-gray-700">{bid.keywordsCategory}</p>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Significant Snippet:</label>
            <p className="text-sm text-gray-700 italic">"{bid.significantSnippet}"</p>
          </div>
          
          {bid.url && bid.url !== 'Not provided' && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Original Source:</label>
              <a 
                href={bid.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {bid.url} <ExternalLink size={14} />
              </a>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => onStatusChange(bid.id, 'submitted')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              Mark as Submitted
            </button>
            <button 
              onClick={() => onStatusChange(bid.id, 'disregard')}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm font-medium transition-colors"
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
const BidOperations = ({ bids, disregardedBids, loading, onRefresh }) => {
  const [showArchive, setShowArchive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bids...</div>
      </div>
    );
  }
  
  const handleStatusChange = (bidId, status) => {
    alert(`Bid ${bidId} marked as ${status}. (Google Sheet update coming in future version)`);
  };
  
  const respondBids = bids.filter(b => b.recommendation === "Respond");
  const gatherInfoBids = bids.filter(b => b.recommendation === "Gather More Information");
  
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
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            <Archive size={18} />
            {showArchive ? 'Hide Archive' : 'View Archive'}
          </button>
        </div>
      </div>
      
      {showArchive && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Disregarded Bids ({disregardedBids.length})</h2>
          <div className="space-y-2">
            {disregardedBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No disregarded bids</p>
            ) : (
              disregardedBids.slice(0, 10).map(bid => (
                <div key={bid.id} className="bg-white p-4 rounded border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{bid.emailSubject}</h3>
                      <p className="text-sm text-gray-600 mt-1">{bid.reasoning}</p>
                      <p className="text-xs text-gray-500 mt-2">From: {bid.emailFrom} • {bid.emailDateReceived}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {disregardedBids.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">Showing 10 of {disregardedBids.length} disregarded bids</p>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Respond ({respondBids.length})</h2>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="space-y-3">
            {respondBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No high-priority bids at this time</p>
            ) : (
              respondBids.map(bid => (
                <BidCard key={bid.id} bid={bid} onStatusChange={handleStatusChange} />
              ))
            )}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Gather More Information ({gatherInfoBids.length})</h2>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </div>
          <div className="space-y-3">
            {gatherInfoBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No bids need additional information</p>
            ) : (
              gatherInfoBids.map(bid => (
                <BidCard key={bid.id} bid={bid} onStatusChange={handleStatusChange} />
              ))
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
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickerItems, setTickerItems] = useState([]);
  
  // Add CSS animation on mount
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
          animation: tickerScroll 40s linear infinite;
          will-change: transform;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  
  // Define loadTickerFeed first (no dependencies)
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
  
  // Define loadBids second (depends on loadTickerFeed)
  const loadBids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBids();
      setBids(data.activeBids || []);
      setDisregardedBids(data.disregardedBids || []);
      setSummary(data.summary || {});
      
      // Generate auto ticker items from bids
      const autoTickerItems = generateTickerItemsFromBids(data.activeBids || []);
      console.log('Auto-generated ticker items:', autoTickerItems);
      
      // Write them to the Google Sheet
      for (const item of autoTickerItems) {
        try {
          await addTickerItem(item);
          console.log('Added ticker item:', item.message);
        } catch (err) {
          console.error('Failed to add ticker item:', err);
        }
      }
      
      // Reload ticker feed to include new items
      await loadTickerFeed();
      
    } catch (err) {
      setError(err.message);
      console.error('Failed to load bids:', err);
    } finally {
      setLoading(false);
    }
  }, [loadTickerFeed]);

  // Fetch bids and ticker on mount
  useEffect(() => {
    if (user) {
      loadBids();
      loadTickerFeed();
    }
  }, [user, loadBids, loadTickerFeed]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
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

        {/* Logout Button - Fixed at bottom with padding for ticker */}
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
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 pb-20">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              Error loading data: {error}
            </div>
          )}
          {renderPage()}
        </div>
        
       {/* News Ticker */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#003049] text-white py-3 text-sm overflow-hidden z-50 shadow-lg">
          <div className="flex items-center">
            <div className="bg-[#003049] px-4 font-semibold shrink-0 relative z-10">
              Latest Updates:
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="ticker-animate inline-flex whitespace-nowrap">
                {tickerItems.length > 0 ? (
                  <>
                    {/* Render items twice for seamless loop */}
                    {tickerItems.map((item, index) => (
                      <span key={`ticker-1-${index}`} className="inline-block px-8">
                        {item.message}
                      </span>
                    ))}
                    {tickerItems.map((item, index) => (
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