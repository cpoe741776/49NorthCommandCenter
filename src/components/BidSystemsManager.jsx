// BidSystemsManager.jsx //

import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Key, Globe, Search, CheckCircle, Clock, AlertCircle, Plus, Eye, EyeOff, FileText, MapPin } from 'lucide-react';
import AddBidSystemForm from './AddBidSystemForm';
import BidSystemDetailModal from './BidSystemDetailModal';

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
       {/* US State Map - FIXED VERSION */}
<div className="bg-white p-6 rounded-lg shadow">
  <div className="flex items-center gap-2 mb-4">
    <MapPin className="text-blue-600" size={24} />
    <h2 className="text-xl font-bold text-gray-900">US State Coverage</h2>
  </div>
  <div className="bg-gray-50 rounded-lg p-4 relative">
    <svg viewBox="0 0 1000 650" className="w-full h-auto">
      <g id="states">
        {/* Pacific */}
        <rect id="WA" x="50" y="30" width="100" height="80" fill={coverageData.states.includes('WA') ? (hoveredState === 'WA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="OR" x="50" y="115" width="100" height="75" fill={coverageData.states.includes('OR') ? (hoveredState === 'OR' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('OR')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="CA" x="30" y="195" width="110" height="150" fill={coverageData.states.includes('CA') ? (hoveredState === 'CA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('CA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Mountain */}
        <rect id="MT" x="155" y="35" width="130" height="70" fill={coverageData.states.includes('MT') ? (hoveredState === 'MT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="ID" x="155" y="110" width="80" height="115" fill={coverageData.states.includes('ID') ? (hoveredState === 'ID' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('ID')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="WY" x="240" y="110" width="95" height="85" fill={coverageData.states.includes('WY') ? (hoveredState === 'WY' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WY')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NV" x="145" y="230" width="85" height="105" fill={coverageData.states.includes('NV') ? (hoveredState === 'NV' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NV')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="UT" x="235" y="200" width="80" height="100" fill={coverageData.states.includes('UT') ? (hoveredState === 'UT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('UT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="CO" x="320" y="200" width="100" height="85" fill={coverageData.states.includes('CO') ? (hoveredState === 'CO' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('CO')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="AZ" x="235" y="305" width="100" height="100" fill={coverageData.states.includes('AZ') ? (hoveredState === 'AZ' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AZ')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NM" x="340" y="290" width="95" height="115" fill={coverageData.states.includes('NM') ? (hoveredState === 'NM' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NM')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Plains */}
        <rect id="ND" x="340" y="35" width="100" height="65" fill={coverageData.states.includes('ND') ? (hoveredState === 'ND' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('ND')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="SD" x="340" y="105" width="100" height="70" fill={coverageData.states.includes('SD') ? (hoveredState === 'SD' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('SD')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NE" x="340" y="180" width="115" height="65" fill={coverageData.states.includes('NE') ? (hoveredState === 'NE' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NE')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="KS" x="340" y="250" width="115" height="65" fill={coverageData.states.includes('KS') ? (hoveredState === 'KS' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('KS')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="OK" x="340" y="320" width="135" height="70" fill={coverageData.states.includes('OK') ? (hoveredState === 'OK' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('OK')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="TX" x="340" y="395" width="155" height="155" fill={coverageData.states.includes('TX') ? (hoveredState === 'TX' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('TX')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Midwest */}
        <rect id="MN" x="445" y="45" width="90" height="110" fill={coverageData.states.includes('MN') ? (hoveredState === 'MN' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MN')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="WI" x="540" y="80" width="75" height="95" fill={coverageData.states.includes('WI') ? (hoveredState === 'WI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="IA" x="460" y="160" width="85" height="75" fill={coverageData.states.includes('IA') ? (hoveredState === 'IA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('IA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="MO" x="460" y="240" width="95" height="85" fill={coverageData.states.includes('MO') ? (hoveredState === 'MO' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MO')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="AR" x="480" y="330" width="85" height="80" fill={coverageData.states.includes('AR') ? (hoveredState === 'AR' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AR')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="LA" x="500" y="415" width="85" height="90" fill={coverageData.states.includes('LA') ? (hoveredState === 'LA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('LA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Great Lakes */}
        <rect id="MI" x="620" y="95" width="85" height="105" fill={coverageData.states.includes('MI') ? (hoveredState === 'MI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="IL" x="550" y="180" width="70" height="110" fill={coverageData.states.includes('IL') ? (hoveredState === 'IL' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('IL')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="IN" x="625" y="205" width="65" height="85" fill={coverageData.states.includes('IN') ? (hoveredState === 'IN' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('IN')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="OH" x="695" y="195" width="85" height="80" fill={coverageData.states.includes('OH') ? (hoveredState === 'OH' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('OH')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* South */}
        <rect id="KY" x="625" y="295" width="105" height="55" fill={coverageData.states.includes('KY') ? (hoveredState === 'KY' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('KY')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="TN" x="570" y="355" width="150" height="55" fill={coverageData.states.includes('TN') ? (hoveredState === 'TN' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('TN')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="MS" x="590" y="415" width="60" height="90" fill={coverageData.states.includes('MS') ? (hoveredState === 'MS' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MS')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="AL" x="655" y="415" width="70" height="100" fill={coverageData.states.includes('AL') ? (hoveredState === 'AL' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AL')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Southeast */}
        <rect id="WV" x="735" y="280" width="70" height="60" fill={coverageData.states.includes('WV') ? (hoveredState === 'WV' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WV')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="VA" x="760" y="245" width="95" height="60" fill={coverageData.states.includes('VA') ? (hoveredState === 'VA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('VA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NC" x="725" y="345" width="125" height="60" fill={coverageData.states.includes('NC') ? (hoveredState === 'NC' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NC')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="SC" x="735" y="410" width="90" height="65" fill={coverageData.states.includes('SC') ? (hoveredState === 'SC' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('SC')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="GA" x="730" y="480" width="90" height="90" fill={coverageData.states.includes('GA') ? (hoveredState === 'GA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('GA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="FL" x="825" y="485" width="110" height="125" fill={coverageData.states.includes('FL') ? (hoveredState === 'FL' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('FL')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Northeast */}
        <rect id="PA" x="785" y="190" width="90" height="60" fill={coverageData.states.includes('PA') ? (hoveredState === 'PA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('PA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NY" x="810" y="110" width="110" height="75" fill={coverageData.states.includes('NY') ? (hoveredState === 'NY' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NY')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="VT" x="895" y="80" width="35" height="60" fill={coverageData.states.includes('VT') ? (hoveredState === 'VT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('VT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NH" x="935" y="85" width="35" height="60" fill={coverageData.states.includes('NH') ? (hoveredState === 'NH' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NH')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="ME" x="925" y="30" width="45" height="90" fill={coverageData.states.includes('ME') ? (hoveredState === 'ME' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('ME')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="MA" x="905" y="145" width="65" height="30" fill={coverageData.states.includes('MA') ? (hoveredState === 'MA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="RI" x="950" y="155" width="20" height="25" fill={coverageData.states.includes('RI') ? (hoveredState === 'RI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('RI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="CT" x="905" y="180" width="60" height="30" fill={coverageData.states.includes('CT') ? (hoveredState === 'CT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('CT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="NJ" x="880" y="195" width="40" height="55" fill={coverageData.states.includes('NJ') ? (hoveredState === 'NJ' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NJ')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="DE" x="880" y="225" width="25" height="35" fill={coverageData.states.includes('DE') ? (hoveredState === 'DE' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('DE')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="MD" x="820" y="255" width="80" height="35" fill={coverageData.states.includes('MD') ? (hoveredState === 'MD' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MD')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        
        {/* Alaska & Hawaii */}
        <rect id="AK" x="30" y="530" width="120" height="90" fill={coverageData.states.includes('AK') ? (hoveredState === 'AK' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AK')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
        <rect id="HI" x="180" y="555" width="100" height="50" fill={coverageData.states.includes('HI') ? (hoveredState === 'HI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('HI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
      </g>
      
      {/* State Labels - Only registered states */}
      {coverageData.states.map(state => {
        const positions = {
          'WA': [100, 70], 'OR': [100, 153], 'CA': [85, 270], 'MT': [220, 70], 'ID': [195, 168],
          'WY': [288, 153], 'NV': [188, 283], 'UT': [275, 250], 'CO': [370, 243], 'AZ': [285, 355],
          'NM': [388, 348], 'ND': [390, 68], 'SD': [390, 140], 'NE': [398, 213], 'KS': [398, 283],
          'OK': [408, 355], 'TX': [418, 473], 'MN': [490, 100], 'WI': [578, 128], 'IA': [503, 198],
          'MO': [508, 283], 'AR': [523, 370], 'LA': [543, 460], 'MI': [663, 148], 'IL': [585, 235],
          'IN': [658, 248], 'OH': [738, 235], 'KY': [678, 323], 'TN': [645, 383], 'MS': [620, 460],
          'AL': [690, 465], 'WV': [770, 310], 'VA': [808, 275], 'NC': [788, 375], 'SC': [780, 443],
          'GA': [775, 525], 'FL': [880, 548], 'PA': [830, 220], 'NY': [865, 148], 'VT': [913, 110],
          'NH': [953, 115], 'ME': [948, 75], 'MA': [938, 160], 'RI': [960, 168], 'CT': [935, 195],
          'NJ': [900, 223], 'DE': [893, 243], 'MD': [860, 273], 'AK': [90, 575], 'HI': [230, 580]
        };
        const pos = positions[state];
        if (!pos) return null;
        return (
          <text key={state} x={pos[0]} y={pos[1]} fontSize="12" fontWeight="bold" fill="#1e40af" textAnchor="middle" pointerEvents="none">
            {state}
          </text>
        );
      })}
    </svg>
    
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