import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { LayoutDashboard, FileText, Video, Share2, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from './components/Auth';
import LoginPage from './components/LoginPage';
import { fetchBids } from './services/bidService';
import { fetchTickerItems, generateTickerItemsFromBids, generateSubmittedBidItems } from './services/tickerService';

import BidOperations from './components/BidOperations';
import WebinarOperations from './components/WebinarOperations';
import SocialMediaOperations from './components/SocialMediaOperations';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bids', label: 'Bid Operations', icon: FileText },
  { id: 'webinars', label: 'Webinar Operations', icon: Video },
  { id: 'social', label: 'Social Media', icon: Share2 }
];

const Dashboard = ({ summary, loading, onNavigate }) => {
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
        <div onClick={() => onNavigate('bids')} className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
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

        <div onClick={() => onNavigate('webinars')} className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Webinars</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">2</p>
            </div>
            <Video className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm text-gray-600">Next: Oct 30, 2025</div>
        </div>

        <div onClick={() => onNavigate('social')} className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
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
          <div onClick={() => onNavigate('bids')} className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors">
            <h3 className="font-semibold text-gray-900">Review High-Priority Bids</h3>
            <p className="text-sm text-gray-600 mt-1">{respondCount} bids marked as "Respond" awaiting review</p>
          </div>
          <div onClick={() => onNavigate('webinars')} className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors">
            <h3 className="font-semibold text-gray-900">Check Webinar Registrations</h3>
            <p className="text-sm text-gray-600 mt-1">Track attendance and survey responses</p>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  // ticker styles once
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

  const loadTickerFeed = useCallback(async () => {
    try {
      const items = await fetchTickerItems();
      setTickerItems(items);
    } catch {
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
      } catch {
        // non-fatal
      }

      await loadTickerFeed();
    } catch (err) {
      setError(err.message);
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
        priority: (i?.priority || 'low').toLowerCase(),
        target: i?.target || i?.route || null
      }))
      .filter(i => i.message.length > 0);

    const map = new Map();
    for (const i of normalized) if (!map.has(i.message)) map.set(i.message, i);
    const unique = Array.from(map.values());
    if (!unique.length) return unique;

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

  const navigateFromTicker = useCallback((item) => {
    const explicit = (item?.target || '').toLowerCase();
    if (['bids', 'webinars', 'social', 'dashboard'].includes(explicit)) {
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }
  if (!user) return <LoginPage onLogin={login} />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard summary={summary} loading={loading} onNavigate={setCurrentPage} />;
      case 'bids': return (
        <BidOperations
          bids={bids}
          disregardedBids={disregardedBids}
          submittedBids={submittedBids}
          loading={loading}
          onRefresh={loadBids}
        />
      );
      case 'webinars': return <WebinarOperations />;
      case 'social': return <SocialMediaOperations />;
      default: return <Dashboard summary={summary} loading={loading} onNavigate={setCurrentPage} />;
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
            <div className="bg-[#003049] px-4 font-semibold shrink-0 relative z-10">Latest Updates:</div>
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
