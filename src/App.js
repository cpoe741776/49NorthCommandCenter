import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from 'react';
import { LayoutDashboard, FileText, Video, Share2, Menu, X, LogOut, Database, Building2 } from 'lucide-react';
import { useAuth } from './components/Auth';
import LoginPage from './components/LoginPage';

import { fetchDashboardData, fetchBids } from './services/bidService';
import { fetchTickerItems, generateTickerItemsFromBids, generateSubmittedBidItems, generateSystemAdminTickerItems } from './services/tickerService';
import RadioPlayer from './components/RadioPlayer';

// 🔻 Code-split feature modules (keeps initial bundle lean)
const Dashboard = lazy(() => import('./components/Dashboard'));
const BidOperations = lazy(() => import('./components/BidOperations'));
const WebinarOperations = lazy(() => import('./components/WebinarOperations'));
const SocialMediaOperations = lazy(() => import('./components/SocialMediaOperations'));
const BidSystemsManager = lazy(() => import('./components/BidSystemsManager'));
const CompanyDataVault = lazy(() => import('./components/CompanyDataVault'));

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bids', label: 'Bid Operations', icon: FileText },
  { id: 'webinars', label: 'Webinar Operations', icon: Video },
  { id: 'social', label: 'Social Media', icon: Share2 },
  { id: 'bid-systems', label: 'Bid Systems', icon: Database },
  { id: 'company-data', label: 'Company Data', icon: Building2 },
];

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

  // Inject ticker CSS once
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
      setTickerItems(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('❌ Ticker feed error:', error);
      setTickerItems([
        { message: '🔔 Welcome to 49 North Command Center!', priority: 'high' },
        { message: '📊 Loading latest updates...', priority: 'medium' }
      ]);
    }
  }, []);

  const loadAdminEmails = useCallback(async () => {
    try {
      const resp = await fetch('/.netlify/functions/getSystemAdminEmails', { method: 'GET' });
      if (!resp.ok) {
        console.warn('getSystemAdminEmails non-200:', resp.status);
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (data?.success) {
        const adminTickerItems = generateSystemAdminTickerItems(data.emails || []);
        if (Array.isArray(adminTickerItems) && adminTickerItems.length > 0) {
          const r = await fetch('/.netlify/functions/refreshAutoTickerItems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: adminTickerItems, source: 'admin' })
          });
          if (!r.ok) console.warn('refreshAutoTickerItems (admin) non-200:', r.status);
        }
      }
    } catch (err) {
      console.error('Failed to load admin emails:', err);
    }
  }, []);

  const loadBids = useCallback(async () => {
    const aborter = new AbortController();
    let mounted = true;
    setLoading(true);
    setError(null);

    try {
      // FAST summary for dashboard
      const dashboardData = await fetchDashboardData({ signal: aborter.signal }).catch(e => {
        console.warn('fetchDashboardData failed:', e);
        return {};
      });
      if (mounted) setSummary(dashboardData?.summary || {});

      // FULL bid arrays
      const fullBidsData = await fetchBids({ signal: aborter.signal });
      if (!fullBidsData?.success) throw new Error(fullBidsData?.error || 'Failed to fetch bids');

      if (mounted) {
        setBids(fullBidsData.activeBids || []);
        setDisregardedBids(fullBidsData.disregardedBids || []);
        setSubmittedBids(fullBidsData.submittedBids || []);
      }

      // Generate ticker from bids
      const autoTickerItems = generateTickerItemsFromBids(fullBidsData.activeBids || []);
      const submittedTickerItems = generateSubmittedBidItems(fullBidsData.submittedBids || []);
      try {
        const r = await fetch('/.netlify/functions/refreshAutoTickerItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [...autoTickerItems, ...submittedTickerItems], source: 'auto-bid' })
        });
        if (!r.ok) console.warn('refreshAutoTickerItems (bids) non-200:', r.status);
      } catch (tickerErr) {
        console.warn('Ticker update failed (non-fatal):', tickerErr);
      }

      await loadTickerFeed();
    } catch (err) {
      console.error('Error loading bids:', err);
      if (mounted) setError(err?.message || 'Unknown error');
    } finally {
      if (mounted) setLoading(false);
    }

    return () => {
      mounted = false;
      aborter.abort();
    };
  }, [loadTickerFeed]);

  const loadSocialPosts = useCallback(async () => {
    try {
      const mod = await import('./services/socialMediaService');
      const fetchSocialMediaContent = mod.fetchSocialMediaContent || mod.default;
      if (typeof fetchSocialMediaContent !== 'function') throw new Error('fetchSocialMediaContent is not a function');

      const data = await fetchSocialMediaContent();
      const posts = Array.isArray(data?.posts) ? data.posts : Array.isArray(data?.items) ? data.items : [];
      if (!posts.length) {
        console.info('No social posts available.');
        return await loadTickerFeed();
      }

      const tmod = await import('./services/tickerService');
      const generateSocialMediaTickerItems =
        tmod.generateSocialMediaTickerItems || tmod.default?.generateSocialMediaTickerItems;

      if (typeof generateSocialMediaTickerItems === 'function') {
        const socialTickerItems = generateSocialMediaTickerItems(posts);
        if (Array.isArray(socialTickerItems) && socialTickerItems.length > 0) {
          const r = await fetch('/.netlify/functions/refreshAutoTickerItems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: socialTickerItems, source: 'auto-social' })
          });
          if (!r.ok) console.warn('refreshAutoTickerItems (social) non-200:', r.status);
        }
      }

      await loadTickerFeed();
    } catch (err) {
      console.error('Failed to load social posts:', err);
    }
  }, [loadTickerFeed]);

  // Initial boot after auth
  useEffect(() => {
    if (!user) return;
    let cleanupFns = [];
    // Allow loaders to provide abort/cleanup
    const bidCleanup = loadBids();
    if (typeof bidCleanup === 'function') cleanupFns.push(bidCleanup);
    loadSocialPosts();
    loadTickerFeed();
    loadAdminEmails();
    return () => {
      cleanupFns.forEach(fn => { try { fn(); } catch {} });
    };
  }, [user, loadBids, loadSocialPosts, loadTickerFeed, loadAdminEmails]);

  // Build ordered ticker items by priority
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

  // Compute ticker duration from visible content width
  useEffect(() => {
    if (!tickerRef.current) return;
    const SPEED_PX_PER_SEC = 120;
    const el = tickerRef.current;
    const id = requestAnimationFrame(() => {
      const width = el.scrollWidth || 0;
      if (!width) return;
      // include padding (8rem per item approx). 0.55 gives a slightly slower, smoother loop.
      const distancePx = width * 0.55;
      const durationSec = Math.max(10, distancePx / SPEED_PX_PER_SEC);
      el.style.setProperty('--ticker-duration', `${durationSec}s`);
    });
    return () => cancelAnimationFrame(id);
  }, [displayItems]);

  const navigateFromTicker = useCallback((item) => {
    const explicit = (item?.target || '').toLowerCase();
    if (['bids', 'webinars', 'social', 'dashboard', 'bid-systems', 'company-data'].includes(explicit)) {
      setCurrentPage(explicit);
      return;
    }
    const msg = (item?.message || '').toLowerCase();
    if (/webinar|zoom|event|session/.test(msg)) setCurrentPage('webinars');
    else if (/social|post|linkedin|facebook|\bx\b|twitter/.test(msg)) setCurrentPage('social');
    else if (/bid|rfp|tender|proposal|submission/.test(msg)) setCurrentPage('bids');
    else if (/system|admin|notification|correspondence/.test(msg)) setCurrentPage('bid-systems');
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
      case 'dashboard':
        return (
          <Dashboard
            summary={summary}
            loading={loading}
            onNavigate={setCurrentPage}
            onTickerUpdate={loadTickerFeed}
          />
        );
      case 'bids':
        return (
          <BidOperations
            bids={bids}
            disregardedBids={disregardedBids}
            submittedBids={submittedBids}
            loading={loading}
            onRefresh={loadBids}
            onNavigate={setCurrentPage}
          />
        );
      case 'webinars':
        return <WebinarOperations />;
      case 'social':
        return <SocialMediaOperations />;
      case 'bid-systems':
        return <BidSystemsManager allBids={[...bids, ...submittedBids]} />;
      case 'company-data':
        return <CompanyDataVault />;
      default:
        return (
          <Dashboard
            summary={summary}
            loading={loading}
            onNavigate={setCurrentPage}
            onTickerUpdate={loadTickerFeed}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`bg-brand-blue text-white transition-all duration-300 relative flex flex-col h-screen pb-16 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen ? (
            <div className="flex-1 pr-2">
              <img
                src="/images/49NLogo.png"
                alt="49 North Logo"
                className="w-full h-auto max-w-[240px]"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <img
                src="/images/49NLogo.png"
                alt="49 North"
                className="w-8 h-8 object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-2 hover:bg-blue-800 rounded transition-colors shrink-0"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
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

        {/* Radio Player */}
        {sidebarOpen && <RadioPlayer />}

        {/* Sign Out */}
        <div className="p-4 border-t border-blue-800 mt-auto">
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center justify-between">
              <div>⚠️ Error loading data: {error}</div>
              <button
                onClick={() => { setError(null); loadBids(); loadSocialPosts(); loadTickerFeed(); }}
                className="ml-4 px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}
          <Suspense fallback={<div className="text-gray-600">Loading module…</div>}>
            {renderPage()}
          </Suspense>
        </div>

        {/* Ticker */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#003049] text-white py-3 text-sm overflow-hidden z-50 shadow-lg">
          <div className="flex items-center">
            <div className="bg-[#003049] px-4 font-semibold shrink-0 relative z-10">Latest Updates:</div>
            <div className="flex-1 overflow-hidden">
              <div
                ref={tickerRef}
                className="ticker-animate inline-flex whitespace-nowrap"
                aria-live="polite"
                aria-label="Latest updates ticker"
              >
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
