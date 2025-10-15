// src/components/BidSystemsManager.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ExternalLink, Key, Globe, Search, CheckCircle, Clock, AlertCircle, Plus,
  Eye, EyeOff, FileText, MapPin, Mail, X
} from 'lucide-react';
import AddBidSystemForm from './AddBidSystemForm';
import BidSystemDetailModal from './BidSystemDetailModal';
import USStateMap from './USStateMap';
import SystemsCorrespondenceModal from './SystemsCorrespondenceModal';

/* ---------- helpers ---------- */
const withAuthHeaders = (init = {}, jsonBody = null) => {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined' && window.__APP_TOKEN) {
    headers.set('X-App-Token', window.__APP_TOKEN);
  }
  const body = jsonBody ? JSON.stringify(jsonBody) : init.body;
  return { ...init, headers, body };
};

const Toast = ({ type = 'success', message, onClose }) => {
  const color =
    type === 'error' ? 'bg-red-50 border-red-200 text-red-800'
      : type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800'
        : 'bg-green-50 border-green-200 text-green-800';
  return (
    <div className={`fixed bottom-4 right-4 z-[60] border rounded-lg px-4 py-3 shadow ${color}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5" aria-hidden>{type === 'error' ? '⚠️' : type === 'info' ? 'ℹ️' : '✅'}</div>
        <div className="text-sm">{message}</div>
        <button onClick={onClose} className="ml-2 text-xs opacity-70 hover:opacity-100" aria-label="Close toast">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- component ---------- */
const BidSystemsManager = ({ allBids = [] }) => {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // search/filter
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // debounced
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const [showPasswords, setShowPasswords] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  // Systems Administration state
  const [showSystemsCorrespondence, setShowSystemsCorrespondence] = useState(false);
  const [adminEmails, setAdminEmails] = useState([]);
  const [adminEmailCount, setAdminEmailCount] = useState(0);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // toast
  const [toast, setToast] = useState(null);
  const pushToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  /* ---------- search debounce ---------- */
  const debounceRef = useRef(null);
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setSearchTerm(searchInput.trim()), 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [searchInput]);

  /* ---------- initial load ---------- */
  const loadSystems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // quick session cache
      const cache = sessionStorage.getItem('bidSystemsCache');
      if (cache) {
        try {
          const entry = JSON.parse(cache);
          if (Date.now() - entry.ts < 60_000) {
            setSystems(entry.data || []);
          }
        } catch { /* ignore */ }
      }

      const response = await fetch('/.netlify/functions/getBidSystems', withAuthHeaders());
      const data = await response.json();

      if (data.success) {
        const validSystems = (data.systems || []).filter(
          s => s.systemName && s.systemName.trim() !== ''
        );
        setSystems(validSystems);
        sessionStorage.setItem('bidSystemsCache', JSON.stringify({ ts: Date.now(), data: validSystems }));
      } else {
        setError(data.error || 'Failed to load bid systems');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load bid systems');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminEmails = useCallback(async () => {
    try {
      setLoadingAdmin(true);
      const response = await fetch('/.netlify/functions/getSystemAdminEmails');
      const data = await response.json();
      if (data.success) {
        setAdminEmails(data.emails || []);
        setAdminEmailCount(data.newCount || 0);
      }
    } catch (err) {
      console.error('Failed to load admin emails:', err);
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  useEffect(() => {
    // restore saved filters
    try {
      const saved = JSON.parse(localStorage.getItem('bidSystemsFilters') || '{}');
      if (saved.searchTerm) { setSearchInput(saved.searchTerm); setSearchTerm(saved.searchTerm); }
      if (saved.filterCategory) setFilterCategory(saved.filterCategory);
      if (saved.filterStatus) setFilterStatus(saved.filterStatus);
    } catch { /* ignore */ }

    loadSystems();
    loadAdminEmails();

    // optional deep-link: filter by a system name
    const filterBySystem = localStorage.getItem('filterBySystem');
    if (filterBySystem) {
      setSearchInput(filterBySystem);
      localStorage.removeItem('filterBySystem');
    }
  }, [loadSystems, loadAdminEmails]);

  // persist filters
  useEffect(() => {
    try {
      localStorage.setItem('bidSystemsFilters', JSON.stringify({ searchTerm, filterCategory, filterStatus }));
    } catch { /* ignore */ }
  }, [searchTerm, filterCategory, filterStatus]);

  const debouncedLoadAdminEmails = useRef(null);
  useEffect(() => {
    debouncedLoadAdminEmails.current = (() => {
      let t;
      return () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => {
          loadAdminEmails();
        }, 300);
      };
    })();
  }, [loadAdminEmails]);

  const handleArchiveAdminEmail = async (email) => {
    try {
      const response = await fetch(
        '/.netlify/functions/updateSystemAdminStatus',
        withAuthHeaders({ method: 'POST' }, { sourceEmailId: email.sourceEmailId, status: 'Archived' })
      );
      const result = await response.json();
      if (result.success) {
        debouncedLoadAdminEmails.current?.();
      } else {
        throw new Error(result.error || 'Archive failed');
      }
    } catch (err) {
      console.error('Failed to archive email:', err);
      pushToast('error', 'Failed to archive');
      throw err;
    }
  };

  /* ---------- computed coverage ---------- */
  const coverageData = useMemo(() => {
    const states = new Set();
    const countries = new Set();
    const stateSystemsMap = {};
    const countrySystemsMap = {};

    const stateAbbreviations = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };

    systems.forEach(system => {
      const geo = (system.geographicCoverage || '').toLowerCase();
      const category = (system.category || '').toLowerCase();

      if (category === 'us state') {
        Object.entries(stateAbbreviations).forEach(([fullName, abbr]) => {
          if (geo.includes(fullName)) {
            states.add(abbr);
            if (!stateSystemsMap[abbr]) stateSystemsMap[abbr] = [];
            stateSystemsMap[abbr].push(system.systemName);
          }
        });
      }

      if (geo.includes('scotland') || geo.includes('england') || geo.includes('wales') ||
          geo.includes('united kingdom') || geo.includes('uk')) {
        countries.add('UK');
        (countrySystemsMap['UK'] ||= []).push(system.systemName);
      } else if (geo.includes('united states') || geo.includes('usa') || category === 'us state') {
        countries.add('USA');
        (countrySystemsMap['USA'] ||= []).push(system.systemName);
      } else if (geo.includes('canada')) {
        countries.add('Canada');
        (countrySystemsMap['Canada'] ||= []).push(system.systemName);
      } else if (geo.includes('australia')) {
        countries.add('Australia');
        (countrySystemsMap['Australia'] ||= []).push(system.systemName);
      } else if (geo.includes('international') || geo.includes('global')) {
        countries.add('International');
        (countrySystemsMap['International'] ||= []).push(system.systemName);
      }
    });

    return {
      states: Array.from(states),
      countries: Array.from(countries),
      stateSystemsMap,
      countrySystemsMap
    };
  }, [systems]);

  /* ---------- helpers ---------- */
  const togglePasswordVisibility = (uniqueKey) => {
    setShowPasswords(prev => ({ ...prev, [uniqueKey]: !prev[uniqueKey] }));
  };

  const handleAddNewSystem = () => setShowAddForm(true);
  const handleFormSuccess = () => {
    setShowAddForm(false);
    loadSystems();
    pushToast('success', 'System added');
  };

  const getBidCountForSystem = (systemName) =>
    (allBids || []).filter(bid =>
      bid.bidSystem && bid.bidSystem.toLowerCase() === String(systemName).toLowerCase()
    ).length;

  const filteredSystems = useMemo(() => {
    const q = (searchTerm || '').toLowerCase();

    return systems.filter((system) => {
      const name   = (system?.systemName || '').toLowerCase();
      const cat    = (system?.category   || '').toLowerCase();
      

      const matchesSearch   = !q || name.includes(q) || cat.includes(q);
      const matchesCategory = filterCategory === 'All' || (system?.category === filterCategory);
      const matchesStatus   = filterStatus === 'All'   || (system?.status   === filterStatus);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [systems, searchTerm, filterCategory, filterStatus]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active': return <CheckCircle className="text-green-600" size={20} />;
      case 'Pending Registration': return <Clock className="text-yellow-600" size={20} />;
      case 'Access Issues': return <AlertCircle className="text-red-600" size={20} />;
      default: return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending Registration': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Access Issues': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading bid systems...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button onClick={loadSystems} className="mt-2 text-red-600 hover:text-red-800">Try Again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bid Systems Registry</h1>
          <p className="text-gray-600 mt-1">Manage your {systems.length} registered procurement systems</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { loadAdminEmails(); setShowSystemsCorrespondence(true); }}
            disabled={loadingAdmin}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors relative disabled:opacity-50"
            aria-label={`View Systems Correspondence${(adminEmailCount || 0) > 0 ? `, ${adminEmailCount} new` : ''}`}
          >
            <Mail size={20} />
            {loadingAdmin ? 'Loading...' : 'View Systems Correspondence'}
            {(adminEmailCount || 0) > 0 && !loadingAdmin && (
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
              >
                {adminEmailCount}
              </span>
            )}
          </button>

          <button
            onClick={handleAddNewSystem}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add New System
          </button>
        </div>
      </div>

      {/* Maps Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* US State Map */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">US State Coverage</h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 relative">
            <USStateMap
              registeredStates={coverageData.states}
              stateSystemsMap={coverageData.stateSystemsMap}
              onStateHover={setHoveredState}
              hoveredState={hoveredState}
              allSystems={systems}
            />

            {hoveredState && coverageData.stateSystemsMap[hoveredState] && (
              <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 max-w-xs z-10">
                <p className="font-semibold text-gray-900 mb-1">{hoveredState}</p>
                <p className="text-xs text-gray-600">{coverageData.stateSystemsMap[hoveredState].join(', ')}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-400 rounded" />
                <span className="text-gray-600">Registered ({coverageData.states.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <span className="text-gray-600">Not Registered ({50 - coverageData.states.length})</span>
              </div>
            </div>
            <span className="text-gray-500 font-semibold">
              {Math.round((coverageData.states.length / 50) * 100)}% Coverage
            </span>
          </div>
        </div>

        {/* World map (cards) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="text-green-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Global Coverage</h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              {['USA', 'UK', 'Canada', 'Australia', 'International'].map(country => {
                const isRegistered = coverageData.countries.includes(country);
                const systemCount = coverageData.countrySystemsMap[country]?.length || 0;
                return (
                  <div
                    key={country}
                    onMouseEnter={() => setHoveredCountry(country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isRegistered ? 'bg-green-100 border-green-400 hover:bg-green-200'
                                   : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold ${isRegistered ? 'text-green-900' : 'text-gray-500'}`}>
                        {country}
                      </span>
                      {isRegistered && <CheckCircle className="text-green-600" size={20} />}
                    </div>
                    {isRegistered && (
                      <>
                        <div className="text-xs text-gray-700">
                          <span className="font-semibold">{systemCount}</span> system{systemCount !== 1 ? 's' : ''}
                        </div>
                        {hoveredCountry === country && (
                          <div className="mt-2 pt-2 border-t border-green-300 text-xs text-gray-700">
                            {coverageData.countrySystemsMap[country]?.join(', ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Systems</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{systems.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {systems.filter(s => s.status === 'Active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">US States</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{coverageData.states.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Countries</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{coverageData.countries.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search systems…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {['All', 'International', 'US State', 'Local/County', 'Private/Commercial', 'US Federal', 'US Territory'].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {['All', 'Active', 'Pending Registration', 'Access Issues'].map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
        {searchTerm && (
          <p className="text-xs text-gray-500 mt-2">
            Showing {filteredSystems.length} of {systems.length}
          </p>
        )}
      </div>

      {/* Systems List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSystems.map(system => {
          const bidCount = getBidCountForSystem(system.systemName);
          const uniqueKey = system.systemId || system.id || system.systemName;

          return (
            <div
              key={uniqueKey}
              onClick={() => setSelectedSystem(system)}
              className="bg-white p-5 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{system.systemName}</h3>
                    {bidCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        <FileText size={12} />
                        {bidCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{system.geographicCoverage}</p>
                </div>
                {getStatusIcon(system.status)}
              </div>

              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(system.status)}`}>
                  {system.status}
                </span>
                <span className="ml-2 text-xs text-gray-500">{system.category}</span>
              </div>

              {system.username && (
                <div className="bg-gray-50 rounded p-3 mb-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Key size={16} />
                    <span className="font-semibold text-xs text-gray-500">Username:</span>
                    <span className="font-mono">{system.username}</span>
                  </div>
                  {system.password && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Key size={16} />
                      <span className="font-semibold text-xs text-gray-500">Password:</span>
                      <span className="font-mono flex-1">
                        {showPasswords[uniqueKey] ? system.password : '••••••••'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePasswordVisibility(uniqueKey);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        aria-label={showPasswords[uniqueKey] ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords[uniqueKey] ? (
                          <EyeOff size={16} className="text-gray-600" />
                        ) : (
                          <Eye size={16} className="text-gray-600" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {system.loginUrl && (
                  <a
                    href={system.loginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    <ExternalLink size={16} />
                    Login
                  </a>
                )}
                {system.websiteUrl && !system.loginUrl && (
                  <a
                    href={system.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Globe size={16} />
                    Visit Site
                  </a>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center mt-3 italic">
                Click card for full details{bidCount > 0 && ` • ${bidCount} active bid${bidCount > 1 ? 's' : ''}`}
              </p>
            </div>
          );
        })}
      </div>

      {filteredSystems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No systems found matching your filters
        </div>
      )}

      {/* Modals */}
      {showAddForm && (
        <AddBidSystemForm
          onClose={() => setShowAddForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {selectedSystem && (
        <BidSystemDetailModal
          system={selectedSystem}
          allBids={allBids}
          onClose={() => setSelectedSystem(null)}
        />
      )}

      {showSystemsCorrespondence && (
        <SystemsCorrespondenceModal
          isOpen={showSystemsCorrespondence}
          onClose={() => setShowSystemsCorrespondence(false)}
          emails={adminEmails}
          onArchive={handleArchiveAdminEmail}
          onRefresh={loadAdminEmails}
        />
      )}
    </div>
  );
};

export default BidSystemsManager;
