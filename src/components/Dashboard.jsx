// Dashboard.jsx
// FINAL VERSION: Corrects data paths, implements smart local caching, and maintains ESLint compliance.

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Video,
  Share2,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Mail,
  Target,
  Newspaper
} from 'lucide-react';
import { fetchAIInsights } from '../services/aiInsightsService';

const CACHE_KEY = 'aiInsightsCache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const Dashboard = ({ summary, loading, onNavigate, onTickerUpdate }) => {
  const [aiInsights, setAiInsights] = useState({
    bids: null,
    webinars: null,
    social: null,
    news: null
  });
  const [aiLoading, setAiLoading] = useState({
    bids: false,
    webinars: false,
    social: false,
    news: false
  });
  const [aiError, setAiError] = useState({
    bids: null,
    webinars: null,
    social: null,
    news: null
  });

  // Memoized loader with local TTL cache + service caching
  const loadAIInsights = useCallback(
    async (bypassCache = false) => {
      try {
        setAiLoading(true);
        setAiError(null);

        // Client-side TTL cache
        if (!bypassCache) {
          try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
              const entry = JSON.parse(cached);
              if (Date.now() - (entry.timestamp || 0) < CACHE_TTL_MS) {
                setAiInsights(entry.data);
                setAiLoading(false);
                return;
              }
              localStorage.removeItem(CACHE_KEY);
            }
          } catch (e) {
            console.warn('[Dashboard] Cache parse failed, clearing.', e);
            localStorage.removeItem(CACHE_KEY);
          }
        }

        // Fetch fresh (fast by default; your button triggers bypassCache=true)
        const data = await fetchAIInsights(bypassCache);

        // If server signals limited mode
        const analysisSkipped = data.note && data.note.includes('Full AI analysis unavailable');

        setAiInsights(data);
        setAiError(analysisSkipped ? data.note : null);

        // Save TTL cache
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data, timestamp: Date.now() })
          );
        } catch {
          /* ignore quota */
        }

        // Ticker enrichment
        if (data.executiveSummary || (data.topPriorities && data.topPriorities.length)) {
          const { generateAIInsightsTickerItems, pushAutoTickerItems } = await import('../services/tickerService');
          const aiTickerItems = generateAIInsightsTickerItems(data);
          if (aiTickerItems.length > 0) {
            // Prefer centralized helper; falls back to POST inside
            await pushAutoTickerItems(aiTickerItems, 'auto-ai');
            if (onTickerUpdate) await onTickerUpdate();
          }
        }
      } catch (err) {
        setAiError(err?.message || 'A network error occurred.');
        setAiInsights(null);
      } finally {
        setAiLoading(true);
      }
    },
    [onTickerUpdate]
  );

  // Initial load (no auto fetch; uses cached if present)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const entry = JSON.parse(cached);
        setAiInsights(entry.data);
        if (Date.now() - (entry.timestamp || 0) < CACHE_TTL_MS) {
          console.log('[Dashboard] Using fresh local cache for initial load.');
        } else {
          console.log('[Dashboard] Local cache expired. (Auto-load disabled)');
        }
      } else {
        console.log('[Dashboard] No cache found. (Auto-load disabled)');
      }
    } catch (e) {
      console.warn('[Dashboard] Initial cache check failed; clearing.', e);
      localStorage.removeItem(CACHE_KEY);
    }

    console.log('[Dashboard] AI Insights temporarily disabled for testing');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Refreshing Dashboard Data...</div>
      </div>
    );
  }

  const respondCount = summary?.respondCount ?? 0;
  const gatherInfoCount = summary?.gatherInfoCount ?? 0;
  const totalActive = summary?.activeBidsCount ?? summary?.totalActive ?? 0;

  const getUrgencyColor = (urgency) => {
    switch (String(urgency).toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
        <p className="text-gray-600 mt-1">49 North Business Operations Dashboard</p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Admin Alerts */}
        <div
          onClick={() => onNavigate('bid-systems')}
          className={`p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow ${
            summary?.newAdminEmailsCount > 0
              ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-400'
              : 'bg-white'
          }`}
          aria-label="Open System Admin"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Admin</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {summary?.adminEmailsCount || 0}
              </p>
            </div>
            <div className="relative">
              <Mail className="text-purple-600" size={40} />
              {summary?.newAdminEmailsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                  {summary.newAdminEmailsCount}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 text-sm">
            {summary?.newAdminEmailsCount > 0 ? (
              <span className="text-red-600 font-semibold">
                {summary.newAdminEmailsCount} New Alert
                {summary.newAdminEmailsCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-gray-600">No new alerts</span>
            )}
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-gray-600">Click to view</span>
          </div>
        </div>

        {/* Active Bids */}
        <div
          onClick={() => onNavigate('bids')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          aria-label="Open Bids"
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

        {/* Webinars (static placeholder; wire to webinarService when ready) */}
        <div
          onClick={() => onNavigate('webinars')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          aria-label="Open Webinars"
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

        {/* Social Posts */}
        <div
          onClick={() => onNavigate('social')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-colors"
          aria-label="Open Social"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Social Posts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {aiInsights?.summary?.socialPostsTotal ??
                  summary?.socialPostsTotal ??
                  0}
              </p>
            </div>
            <Share2 className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm">
            <span className="text-green-600 font-semibold">
              {(aiInsights?.summary?.socialPostsPublished ??
                summary?.socialPostsPublished ??
                0)}{' '}
              Published
            </span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-yellow-600 font-semibold">
              {(aiInsights?.summary?.socialPostsDrafts ??
                summary?.socialPostsDrafts ??
                0)}{' '}
              Drafts
            </span>
          </div>
        </div>
      </div>

      {/* AI Strategic Insights */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow-lg border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">AI Strategic Insights</h2>
          </div>
          <button
            onClick={() => loadAIInsights(true)}
            disabled={aiLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw size={16} className={aiLoading ? 'animate-spin' : ''} />
            {aiLoading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>

        {/* Empty */}
        {!aiLoading && !aiError && (!aiInsights || !aiInsights.executiveSummary) && (
          <div className="text-center py-12">
            <Sparkles className="text-blue-400 mx-auto mb-3" size={48} />
            <p className="text-gray-600 mb-2">No analysis loaded</p>
            <p className="text-sm text-gray-500">Click "Refresh Analysis" to generate strategic insights</p>
          </div>
        )}

        {/* Loading */}
        {aiLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={32} />
              <p className="text-gray-600 font-semibold">Performing comprehensive AI analysis...</p>
              <p className="text-sm text-gray-500 mt-1">
                This may take up to <strong>45 seconds</strong> for detailed insights
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Analyzing bids, leads, webinars, and market opportunities
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {aiError && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-700">Error loading insights: {aiError}</p>
            <button
              onClick={() => loadAIInsights(true)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        {!aiLoading && !aiError && aiInsights?.executiveSummary && (
          <div className="space-y-6">
            {/* Executive Summary */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Executive Summary
              </h3>
              <p className="text-gray-700">{aiInsights.executiveSummary}</p>
              <p className="text-xs text-gray-500 mt-2">
                Generated:{' '}
                {new Date(aiInsights.generatedAt || Date.now()).toLocaleString()}
              </p>
            </div>

            {/* Top Priorities */}
            {Array.isArray(aiInsights.topPriorities) && aiInsights.topPriorities.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target size={18} className="text-blue-600" />
                  Top Priorities
                </h3>
                <div className="space-y-3">
                  {aiInsights.topPriorities.map((priority, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 ${getUrgencyColor(priority.urgency)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{priority.title}</h4>
                          {/* description may not exist in normalized payload */}
                          {priority.description && (
                            <p className="text-sm mt-1">{priority.description}</p>
                          )}
                          {priority.action && (
                            <p className="text-sm mt-2 font-medium">→ {priority.action}</p>
                          )}
                        </div>
                        <span className="text-xs uppercase font-bold px-2 py-1 rounded">
                          {priority.urgency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Bids */}
            {Array.isArray(aiInsights.priorityBids) && aiInsights.priorityBids.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Priority Bids ({aiInsights.priorityBids.length} with "Respond" Status)
                </h3>
                <div className="space-y-2">
                  {aiInsights.priorityBids.slice(0, 5).map((bid, idx) => {
                    const days = Number.isFinite(Number(bid.daysUntilDue)) ? Number(bid.daysUntilDue) : null;
                    return (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors cursor-pointer"
                        onClick={() => onNavigate('bids')}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {bid.entity && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                  {bid.entity}
                                </span>
                              </div>
                            )}
                            <h4 className="font-semibold text-gray-900">
                              {bid.subject || 'Untitled Opportunity'}
                            </h4>
                            {/* Optional tags */}
                            <div className="flex flex-wrap gap-2 mt-2 text-xs">
                              {bid.dueDate && (
                                <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-medium">
                                  📅 Due: {bid.dueDate}
                                </span>
                              )}
                              {days !== null && days >= 0 && (
                                <span
                                  className={`px-2 py-1 rounded font-medium ${
                                    days <= 3
                                      ? 'bg-red-100 text-red-800'
                                      : days <= 7
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  ⏰ {days} days left
                                </span>
                              )}
                              {bid.bidSystem && (
                                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">
                                  🏢 {bid.bidSystem}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-gray-400 shrink-0 ml-2" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Social Media Activity */}
            {Array.isArray(aiInsights.socialPosts) && aiInsights.socialPosts.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Share2 size={18} className="text-blue-600" />
                  Recent Social Media Activity
                </h3>
                <div className="space-y-2">
                  {aiInsights.socialPosts
                    .filter((p) => String(p.status).toLowerCase() === 'published')
                    .map((post, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors cursor-pointer"
                        onClick={() => onNavigate('social')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{post.title || 'Post'}</h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{post.body || post.text}</p>
                            {post.platforms && (
                              <div className="flex gap-2 mt-2">
                                {post.platforms.split(',').map((p) => (
                                  <span key={p} className="text-xs bg-blue-50 px-2 py-1 rounded">
                                    {p.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {post.publishedDate && (
                              <p className="text-xs text-gray-500 mt-1">
                                Published: {new Date(post.publishedDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <ChevronRight size={20} className="text-gray-400 shrink-0 ml-2" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Content & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiInsights.contentInsights && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Content Strategy</h3>
                  <div className="space-y-2">
                    {aiInsights.contentInsights.topPerforming && (
                      <div>
                        <p className="text-xs text-gray-600 uppercase font-semibold">Top Performing</p>
                        <p className="text-sm text-gray-700 mt-1">
                          {aiInsights.contentInsights.topPerforming}
                        </p>
                      </div>
                    )}
                    {aiInsights.contentInsights.suggestions && (
                      <div>
                        <p className="text-xs text-gray-600 uppercase font-semibold mt-3">Suggestions</p>
                        <p className="text-sm text-gray-700 mt-1">
                          {aiInsights.contentInsights.suggestions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(aiInsights.riskAlerts) && aiInsights.riskAlerts.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-600" />
                    Risk Alerts
                  </h3>
                  <div className="space-y-2">
                    {aiInsights.riskAlerts.map((risk, idx) => (
                      <div key={idx} className="border-l-4 border-orange-400 pl-3 py-1">
                        <p className="text-sm font-semibold text-gray-900">{risk.issue}</p>
                        <p className="text-xs text-gray-600 mt-1">{risk.impact}</p>
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          → {risk.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* News Opportunities */}
            {Array.isArray(aiInsights.newsArticles) && aiInsights.newsArticles.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Newspaper size={18} className="text-blue-600" />
                  Market Opportunities from News (Last 60 Days)
                </h3>
                <div className="space-y-2">
                  {aiInsights.newsArticles.map((article, idx) => (
                    <div key={idx} className="border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <h4 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          {article.source && <span>{article.source}</span>}
                          {article.publishedAt && (
                            <>
                              <span>•</span>
                              <span>
                                Published:{' '}
                                {new Date(article.publishedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              <span>•</span>
                              <span className="text-blue-600">
                                {Math.floor(
                                  (Date.now() - Date.parse(article.publishedAt)) / (1000 * 60 * 60 * 24)
                                )}{' '}
                                days ago
                              </span>
                            </>
                          )}
                        </div>
                      </a>
                    </div>
                  ))}
                </div>

                {Array.isArray(aiInsights.newsOpportunities) && aiInsights.newsOpportunities.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">AI Analysis:</h4>
                    <div className="space-y-2">
                      {aiInsights.newsOpportunities.map((opp, idx) => (
                        <div key={idx} className="text-sm bg-green-50 p-2 rounded">
                          <p className="font-medium text-gray-900">{opp.headline}</p>
                          <p className="text-gray-600 text-xs mt-1">{opp.relevance}</p>
                          <p className="text-green-600 text-xs mt-1">→ {opp.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => onNavigate('bids')}
            className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Review High-Priority Bids</h3>
            <p className="text-sm text-gray-600 mt-1">
              {respondCount} bids marked as "Respond" awaiting review
            </p>
          </div>
          <div
            onClick={() => onNavigate('webinars')}
            className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Check Webinar Registrations</h3>
            <p className="text-sm text-gray-600 mt-1">Track attendance and survey responses</p>
          </div>
          <div
            onClick={() => onNavigate('bid-systems')}
            className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Bid Systems Registry</h3>
            <p className="text-sm text-gray-600 mt-1">
              Manage your 25 procurement system registrations
            </p>
          </div>
          <div
            onClick={() => onNavigate('company-data')}
            className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Company Data Vault</h3>
            <p className="text-sm text-gray-600 mt-1">
              Quick copy/paste access to all company information
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
