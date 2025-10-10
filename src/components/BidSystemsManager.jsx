// BidSystemsManager.jsx //

import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Key, Globe, Search, CheckCircle, Clock, AlertCircle, Plus, Eye, EyeOff, FileText, MapPin } from 'lucide-react';
import AddBidSystemForm from './AddBidSystemForm';
import BidSystemDetailModal from './BidSystemDetailModal';
import USStateMap from './USStateMap';

const BidSystemsManager = ({ allBids }) => {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showPasswords, setShowPasswords] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  useEffect(() => {
    loadSystems();
    
    const filterBySystem = localStorage.getItem('filterBySystem');
    if (filterBySystem) {
      setSearchTerm(filterBySystem);
      localStorage.removeItem('filterBySystem');
    }
  }, []);

  const loadSystems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/.netlify/functions/getBidSystems');
      const data = await response.json();
      
      if (data.success) {
        const validSystems = data.systems.filter(s => s.systemName && s.systemName.trim() !== '');
        setSystems(validSystems);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load bid systems');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Parse state and country coverage
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

      if (category === 'us state' || category === 'local/county') {
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
        if (!countrySystemsMap['UK']) countrySystemsMap['UK'] = [];
        countrySystemsMap['UK'].push(system.systemName);
      } else if (geo.includes('united states') || geo.includes('usa') || category === 'us state') {
        countries.add('USA');
        if (!countrySystemsMap['USA']) countrySystemsMap['USA'] = [];
        countrySystemsMap['USA'].push(system.systemName);
      } else if (geo.includes('canada')) {
        countries.add('Canada');
        if (!countrySystemsMap['Canada']) countrySystemsMap['Canada'] = [];
        countrySystemsMap['Canada'].push(system.systemName);
      } else if (geo.includes('australia')) {
        countries.add('Australia');
        if (!countrySystemsMap['Australia']) countrySystemsMap['Australia'] = [];
        countrySystemsMap['Australia'].push(system.systemName);
      } else if (geo.includes('international') || geo.includes('global')) {
        countries.add('International');
        if (!countrySystemsMap['International']) countrySystemsMap['International'] = [];
        countrySystemsMap['International'].push(system.systemName);
      }
    });

    return { 
      states: Array.from(states), 
      countries: Array.from(countries),
      stateSystemsMap,
      countrySystemsMap
    };
  }, [systems]);

  const togglePasswordVisibility = (systemId) => {
    setShowPasswords(prev => ({
      ...prev,
      [systemId]: !prev[systemId]
    }));
  };

  const handleAddNewSystem = () => {
    setShowAddForm(true);
  };

  const handleFormSuccess = () => {
    setShowAddForm(false);
    loadSystems();
    alert('System added successfully!');
  };

  const getBidCountForSystem = (systemName) => {
    if (!allBids || !Array.isArray(allBids)) return 0;
    return allBids.filter(bid => 
      bid.bidSystem && bid.bidSystem.toLowerCase() === systemName.toLowerCase()
    ).length;
  };

  const filteredSystems = systems.filter(system => {
    const matchesSearch = system.systemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         system.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || system.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || system.status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'Pending Registration':
        return <Clock className="text-yellow-600" size={20} />;
      case 'Access Issues':
        return <AlertCircle className="text-red-600" size={20} />;
      default:
        return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending Registration':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Access Issues':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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
        <button onClick={loadSystems} className="mt-2 text-red-600 hover:text-red-800">
          Try Again
        </button>
      </div>
    );
  }

  const categories = ['All', 'International', 'US State', 'Local/County', 'Private/Commercial'];
  const statuses = ['All', 'Active', 'Pending Registration', 'Access Issues'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bid Systems Registry</h1>
          <p className="text-gray-600 mt-1">Manage your {systems.length} registered procurement systems</p>
        </div>
        <button
          onClick={handleAddNewSystem}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add New System
        </button>
      </div>

      {/* Maps Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       {/* US State Map - Using Custom SVG */}
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
    />
    
    {hoveredState && coverageData.stateSystemsMap[hoveredState] && (
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 max-w-xs z-10">
        <p className="font-semibold text-gray-900 mb-1">{hoveredState}</p>
        <p className="text-xs text-gray-600">
          {coverageData.stateSystemsMap[hoveredState].join(', ')}
        </p>
      </div>
    )}
  </div>
  <div className="mt-4 flex items-center justify-between text-sm">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-blue-400 rounded"></div>
        <span className="text-gray-600">Registered ({coverageData.states.length})</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 rounded"></div>
        <span className="text-gray-600">Not Registered ({50 - coverageData.states.length})</span>
      </div>
    </div>
    <span className="text-gray-500 font-semibold">
      {Math.round((coverageData.states.length / 50) * 100)}% Coverage
    </span>
  </div>
</div>

        {/* World Map */}
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
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isRegistered 
                        ? 'bg-green-100 border-green-400 hover:bg-green-200' 
                        : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold ${isRegistered ? 'text-green-900' : 'text-gray-500'}`}>
                        {country}
                      </span>
                      {isRegistered && (
                        <CheckCircle className="text-green-600" size={20} />
                      )}
                    </div>
                    {isRegistered && (
                      <div className="text-xs text-gray-700">
                        <span className="font-semibold">{systemCount}</span> system{systemCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    {hoveredCountry === country && isRegistered && (
                      <div className="mt-2 pt-2 border-t border-green-300 text-xs text-gray-700">
                        {coverageData.countrySystemsMap[country]?.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-400 rounded"></div>
                <span className="text-gray-600">Active ({coverageData.countries.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <span className="text-gray-600">No Coverage</span>
              </div>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search systems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(cat => (
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
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Systems List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSystems.map(system => {
          const bidCount = getBidCountForSystem(system.systemName);
          
          return (
            <div 
              key={system.id} 
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
                        {showPasswords[system.systemId] ? system.password : '••••••••'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePasswordVisibility(system.systemId);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {showPasswords[system.systemId] ? (
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
                  <a href={system.loginUrl}
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
                  <a href={system.websiteUrl}
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
    </div>
  );
};

export default BidSystemsManager;