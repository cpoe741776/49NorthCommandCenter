// BidSystemsManager.jsx //

import React, { useState, useEffect } from 'react';
import { ExternalLink, Key, Globe, Search, CheckCircle, Clock, AlertCircle, Plus, Eye, EyeOff } from 'lucide-react';

const BidSystemsManager = () => {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    loadSystems();
  }, []);

  const loadSystems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/.netlify/functions/getBidSystems');
      const data = await response.json();
      
      if (data.success) {
        // Filter out empty rows (where systemName is empty)
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

  const togglePasswordVisibility = (systemId) => {
    setShowPasswords(prev => ({
      ...prev,
      [systemId]: !prev[systemId]
    }));
  };

  const handleAddNewSystem = () => {
    // Open Google Sheet in new tab to add manually for now
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.REACT_APP_BID_SYSTEMS_SHEET_ID || 'your-sheet-id'}/edit`;
    window.open(sheetUrl, '_blank');
    alert('Add your new system in the Google Sheet, then refresh this page to see it here.');
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
      {/* Header with Add Button */}
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
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {systems.filter(s => s.category === 'US State').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {systems.filter(s => s.status === 'Pending Registration').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
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

          {/* Category Filter */}
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

          {/* Status Filter */}
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
        {filteredSystems.map(system => (
          <div key={system.id} className="bg-white p-5 rounded-lg shadow hover:shadow-lg transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg">{system.systemName}</h3>
                <p className="text-sm text-gray-600">{system.geographicCoverage}</p>
              </div>
              {getStatusIcon(system.status)}
            </div>

            {/* Status Badge */}
            <div className="mb-3">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(system.status)}`}>
                {system.status}
              </span>
              <span className="ml-2 text-xs text-gray-500">{system.category}</span>
            </div>

            {/* Credentials - NOW WITH PASSWORD */}
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
                      onClick={() => togglePasswordVisibility(system.systemId)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={showPasswords[system.systemId] ? 'Hide password' : 'Show password'}
                    >
                      {showPasswords[system.systemId] ? (
                        <EyeOff size={16} className="text-gray-600" />
                      ) : (
                        <Eye size={16} className="text-gray-600" />
                      )}
                    </button>
                  </div>
                )}
                {system.notes && !system.notes.includes('Vendor') && (
                  <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">{system.notes}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {system.loginUrl && (
                
                  <a href={system.loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
                >
                  <Globe size={16} />
                  Visit Site
                </a>
              )}
            </div>

            {/* Vendor Number */}
            {system.notes && system.notes.includes('Vendor') && (
              <p className="text-xs text-gray-600 mt-2 text-center bg-blue-50 py-1 px-2 rounded">{system.notes}</p>
            )}
          </div>
        ))}
      </div>

      {filteredSystems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No systems found matching your filters
        </div>
      )}
    </div>
  );
};

export default BidSystemsManager;