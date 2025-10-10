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
        {/* US State Map - IMPROVED VERSION */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">US State Coverage</h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 relative">
            <svg viewBox="0 0 960 600" className="w-full h-auto">
              <g id="states">
                {/* West Coast */}
                <path id="WA" d="M90,50 L150,50 L150,110 L90,110 Z" fill={coverageData.states.includes('WA') ? (hoveredState === 'WA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="OR" d="M90,115 L150,115 L150,175 L90,175 Z" fill={coverageData.states.includes('OR') ? (hoveredState === 'OR' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('OR')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="CA" d="M75,180 L145,180 L145,290 L75,290 Z" fill={coverageData.states.includes('CA') ? (hoveredState === 'CA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('CA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Mountain West */}
                <path id="MT" d="M155,50 L245,50 L245,115 L155,115 Z" fill={coverageData.states.includes('MT') ? (hoveredState === 'MT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="ID" d="M155,120 L215,120 L215,195 L155,195 Z" fill={coverageData.states.includes('ID') ? (hoveredState === 'ID' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('ID')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="WY" d="M220,120 L300,120 L300,185 L220,185 Z" fill={coverageData.states.includes('WY') ? (hoveredState === 'WY' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WY')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NV" d="M150,200 L210,200 L210,285 L150,285 Z" fill={coverageData.states.includes('NV') ? (hoveredState === 'NV' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NV')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="UT" d="M215,200 L275,200 L275,265 L215,265 Z" fill={coverageData.states.includes('UT') ? (hoveredState === 'UT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('UT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="CO" d="M280,190 L370,190 L370,260 L280,260 Z" fill={coverageData.states.includes('CO') ? (hoveredState === 'CO' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('CO')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="AZ" d="M215,270 L295,270 L295,360 L215,360 Z" fill={coverageData.states.includes('AZ') ? (hoveredState === 'AZ' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AZ')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NM" d="M300,265 L380,265 L380,360 L300,360 Z" fill={coverageData.states.includes('NM') ? (hoveredState === 'NM' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NM')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Great Plains */}
                <path id="ND" d="M375,50 L455,50 L455,105 L375,105 Z" fill={coverageData.states.includes('ND') ? (hoveredState === 'ND' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('ND')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="SD" d="M375,110 L455,110 L455,170 L375,170 Z" fill={coverageData.states.includes('SD') ? (hoveredState === 'SD' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('SD')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NE" d="M375,175 L465,175 L465,235 L375,235 Z" fill={coverageData.states.includes('NE') ? (hoveredState === 'NE' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NE')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="KS" d="M375,240 L465,240 L465,295 L375,295 Z" fill={coverageData.states.includes('KS') ? (hoveredState === 'KS' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('KS')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="OK" d="M385,300 L495,300 L495,360 L385,360 Z" fill={coverageData.states.includes('OK') ? (hoveredState === 'OK' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('OK')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="TX" d="M400,365 L540,365 L540,505 L400,505 Z" fill={coverageData.states.includes('TX') ? (hoveredState === 'TX' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('TX')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Upper Midwest */}
                <path id="MN" d="M460,60 L535,60 L535,165 L460,165 Z" fill={coverageData.states.includes('MN') ? (hoveredState === 'MN' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MN')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="WI" d="M540,90 L600,90 L600,175 L540,175 Z" fill={coverageData.states.includes('WI') ? (hoveredState === 'WI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="IA" d="M470,170 L545,170 L545,230 L470,230 Z" fill={coverageData.states.includes('IA') ? (hoveredState === 'IA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('IA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="MO" d="M470,235 L555,235 L555,305 L470,305 Z" fill={coverageData.states.includes('MO') ? (hoveredState === 'MO' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MO')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="AR" d="M500,310 L570,310 L570,375 L500,375 Z" fill={coverageData.states.includes('AR') ? (hoveredState === 'AR' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AR')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="LA" d="M525,380 L600,380 L600,445 L525,445 Z" fill={coverageData.states.includes('LA') ? (hoveredState === 'LA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('LA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Great Lakes */}
                <path id="MI" d="M605,105 L675,105 L675,185 L605,185 Z" fill={coverageData.states.includes('MI') ? (hoveredState === 'MI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="IL" d="M550,180 L605,180 L605,265 L550,265 Z" fill={coverageData.states.includes('IL') ? (hoveredState === 'IL' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('IL')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="IN" d="M610,185 L665,185 L665,255 L610,255 Z" fill={coverageData.states.includes('IN') ? (hoveredState === 'IN' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('IN')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="OH" d="M670,190 L735,190 L735,255 L670,255 Z" fill={coverageData.states.includes('OH') ? (hoveredState === 'OH' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('OH')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* South */}
                <path id="KY" d="M610,260 L690,260 L690,305 L610,305 Z" fill={coverageData.states.includes('KY') ? (hoveredState === 'KY' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('KY')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="TN" d="M575,310 L695,310 L695,360 L575,360 Z" fill={coverageData.states.includes('TN') ? (hoveredState === 'TN' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('TN')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="MS" d="M575,380 L625,380 L625,455 L575,455 Z" fill={coverageData.states.includes('MS') ? (hoveredState === 'MS' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MS')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="AL" d="M630,370 L685,370 L685,465 L630,465 Z" fill={coverageData.states.includes('AL') ? (hoveredState === 'AL' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AL')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Southeast */}
                <path id="WV" d="M695,260 L755,260 L755,310 L695,310 Z" fill={coverageData.states.includes('WV') ? (hoveredState === 'WV' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('WV')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="VA" d="M740,245 L820,245 L820,295 L740,295 Z" fill={coverageData.states.includes('VA') ? (hoveredState === 'VA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('VA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NC" d="M700,315 L810,315 L810,365 L700,365 Z" fill={coverageData.states.includes('NC') ? (hoveredState === 'NC' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NC')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="SC" d="M710,370 L790,370 L790,420 L710,420 Z" fill={coverageData.states.includes('SC') ? (hoveredState === 'SC' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('SC')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="GA" d="M690,425 L765,425 L765,500 L690,500 Z" fill={coverageData.states.includes('GA') ? (hoveredState === 'GA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('GA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="FL" d="M770,460 L850,460 L850,550 L770,550 Z" fill={coverageData.states.includes('FL') ? (hoveredState === 'FL' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('FL')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Northeast */}
                <path id="PA" d="M760,195 L835,195 L835,245 L760,245 Z" fill={coverageData.states.includes('PA') ? (hoveredState === 'PA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('PA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NY" d="M760,135 L850,135 L850,190 L760,190 Z" fill={coverageData.states.includes('NY') ? (hoveredState === 'NY' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NY')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="VT" d="M855,100 L885,100 L885,145 L855,145 Z" fill={coverageData.states.includes('VT') ? (hoveredState === 'VT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('VT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NH" d="M890,100 L920,100 L920,145 L890,145 Z" fill={coverageData.states.includes('NH') ? (hoveredState === 'NH' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NH')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="ME" d="M890,50 L935,50 L935,120 L890,120 Z" fill={coverageData.states.includes('ME') ? (hoveredState === 'ME' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('ME')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="MA" d="M855,150 L930,150 L930,175 L855,175 Z" fill={coverageData.states.includes('MA') ? (hoveredState === 'MA' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MA')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="RI" d="M910,175 L930,175 L930,190 L910,190 Z" fill={coverageData.states.includes('RI') ? (hoveredState === 'RI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('RI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="CT" d="M855,180 L905,180 L905,200 L855,200 Z" fill={coverageData.states.includes('CT') ? (hoveredState === 'CT' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('CT')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="NJ" d="M840,200 L870,200 L870,240 L840,240 Z" fill={coverageData.states.includes('NJ') ? (hoveredState === 'NJ' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('NJ')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="DE" d="M840,245 L860,245 L860,270 L840,270 Z" fill={coverageData.states.includes('DE') ? (hoveredState === 'DE' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('DE')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="MD" d="M760,250 L830,250 L830,280 L760,280 Z" fill={coverageData.states.includes('MD') ? (hoveredState === 'MD' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('MD')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                
                {/* Alaska & Hawaii (inset) */}
                <path id="AK" d="M50,480 L140,480 L140,550 L50,550 Z" fill={coverageData.states.includes('AK') ? (hoveredState === 'AK' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('AK')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
                <path id="HI" d="M180,500 L260,500 L260,550 L180,550 Z" fill={coverageData.states.includes('HI') ? (hoveredState === 'HI' ? '#3b82f6' : '#60a5fa') : '#e5e7eb'} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHoveredState('HI')} onMouseLeave={() => setHoveredState(null)} className="cursor-pointer transition-colors" />
              </g>
              
              {/* State Labels - Only show for registered states */}
              {coverageData.states.map(state => {
                const labelPositions = {
                  'CA': [110, 235], 'TX': [470, 435], 'FL': [810, 505], 'NY': [805, 163],
                  'PA': [798, 220], 'IL': [578, 223], 'OH': [703, 223], 'GA': [728, 463],
                  'NC': [755, 340], 'MI': [640, 145], 'NJ': [855, 220], 'VA': [780, 270],
                  'WA': [120, 80], 'AZ': [255, 315], 'MA': [893, 163], 'TN': [635, 335],
                  'IN': [638, 220], 'MO': [513, 270], 'MD': [795, 265], 'WI': [570, 133],
                  'CO': [325, 225], 'MN': [498, 113], 'SC': [750, 395], 'AL': [658, 418],
                  'LA': [563, 413], 'KY': [650, 283], 'OR': [120, 145], 'OK': [440, 330],
                  'CT': [880, 190], 'IA': [508, 200], 'MS': [600, 418], 'AR': [535, 343],
                  'KS': [420, 268], 'UT': [245, 233], 'NV': [180, 243], 'NM': [340, 313],
                  'WV': [725, 285], 'NE': [420, 205], 'ID': [185, 158], 'HI': [220, 525],
                  'ME': [913, 85], 'NH': [905, 123], 'RI': [920, 183], 'MT': [200, 83],
                  'DE': [850, 258], 'SD': [415, 140], 'ND': [415, 78], 'AK': [95, 515],
                  'VT': [870, 123], 'WY': [260, 153]
                };
                const pos = labelPositions[state];
                if (!pos) return null;
                return (
                  <text
                    key={state}
                    x={pos[0]}
                    y={pos[1]}
                    fontSize="11"
                    fill="#1e40af"
                    fontWeight="bold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
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