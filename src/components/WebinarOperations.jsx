//WebinarOperations.jsx//

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, ChevronRight, MessageSquare, RefreshCw, TrendingUp, Users, X, Download, Mail, Filter } from 'lucide-react';
import { fetchWebinars } from '../services/webinarService';

// Data quality cutoff - webinars after this date have accurate registration data
const DATA_QUALITY_CUTOFF = new Date('2025-10-01');

const WebinarOperations = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWebinar, setSelectedWebinar] = useState(null);
  const [selectedWebinarForRegistrants, setSelectedWebinarForRegistrants] = useState(null);
  const [view, setView] = useState('overview');
  const [showLegacyData, setShowLegacyData] = useState(false);
  const [surveyFilterWebinar, setSurveyFilterWebinar] = useState(null);
  const [surveyFilterContactOnly, setSurveyFilterContactOnly] = useState(false);

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

  const webinars = useMemo(() => data?.webinars ?? [], [data]);
  const allSurveys = useMemo(() => data?.surveys ?? [], [data]);
  const allRegistrations = useMemo(() => data?.registrations ?? [], [data]);

  // Filter webinars based on toggle
  const filteredWebinars = useMemo(() => {
    if (showLegacyData) return webinars;
    return webinars.filter(w => new Date(w.date) >= DATA_QUALITY_CUTOFF);
  }, [webinars, showLegacyData]);

  // Filter surveys based on toggle - use survey timestamp directly
  const surveys = useMemo(() => {
    if (showLegacyData) return allSurveys;
    
    return allSurveys.filter(s => {
      if (!s.timestamp) return false;
      const surveyDate = new Date(s.timestamp);
      return surveyDate >= DATA_QUALITY_CUTOFF;
    });
  }, [allSurveys, showLegacyData]);

  // Filtered surveys for the surveys view (with additional filters)
  const displayedSurveys = useMemo(() => {
    let filtered = surveys;
    
    if (surveyFilterWebinar) {
      filtered = filtered.filter(s => s.webinarId === surveyFilterWebinar);
    }
    
    if (surveyFilterContactOnly) {
      filtered = filtered.filter(s => 
        s.contactRequest && String(s.contactRequest).toLowerCase().includes('yes')
      );
    }
    
    return filtered;
  }, [surveys, surveyFilterWebinar, surveyFilterContactOnly]);

  const summary = useMemo(() => {
    const completed = filteredWebinars.filter(w => w.status === 'Completed');
    const upcoming = filteredWebinars.filter(w => w.status === 'Upcoming');
    
    return {
      totalWebinars: filteredWebinars.length,
      completedCount: completed.length,
      upcomingCount: upcoming.length,
      totalRegistrations: filteredWebinars.reduce((sum, w) => sum + w.registrationCount, 0),
      totalAttendance: completed.reduce((sum, w) => sum + w.attendanceCount, 0),
      avgAttendance: completed.length > 0
        ? Math.round(completed.reduce((sum, w) => sum + w.attendanceCount, 0) / completed.length)
        : 0,
      totalSurveys: surveys.length,
      surveyResponseRate: completed.reduce((sum, w) => sum + w.attendanceCount, 0) > 0
        ? Math.round((surveys.length / completed.reduce((sum, w) => sum + w.attendanceCount, 0)) * 100)
        : 0,
    };
  }, [filteredWebinars, surveys]);

  const upcomingWebinars = useMemo(
    () => filteredWebinars.filter(w => w.status === 'Upcoming'),
    [filteredWebinars]
  );

  const completedWebinars = useMemo(
    () => filteredWebinars.filter(w => w.status === 'Completed').sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredWebinars]
  );

  const surveyAnalytics = useMemo(() => {
    if (surveys.length === 0) return null;

    // Extract numeric ratings from emoji-based responses
    const extractRating = (value) => {
      const val = String(value).toLowerCase();
      
      // Map emoji responses to numeric ratings
      if (val.includes('🌟') || val.includes('awesome')) return 5;
      if (val.includes('🟢') || val.includes('strong')) return 4;
      if (val.includes('🟡') || val.includes('neutral')) return 3;
      if (val.includes('🟠') || val.includes('weak')) return 2;
      if (val.includes('🔴') || val.includes('poor')) return 1;
      if (val.includes('⚪') || val.includes('absent')) return null; // Don't count absent
      
      // Fallback: try to extract numeric value
      const match = val.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    const rhondaRatings = surveys.map(s => extractRating(s.rhonda)).filter(r => r !== null && r >= 1 && r <= 5);
    const chrisRatings = surveys.map(s => extractRating(s.chris)).filter(r => r !== null && r >= 1 && r <= 5);
    const guestRatings = surveys.map(s => extractRating(s.guest)).filter(r => r !== null && r >= 1 && r <= 5);

    const avgRating = (ratings) => ratings.length > 0 
      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(2)
      : 'N/A';

    // Relevance distribution
    const relevanceCounts = {};
    surveys.forEach(s => {
      const rel = s.relevance || 'Not specified';
      relevanceCounts[rel] = (relevanceCounts[rel] || 0) + 1;
    });

    // Sharing responses
    const sharingCounts = {};
    surveys.forEach(s => {
      const sharing = s.sharing || 'Not specified';
      sharingCounts[sharing] = (sharingCounts[sharing] || 0) + 1;
    });

    // Attending responses
    const attendingCounts = {};
    surveys.forEach(s => {
      const attending = s.attending || 'Not specified';
      attendingCounts[attending] = (attendingCounts[attending] || 0) + 1;
    });

    // Contact requests
    const contactRequests = surveys.filter(s => 
      s.contactRequest && String(s.contactRequest).toLowerCase().includes('yes')
    ).length;

    // Comments with content
    const commentsCount = surveys.filter(s => s.comments && s.comments.trim()).length;

    // Email domain analysis
    const domainCounts = {};
    surveys.forEach(s => {
      if (s.email) {
        const domain = s.email.split('@')[1]?.toLowerCase();
        if (domain) {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
      }
    });

    return {
      totalResponses: surveys.length,
      rhonda: {
        avg: avgRating(rhondaRatings),
        count: rhondaRatings.length,
        distribution: [1, 2, 3, 4, 5].map(rating => ({
          rating,
          count: rhondaRatings.filter(r => r === rating).length
        }))
      },
      chris: {
        avg: avgRating(chrisRatings),
        count: chrisRatings.length,
        distribution: [1, 2, 3, 4, 5].map(rating => ({
          rating,
          count: chrisRatings.filter(r => r === rating).length
        }))
      },
      guest: {
        avg: avgRating(guestRatings),
        count: guestRatings.length,
        distribution: [1, 2, 3, 4, 5].map(rating => ({
          rating,
          count: guestRatings.filter(r => r === rating).length
        }))
      },
      relevance: relevanceCounts,
      sharing: sharingCounts,
      attending: attendingCounts,
      contactRequests,
      commentsCount,
      domainCounts
    };
  }, [surveys]);

  // Export function for survey data
  const exportSurveyData = useCallback((surveysToExport, filename = 'survey_data') => {
    const headers = ['Timestamp', 'Email', 'Webinar', 'Relevance', 'Rhonda', 'Chris', 'Guest', 'Sharing', 'Attending', 'Contact Request', 'Comments'];
    
    const rows = surveysToExport.map(s => {
      const webinar = filteredWebinars.find(w => w.id === s.webinarId);
      return [
        s.timestamp,
        s.email,
        webinar ? `${webinar.title} - ${webinar.date}` : s.webinarId,
        s.relevance,
        s.rhonda,
        s.chris,
        s.guest,
        s.sharing,
        s.attending,
        s.contactRequest,
        s.comments?.replace(/\n/g, ' ') || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredWebinars]);

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
        {['overview', 'upcoming', 'past', 'registrants', 'surveys', 'analytics'].map(v => (
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

      {/* Data Filter Toggle - Show on overview, past, surveys, and analytics */}
      {(view === 'overview' || view === 'past' || view === 'surveys' || view === 'analytics') && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showLegacyData}
              onChange={(e) => setShowLegacyData(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">
                Include legacy data (before October 2025)
              </span>
              <p className="text-xs text-gray-600 mt-0.5">
                Registration data before October 2025 may be incomplete due to recurring series limitations
              </p>
            </div>
          </label>
        </div>
      )}

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
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{webinar.title}</h3>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>📅 {new Date(webinar.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <span>🕐 {webinar.time}</span>
                        <span>👥 {webinar.registrationCount} registered</span>
                      </div>
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
                  <div className="space-y-2 text-sm text-gray-600">
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

      {view === 'registrants' && (
        <div className="space-y-6">
          {/* Add toggle to registrants section */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showLegacyData}
                onChange={(e) => {
                  setShowLegacyData(e.target.checked);
                  setSelectedWebinarForRegistrants(null); // Reset selection when toggle changes
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">
                  Include legacy data (before October 2025)
                </span>
                <p className="text-xs text-gray-600 mt-0.5">
                  Registration data before October 2025 may be incomplete due to recurring series limitations
                </p>
              </div>
            </label>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Webinar Registrants</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {allRegistrations.length} total registrations across all webinars
                </p>
              </div>
              <select
                value={selectedWebinarForRegistrants || ''}
                onChange={(e) => {
                  const value = e.target.value || null;
                  setSelectedWebinarForRegistrants(value);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Webinars</option>
                {upcomingWebinars.length > 0 && (
                  <optgroup label="Upcoming">
                    {upcomingWebinars.map(w => (
                      <option key={`${w.id}|${w.date}`} value={`${w.id}|${w.date}`}>
                        {new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </optgroup>
                )}
                {completedWebinars.length > 0 && (
                  <optgroup label="Past">
                    {completedWebinars.map(w => (
                      <option key={`${w.id}|${w.date}`} value={`${w.id}|${w.date}`}>
                        {new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {(() => {
              // Parse the composite key to get webinarId and date
              let selectedWebinarId = null;
              let selectedWebinarDate = null;
              
              if (selectedWebinarForRegistrants) {
                const parts = selectedWebinarForRegistrants.split('|');
                selectedWebinarId = parts[0];
                selectedWebinarDate = parts[1];
              }

              // Filter registrations based on selected webinar ID and date
              const filteredRegistrations = selectedWebinarForRegistrants
                ? allRegistrations.filter(r => r.webinarId === selectedWebinarId)
                : allRegistrations;

              // Get the selected webinar info using both ID and date
              const selectedWebinarInfo = selectedWebinarForRegistrants
                ? filteredWebinars.find(w => w.id === selectedWebinarId && w.date === selectedWebinarDate)
                : null;

              return (
                <>
                  {selectedWebinarInfo && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-gray-900">{selectedWebinarInfo.title}</h3>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>📅 {new Date(selectedWebinarInfo.date).toLocaleDateString()}</span>
                        <span>🕐 {selectedWebinarInfo.time}</span>
                        <span>👥 {filteredRegistrations.length} registered</span>
                        <span className={`font-semibold ${selectedWebinarInfo.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>
                          {selectedWebinarInfo.status}
                        </span>
                      </div>
                    </div>
                  )}

                  {filteredRegistrations.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No registrations found{selectedWebinarForRegistrants ? ' for this webinar' : ''}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Registration Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Organization
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Phone
                            </th>
                            {!selectedWebinarForRegistrants && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Webinar
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredRegistrations
                            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                            .map((reg, index) => {
                              const webinar = filteredWebinars.find(w => w.id === reg.webinarId);
                              return (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                    {new Date(reg.timestamp).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {reg.name || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {reg.email || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {reg.organization || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {reg.phone || '-'}
                                  </td>
                                  {!selectedWebinarForRegistrants && (
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                      <div className="max-w-xs truncate">
                                        {webinar ? (
                                          <>
                                            <div className="font-medium text-gray-900">{webinar.title}</div>
                                            <div className="text-xs text-gray-500">
                                              {new Date(webinar.date).toLocaleDateString()}
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-gray-400">Unknown</span>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-gray-600">
                    Showing {filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? 's' : ''}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {view === 'surveys' && (
        surveys.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Survey Overview</h2>
            <p className="text-gray-500">
              {showLegacyData 
                ? "No survey data available" 
                : "No survey responses for webinars after October 2025. Enable 'Include legacy data' to view historical responses."}
            </p>
          </div>
        ) : surveyAnalytics && (
          <div className="space-y-6">
            {/* Survey Filters */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-4">
                <Filter size={20} className="text-gray-600" />
               <select
  value={surveyFilterWebinar || ''}
  onChange={(e) => setSurveyFilterWebinar(e.target.value || null)}
  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
>
  <option value="">All Webinars</option>
  {completedWebinars.map(w => (
    <option key={w.id} value={w.id}>
      {new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </option>
  ))}
</select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={surveyFilterContactOnly}
                    onChange={(e) => setSurveyFilterContactOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Contact Requests Only</span>
                </label>
                <button
                  onClick={() => exportSurveyData(displayedSurveys, 'filtered_surveys')}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Survey Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Responses</p>
                  <p className="text-3xl font-bold text-gray-900">{surveyAnalytics.totalResponses}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Response Rate</p>
                  <p className="text-3xl font-bold text-gray-900">{summary.surveyResponseRate}%</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Contact Requests</p>
                  <p className="text-3xl font-bold text-gray-900">{surveyAnalytics.contactRequests}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {surveyAnalytics.totalResponses > 0 
                      ? Math.round((surveyAnalytics.contactRequests / surveyAnalytics.totalResponses) * 100)
                      : 0}% of respondents
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">With Comments</p>
                  <p className="text-3xl font-bold text-gray-900">{surveyAnalytics.commentsCount}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {surveyAnalytics.totalResponses > 0 
                      ? Math.round((surveyAnalytics.commentsCount / surveyAnalytics.totalResponses) * 100)
                      : 0}% provided feedback
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Presenter Ratings</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['rhonda', 'chris', 'guest'].map(presenter => {
                  const presenterData = surveyAnalytics[presenter];
                  const presenterName = presenter.charAt(0).toUpperCase() + presenter.slice(1);
                  
                  return (
                    <div key={presenter} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">{presenterName}</h3>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-bold text-gray-900">{presenterData.avg}</span>
                        <span className="text-gray-600">/5.0</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{presenterData.count} ratings</p>
                      <div className="space-y-2">
                        {presenterData.distribution.reverse().map(({ rating, count }) => (
                          <div key={rating} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-8">{rating} ★</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ 
                                  width: `${presenterData.count > 0 ? (count / presenterData.count) * 100 : 0}%` 
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-8 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Relevance to Organizations</h2>
                <div className="space-y-3">
                  {Object.entries(surveyAnalytics.relevance)
                    .sort((a, b) => b[1] - a[1])
                    .map(([response, count]) => (
                      <div key={response} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{response}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${(count / surveyAnalytics.totalResponses) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                            {count} ({Math.round((count / surveyAnalytics.totalResponses) * 100)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Future Engagement</h2>
                
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Will Share with Others</h3>
                <div className="space-y-2 mb-6">
                  {Object.entries(surveyAnalytics.sharing)
                    .sort((a, b) => b[1] - a[1])
                    .map(([response, count]) => (
                      <div key={response} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{response}</span>
                        <span className="font-semibold text-gray-900">
                          {count} ({Math.round((count / surveyAnalytics.totalResponses) * 100)}%)
                        </span>
                      </div>
                    ))}
                </div>

                <h3 className="text-sm font-semibold text-gray-600 mb-3">Will Attend Future Sessions</h3>
                <div className="space-y-2">
                  {Object.entries(surveyAnalytics.attending)
                    .sort((a, b) => b[1] - a[1])
                    .map(([response, count]) => (
                      <div key={response} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{response}</span>
                        <span className="font-semibold text-gray-900">
                          {count} ({Math.round((count / surveyAnalytics.totalResponses) * 100)}%)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Email Domain Analysis */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Top Email Domains</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(surveyAnalytics.domainCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 9)
                  .map(([domain, count]) => (
                    <div key={domain} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{domain}</p>
                      <p className="text-2xl font-bold text-blue-600">{count}</p>
                      <p className="text-xs text-gray-600">
                        {Math.round((count / surveyAnalytics.totalResponses) * 100)}% of responses
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Contact Requests List */}
            {surveyAnalytics.contactRequests > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Mail className="text-blue-600" />
                    Contact Requests ({surveyAnalytics.contactRequests})
                  </h2>
                  <button
                    onClick={() => {
                      const contactSurveys = surveys.filter(s => 
                        s.contactRequest && String(s.contactRequest).toLowerCase().includes('yes')
                      );
                      exportSurveyData(contactSurveys, 'contact_requests');
                    }}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    Export
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Webinar</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {surveys
                        .filter(s => s.contactRequest && String(s.contactRequest).toLowerCase().includes('yes'))
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                        .map((survey, idx) => {
                          const webinar = filteredWebinars.find(w => w.id === survey.webinarId);
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {new Date(survey.timestamp).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {survey.email}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {webinar ? `${webinar.title.substring(0, 30)}...` : 'Unknown'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {survey.comments || '-'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Survey Responses Table */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  All Survey Responses ({displayedSurveys.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Webinar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rhonda</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chris</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayedSurveys
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .map((survey, idx) => {
                        const webinar = filteredWebinars.find(w => w.id === survey.webinarId);
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              {new Date(survey.timestamp).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {survey.email}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                              {webinar ? webinar.title : 'Unknown'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {survey.rhonda}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {survey.chris}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {survey.guest}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {survey.contactRequest && String(survey.contactRequest).toLowerCase().includes('yes') ? (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Yes</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Comments</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {displayedSurveys
                  .filter(s => s.comments && s.comments.trim())
                  .slice(0, 20)
                  .map((survey, idx) => {
                    const webinar = filteredWebinars.find(w => w.id === survey.webinarId);
                    return (
                      <div key={idx} className="border-l-4 border-blue-200 pl-4 py-2">
                        <p className="text-sm text-gray-700 italic">"{survey.comments}"</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>{survey.timestamp}</span>
                          <span>{survey.email}</span>
                          {webinar && <span>{webinar.title} - {new Date(webinar.date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )
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
                .map((webinar, index) => {
                  const webinarSurveys = surveys.filter(s => s.webinarId === webinar.id);
                  return (
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
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{webinarSurveys.length}</p>
                        <p className="text-sm text-gray-600">surveys</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {selectedWebinar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedWebinar.title}</h2>
                <p className="text-gray-600 mt-1">
                  {new Date(selectedWebinar.date).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
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

                const sharingCounts = {};
                webinarSurveys.forEach(s => {
                  const sharing = s.sharing || 'Not specified';
                  sharingCounts[sharing] = (sharingCounts[sharing] || 0) + 1;
                });

                const attendingCounts = {};
                webinarSurveys.forEach(s => {
                  const attending = s.attending || 'Not specified';
                  attendingCounts[attending] = (attendingCounts[attending] || 0) + 1;
                });

                const contactRequests = webinarSurveys.filter(s => 
                  s.contactRequest && String(s.contactRequest).toLowerCase().includes('yes')
                );

                // Use the same emoji-based rating extraction
                const extractRating = (value) => {
                  const val = String(value).toLowerCase();
                  
                  if (val.includes('🌟') || val.includes('awesome')) return 5;
                  if (val.includes('🟢') || val.includes('strong')) return 4;
                  if (val.includes('🟡') || val.includes('neutral')) return 3;
                  if (val.includes('🟠') || val.includes('weak')) return 2;
                  if (val.includes('🔴') || val.includes('poor')) return 1;
                  if (val.includes('⚪') || val.includes('absent')) return null;
                  
                  const match = val.match(/(\d+)/);
                  return match ? parseInt(match[1], 10) : null;
                };

                const calculateAvg = (field) => {
                  const ratings = webinarSurveys
                    .map(s => extractRating(s[field]))
                    .filter(r => r !== null && r >= 1 && r <= 5);
                  return ratings.length ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : 'N/A';
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

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-600 mb-2">Relevance:</p>
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

                        <div>
                          <p className="text-sm font-semibold text-gray-600 mb-2">Will Share:</p>
                          <div className="space-y-1">
                            {Object.entries(sharingCounts).map(([key, count]) => (
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

                      <div className="mt-4">
                        <p className="text-sm font-semibold text-gray-600 mb-2">Will Attend Future:</p>
                        <div className="space-y-1">
                          {Object.entries(attendingCounts).map(([key, count]) => (
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

                    {contactRequests.length > 0 && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Mail size={18} className="text-blue-600" />
                            Contact Requests ({contactRequests.length})
                          </h3>
                          <button
                            onClick={() => exportSurveyData(contactRequests, `contact_requests_${selectedWebinar.date}`)}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Download size={14} />
                            Export
                          </button>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {contactRequests.map((survey, idx) => (
                            <div key={idx} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                              <p className="font-medium text-gray-900">{survey.email}</p>
                              {survey.comments && (
                                <p className="text-gray-600 text-xs italic mt-1">"{survey.comments}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Individual Survey Responses Table */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Individual Responses</h3>
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rhonda</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chris</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Relevance</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {webinarSurveys.map((survey, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-900">{survey.email}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{survey.rhonda}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{survey.chris}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{survey.guest}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{survey.relevance}</td>
                                <td className="px-3 py-2 text-xs">
                                  {survey.contactRequest && String(survey.contactRequest).toLowerCase().includes('yes') ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Yes</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {webinarSurveys.some(s => s.comments && s.comments.trim()) && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Comments</h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {webinarSurveys
                            .filter(s => s.comments && s.comments.trim())
                            .map((survey, idx) => (
                              <div key={idx} className="border-l-2 border-blue-200 pl-3 py-1">
                                <p className="text-sm text-gray-700 italic">"{survey.comments}"</p>
                                <p className="text-xs text-gray-500 mt-1">{survey.email} • {survey.timestamp}</p>
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

export default WebinarOperations;