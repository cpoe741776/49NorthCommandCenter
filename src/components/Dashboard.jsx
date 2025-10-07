import React, { useState, useEffect } from 'react';
import { FileText, Video, Share2, TrendingUp, AlertTriangle, Sparkles, RefreshCw, ChevronRight, Mail, Target } from 'lucide-react';
import { fetchAIInsights } from '../services/aiInsightsService';

const Dashboard = ({ summary, loading, onNavigate }) => {
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Load cached insights on mount
  useEffect(() => {
    const cachedInsights = localStorage.getItem('aiInsights');
    if (cachedInsights) {
      try {
        const parsed = JSON.parse(cachedInsights);
        setAiInsights(parsed);
      } catch (err) {
        console.error('Error parsing cached insights:', err);
        localStorage.removeItem('aiInsights');
      }
    }
  }, []);

  const loadAIInsights = async () => {
    try {
      setAiLoading(true);
      setAiError(null);
      const data = await fetchAIInsights();
      setAiInsights(data);
      // Cache the insights
      localStorage.setItem('aiInsights', JSON.stringify(data));
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

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

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPotentialColor = (potential) => {
    switch (potential) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

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

       {/* AI Strategic Insights Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow-lg border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">AI Strategic Insights</h2>
          </div>
          <button
            onClick={loadAIInsights}
            disabled={aiLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw size={16} className={aiLoading ? 'animate-spin' : ''} />
            {aiLoading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>

        {/* Show "Click Refresh" message if no cached data */}
        {!aiLoading && !aiError && !aiInsights && (
          <div className="text-center py-12">
            <Sparkles className="text-blue-400 mx-auto mb-3" size={48} />
            <p className="text-gray-600 mb-2">No analysis loaded</p>
            <p className="text-sm text-gray-500">Click "Refresh Analysis" to generate strategic insights</p>
          </div>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={32} />
              <p className="text-gray-600">Analyzing operational data...</p>
              <p className="text-sm text-gray-500 mt-1">This may take 10-20 seconds</p>
            </div>
          </div>
        )}

        {aiError && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-700">Error loading insights: {aiError}</p>
            <button 
              onClick={loadAIInsights}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!aiLoading && !aiError && aiInsights?.insights && (
          <div className="space-y-6">
            {/* Executive Summary */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Executive Summary
              </h3>
              <p className="text-gray-700">{aiInsights.insights.executiveSummary}</p>
              <p className="text-xs text-gray-500 mt-2">
                Generated: {new Date(aiInsights.generatedAt).toLocaleString()}
              </p>
            </div>

            {/* Top Priorities */}
            {aiInsights.insights.topPriorities && aiInsights.insights.topPriorities.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target size={18} className="text-blue-600" />
                  Top Priorities
                </h3>
                <div className="space-y-3">
                  {aiInsights.insights.topPriorities.slice(0, 3).map((priority, idx) => (
                    <div key={idx} className={`border rounded-lg p-3 ${getUrgencyColor(priority.urgency)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{priority.title}</h4>
                          <p className="text-sm mt-1">{priority.description}</p>
                          <p className="text-sm mt-2 font-medium">→ {priority.action}</p>
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

           {/* Contact Leads */}
{aiInsights?.contactLeads && aiInsights.contactLeads.length > 0 && (
  <div className="bg-white rounded-lg p-4 border border-blue-200">
    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
      <Mail size={18} className="text-blue-600" />
      Hot Contact Leads ({aiInsights.contactLeads.length})
    </h3>
    <div className="space-y-2">
      {aiInsights.contactLeads.slice(0, 8).map((lead, idx) => (
        <div key={idx} className="border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{lead.name}</h4>
                {lead.contactRequest && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                    Requested Contact
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{lead.organization}</p>
              <p className="text-sm text-gray-600">{lead.email}</p>
              {lead.phone && <p className="text-sm text-gray-600">📞 {lead.phone}</p>}
              
              {lead.comments && (
                <p className="text-sm text-gray-700 italic mt-2 border-l-2 border-blue-200 pl-2">
                  "{lead.comments.substring(0, 150)}{lead.comments.length > 150 ? '...' : ''}"
                </p>
              )}
              
              <div className="flex flex-wrap gap-1 mt-2">
                {lead.factors.map((factor, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                    {factor}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-3 text-center">
              <span className="text-2xl font-bold text-blue-600">{lead.score}</span>
              <p className="text-xs text-gray-500">priority</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Content Insights */}
              {aiInsights.insights.contentInsights && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Content Strategy</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">Top Performing</p>
                      <p className="text-sm text-gray-700 mt-1">{aiInsights.insights.contentInsights.topPerforming}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold mt-3">Suggestions</p>
                      <p className="text-sm text-gray-700 mt-1">{aiInsights.insights.contentInsights.suggestions}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Alerts */}
              {aiInsights.insights.riskAlerts && aiInsights.insights.riskAlerts.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-600" />
                    Risk Alerts
                  </h3>
                  <div className="space-y-2">
                    {aiInsights.insights.riskAlerts.slice(0, 3).map((risk, idx) => (
                      <div key={idx} className="border-l-4 border-orange-400 pl-3 py-1">
                        <p className="text-sm font-semibold text-gray-900">{risk.issue}</p>
                        <p className="text-xs text-gray-600 mt-1">{risk.impact}</p>
                        <p className="text-xs text-orange-600 mt-1 font-medium">→ {risk.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Opportunity Mapping */}
            {aiInsights.insights.opportunityMapping && aiInsights.insights.opportunityMapping.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3">Opportunities</h3>
                <div className="space-y-2">
                  {aiInsights.insights.opportunityMapping.slice(0, 4).map((opp, idx) => (
                    <div key={idx} className="flex items-start justify-between border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors">
                      <div className="flex-1">
                        <span className="text-xs uppercase font-semibold text-gray-500">{opp.type}</span>
                        <p className="text-sm text-gray-700 mt-1">{opp.description}</p>
                        {opp.nextStep && (
                          <p className="text-sm text-blue-600 mt-1 font-medium">→ {opp.nextStep}</p>
                        )}
                      </div>
                      <span className={`text-xs uppercase font-bold ml-3 ${getPotentialColor(opp.potential)}`}>
                        {opp.potential}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bid Recommendations */}
            {aiInsights.insights.bidRecommendations && aiInsights.insights.bidRecommendations.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Priority Bids
                </h3>
                <div className="space-y-2">
                  {aiInsights.insights.bidRecommendations.slice(0, 3).map((bid, idx) => (
                    <div 
                      key={idx} 
                      className="border border-gray-200 rounded p-3 hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => onNavigate('bids')}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{bid.agency}</h4>
                          <p className="text-xs text-gray-500">{bid.solicitation}</p>
                          <p className="text-sm text-gray-600 mt-1">{bid.reason}</p>
                          <p className="text-sm text-blue-600 mt-2 font-medium">→ {bid.action}</p>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
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

export default Dashboard;