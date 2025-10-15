// Dashboard.jsx
// FINAL VERSION: Corrects data paths, implements smart local caching, and maintains ESLint compliance.

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Video,
  Share2,
  RefreshCw,
  Mail,
  Newspaper
} from 'lucide-react';
import { 
  fetchBidsAnalysis, 
  fetchWebinarAnalysis, 
  fetchSocialAnalysis, 
  fetchNewsAnalysis 
} from '../services/separateAnalysisService';

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
  const [lastRefresh, setLastRefresh] = useState({
    bids: null,
    webinars: null,
    social: null,
    news: null
  });
  const [showAllNews, setShowAllNews] = useState(false);

  // Individual section loaders - only load cached data on mount, refresh on button click
  const loadBidsAnalysis = useCallback(async (bypassCache = false) => {
    try {
      setAiLoading(prev => ({ ...prev, bids: true }));
      setAiError(prev => ({ ...prev, bids: null }));
      const data = await fetchBidsAnalysis(bypassCache);
      setAiInsights(prev => ({ ...prev, bids: data }));
      setLastRefresh(prev => ({ ...prev, bids: new Date() }));
    } catch (err) {
      setAiError(prev => ({ ...prev, bids: err?.message || 'Failed to load bids analysis' }));
    } finally {
      setAiLoading(prev => ({ ...prev, bids: false }));
    }
  }, []);

  const loadWebinarAnalysis = useCallback(async (bypassCache = false) => {
    try {
      setAiLoading(prev => ({ ...prev, webinars: true }));
      setAiError(prev => ({ ...prev, webinars: null }));
      const data = await fetchWebinarAnalysis(bypassCache);
      setAiInsights(prev => ({ ...prev, webinars: data }));
      setLastRefresh(prev => ({ ...prev, webinars: new Date() }));
    } catch (err) {
      setAiError(prev => ({ ...prev, webinars: err?.message || 'Failed to load webinar analysis' }));
    } finally {
      setAiLoading(prev => ({ ...prev, webinars: false }));
    }
  }, []);

  const loadSocialAnalysis = useCallback(async (bypassCache = false) => {
    try {
      setAiLoading(prev => ({ ...prev, social: true }));
      setAiError(prev => ({ ...prev, social: null }));
      const data = await fetchSocialAnalysis(bypassCache);
      setAiInsights(prev => ({ ...prev, social: data }));
      setLastRefresh(prev => ({ ...prev, social: new Date() }));
    } catch (err) {
      setAiError(prev => ({ ...prev, social: err?.message || 'Failed to load social analysis' }));
    } finally {
      setAiLoading(prev => ({ ...prev, social: false }));
    }
  }, []);

  const loadNewsAnalysis = useCallback(async (bypassCache = false) => {
    try {
      setAiLoading(prev => ({ ...prev, news: true }));
      setAiError(prev => ({ ...prev, news: null }));
      const data = await fetchNewsAnalysis(bypassCache);
      setAiInsights(prev => ({ ...prev, news: data }));
      setLastRefresh(prev => ({ ...prev, news: new Date() }));
    } catch (err) {
      setAiError(prev => ({ ...prev, news: err?.message || 'Failed to load news analysis' }));
    } finally {
      setAiLoading(prev => ({ ...prev, news: false }));
    }
  }, []);

  // Initial load - only load cached data, no auto-refresh
  useEffect(() => {
    const loadCachedSections = async () => {
      try {
        await Promise.all([
          fetchBidsAnalysis(false).then(data => {
            setAiInsights(prev => ({ ...prev, bids: data }));
            setLastRefresh(prev => ({ ...prev, bids: new Date() }));
          }).catch(() => {}),
          fetchWebinarAnalysis(false).then(data => {
            setAiInsights(prev => ({ ...prev, webinars: data }));
            setLastRefresh(prev => ({ ...prev, webinars: new Date() }));
          }).catch(() => {}),
          fetchSocialAnalysis(false).then(data => {
            setAiInsights(prev => ({ ...prev, social: data }));
            setLastRefresh(prev => ({ ...prev, social: new Date() }));
          }).catch(() => {}),
          fetchNewsAnalysis(false).then(data => {
            setAiInsights(prev => ({ ...prev, news: data }));
            setLastRefresh(prev => ({ ...prev, news: new Date() }));
          }).catch(() => {})
        ]);
      } catch (e) {
        console.warn('[Dashboard] Initial cached load failed:', e);
      }
    };
    
    loadCachedSections();
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

      {/* AI Strategic Insights - Separate Sections */}
      <div className="space-y-6">
        {/* Bids Analysis Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow-lg border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="text-blue-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Bids Analysis</h2>
                {lastRefresh.bids && (
                  <p className="text-xs text-gray-500">
                    Last updated: {lastRefresh.bids.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => loadBidsAnalysis(true)}
              disabled={aiLoading.bids}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={16} className={aiLoading.bids ? 'animate-spin' : ''} />
              {aiLoading.bids ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>

          {aiLoading.bids && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={24} />
                <p className="text-gray-600">Analyzing bids data...</p>
            </div>
          </div>
        )}

          {aiError.bids && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700">Error loading bids analysis: {aiError.bids}</p>
            <button
                onClick={() => loadBidsAnalysis(true)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

          {!aiLoading.bids && !aiError.bids && aiInsights.bids && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                <p className="text-gray-700">{aiInsights.bids.executiveSummary}</p>
              </div>

              {Array.isArray(aiInsights.bids.topPriorities) && aiInsights.bids.topPriorities.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Top Priorities</h3>
                  <div className="space-y-2">
                    {aiInsights.bids.topPriorities.map((priority, idx) => (
                      <div key={idx} className={`border rounded-lg p-3 ${getUrgencyColor(priority.urgency)}`}>
                          <h4 className="font-semibold">{priority.title}</h4>
                        {priority.action && <p className="text-sm mt-1">→ {priority.action}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

              {Array.isArray(aiInsights.bids.priorityBids) && aiInsights.bids.priorityBids.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Top 5 Priority Bids</h3>
                  <div className="space-y-2">
                    {aiInsights.bids.priorityBids.slice(0, 5).map((bid, idx) => (
                      <div key={idx} className="border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => onNavigate('bids')}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{bid.subject || 'Untitled'}</h4>
                            <p className="text-sm text-gray-600">{bid.entity}</p>
                            <div className="flex gap-2 mt-2 text-xs">
                              {bid.dueDate && (
                                <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-medium">
                                  📅 Due: {bid.dueDate}
                                </span>
                              )}
                              {bid.daysUntilDue !== null && bid.daysUntilDue >= 0 && (
                                <span className={`px-2 py-1 rounded font-medium ${
                                  bid.daysUntilDue <= 3 ? 'bg-red-100 text-red-800' :
                                  bid.daysUntilDue <= 7 ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  ⏰ {bid.daysUntilDue} days left
                                </span>
                              )}
                              {bid.bidSystem && (
                                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">
                                  🏢 {bid.bidSystem}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Webinar Analysis Section */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg shadow-lg border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Video className="text-green-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Webinar Analysis</h2>
                {lastRefresh.webinars && (
                  <p className="text-xs text-gray-500">
                    Last updated: {lastRefresh.webinars.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => loadWebinarAnalysis(true)}
              disabled={aiLoading.webinars}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={16} className={aiLoading.webinars ? 'animate-spin' : ''} />
              {aiLoading.webinars ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>

          {aiLoading.webinars && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="animate-spin text-green-600 mx-auto mb-2" size={24} />
                <p className="text-gray-600">Analyzing webinar data...</p>
                </div>
              </div>
            )}

          {aiError.webinars && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700">Error loading webinar analysis: {aiError.webinars}</p>
              <button
                onClick={() => loadWebinarAnalysis(true)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
                              </div>
                            )}

          {!aiLoading.webinars && !aiError.webinars && aiInsights.webinars && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                <p className="text-gray-700">{aiInsights.webinars.executiveSummary}</p>
                          </div>

              {Array.isArray(aiInsights.webinars.hotLeads) && aiInsights.webinars.hotLeads.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Top 5 Hot Leads</h3>
                  <div className="space-y-3">
                    {aiInsights.webinars.hotLeads.slice(0, 5).map((lead, idx) => (
                      <div key={idx} className="border border-gray-200 rounded p-3 hover:border-green-400 transition-colors cursor-pointer" onClick={() => onNavigate('webinars')}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900">{lead.name}</h4>
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                Score: {lead.score}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{lead.organization}</p>
                            {lead.email && <p className="text-xs text-gray-500 mb-2">{lead.email}</p>}
                            {Array.isArray(lead.factors) && lead.factors.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs text-gray-600 font-semibold">Why they're hot:</p>
                                <div className="flex flex-wrap gap-1">
                                  {lead.factors.map((factor, factorIdx) => (
                                    <span key={factorIdx} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                                      {factor}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {lead.comments && (
                              <p className="text-xs text-gray-600 mt-2 italic">"{lead.comments}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Social Media Analysis Section */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg shadow-lg border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Share2 className="text-purple-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Social Media Analysis</h2>
                {lastRefresh.social && (
                  <p className="text-xs text-gray-500">
                    Last updated: {lastRefresh.social.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => loadSocialAnalysis(true)}
              disabled={aiLoading.social}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={16} className={aiLoading.social ? 'animate-spin' : ''} />
              {aiLoading.social ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>

          {aiLoading.social && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="animate-spin text-purple-600 mx-auto mb-2" size={24} />
                <p className="text-gray-600">Analyzing social media data...</p>
              </div>
            </div>
          )}

          {aiError.social && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700">Error loading social analysis: {aiError.social}</p>
              <button
                onClick={() => loadSocialAnalysis(true)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {!aiLoading.social && !aiError.social && aiInsights.social && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                <p className="text-gray-700">{aiInsights.social.executiveSummary}</p>
              </div>

              {aiInsights.social.contentInsights && (
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Content Strategy</h3>
                  <div className="space-y-2">
                    {aiInsights.social.contentInsights.topPerforming && (
                      <div>
                        <p className="text-xs text-gray-600 uppercase font-semibold">Top Performing</p>
                        <p className="text-sm text-gray-700 mt-1">{aiInsights.social.contentInsights.topPerforming}</p>
                      </div>
                    )}
                    {aiInsights.social.contentInsights.suggestions && (
                      <div>
                        <p className="text-xs text-gray-600 uppercase font-semibold mt-3">Suggestions</p>
                        <p className="text-sm text-gray-700 mt-1">{aiInsights.social.contentInsights.suggestions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* News Analysis Section */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-lg shadow-lg border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="text-orange-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">News Analysis</h2>
                {lastRefresh.news && (
                  <p className="text-xs text-gray-500">
                    Last updated: {lastRefresh.news.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => loadNewsAnalysis(true)}
              disabled={aiLoading.news}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={16} className={aiLoading.news ? 'animate-spin' : ''} />
              {aiLoading.news ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>

          {aiLoading.news && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="animate-spin text-orange-600 mx-auto mb-2" size={24} />
                <p className="text-gray-600">Analyzing news data...</p>
              </div>
            </div>
          )}

          {aiError.news && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700">Error loading news analysis: {aiError.news}</p>
              <button
                onClick={() => loadNewsAnalysis(true)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {!aiLoading.news && !aiError.news && aiInsights.news && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                <p className="text-gray-700">{aiInsights.news.executiveSummary}</p>
              </div>

              {Array.isArray(aiInsights.news.articles) && aiInsights.news.articles.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <h3 className="font-semibold text-gray-900 mb-3">US News (Last 90 Days)</h3>
                  <div className="space-y-3">
                    {aiInsights.news.articles.slice(0, showAllNews ? aiInsights.news.articles.length : 5).map((article, idx) => (
                      <div key={idx} className="border border-gray-200 rounded p-3 hover:border-orange-400 transition-colors">
                        <a href={article.link} target="_blank" rel="noopener noreferrer" className="block">
                          <h4 className="font-semibold text-gray-900 hover:text-orange-600 transition-colors mb-2">
                            {article.title}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">
                              {article.source}
                            </span>
                            {article.region && (
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                                {article.region}
                              </span>
                            )}
                            <span>{article.daysAgo} days ago</span>
                            {article.daysAgo <= 7 && (
                              <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-medium">
                                Recent
                              </span>
                            )}
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                  {aiInsights.news.articles.length > 5 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAllNews(!showAllNews)}
                        className="px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors text-sm font-medium"
                      >
                        {showAllNews ? 'Show Less' : `View All ${aiInsights.news.articles.length} Articles`}
                      </button>
                    </div>
                  )}
                </div>
              )}
              </div>
            )}
          </div>
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
