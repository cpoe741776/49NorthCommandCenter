// src/components/ContactCRM.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Users, RefreshCw, Search, Filter, Download,
  TrendingUp, Star, Calendar, AlertCircle, UserPlus, X, ChevronUp,
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Eye, EyeOff
} from 'lucide-react';
import ContactDetailModal from './ContactDetailModal';

const ContactCRM = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false); // Changed: Don't load on mount
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  
  // New: Dedicated search fields
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchOrganization, setSearchOrganization] = useState('');
  const [searchState, setSearchState] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const [filterType, setFilterType] = useState('all'); // all, hot-leads, webinar-attendees, cold-leads
  const [selectedContact, setSelectedContact] = useState(null);
  const [page, setPage] = useState(0);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    email: '',
    firstName: '',
    lastName: '',
    organization: '',
    phone: '',
    jobTitle: ''
  });
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [sortField, setSortField] = useState('name'); // name, email, organization, leadScore, lastChanged
  const [sortDirection, setSortDirection] = useState('asc'); // asc, desc
  const [showBrevoPassword, setShowBrevoPassword] = useState(false);
  const topRef = useRef(null);

  // Load summary stats only (no contacts)
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/.netlify/functions/getContacts?limit=0&summaryOnly=true');
      const data = await res.json();
      
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, []);

  // New: Search with dedicated fields
  const handleSearch = useCallback(async () => {
    // At least one field must be filled
    if (!searchFirstName.trim() && !searchLastName.trim() && !searchEmail.trim() && 
        !searchOrganization.trim() && !searchState.trim() && !searchCountry.trim()) {
      alert('Please enter at least one search criteria (Name, Email, Organization, State, or Country)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);
      
      const params = new URLSearchParams();
      params.append('limit', '100'); // Limit search results
      params.append('offset', page * 100);
      if (filterType !== 'all') params.append('filter', filterType);
      if (searchFirstName.trim()) params.append('firstName', searchFirstName.trim());
      if (searchLastName.trim()) params.append('lastName', searchLastName.trim());
      if (searchEmail.trim()) params.append('email', searchEmail.trim());
      if (searchOrganization.trim()) params.append('organization', searchOrganization.trim());
      if (searchState.trim()) params.append('state', searchState.trim());
      if (searchCountry.trim()) params.append('country', searchCountry.trim());
      
      const res = await fetch(`/.netlify/functions/getContacts?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setContacts(data.contacts || []);
        if (data.contacts.length === 0) {
          setError('No contacts found matching your search criteria');
        }
      } else {
        setError(data.error || 'Failed to search contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, searchFirstName, searchLastName, searchEmail, searchOrganization, searchState, searchCountry, page]);

  const clearSearch = () => {
    setSearchFirstName('');
    setSearchLastName('');
    setSearchEmail('');
    setSearchOrganization('');
    setSearchState('');
    setSearchCountry('');
    setContacts([]);
    setHasSearched(false);
    setError(null);
    setPage(0);
  };

  const handleCreateContact = async () => {
    if (!newContact.email || !newContact.email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/createContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ Contact created: ${newContact.email}`);
        setShowNewContactModal(false);
        setNewContact({ email: '', firstName: '', lastName: '', organization: '', phone: '', jobTitle: '' });
        loadSummary(); // Refresh summary
      } else {
        alert(data.error || 'Failed to create contact');
      }
    } catch (err) {
      alert(`Error creating contact: ${err.message}`);
    }
  };

  // Load summary stats on mount
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Scroll to top when page changes
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [page]);

  // Show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to ascending for new field
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort contacts based on current sort field and direction
  const sortedContacts = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];

    const sorted = [...contacts].sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'name':
          aVal = (a.name || a.email || '').toLowerCase();
          bVal = (b.name || b.email || '').toLowerCase();
          break;
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'organization':
          aVal = (a.organization || '').toLowerCase();
          bVal = (b.organization || '').toLowerCase();
          break;
        case 'leadScore':
          aVal = a.leadScore || 0;
          bVal = b.leadScore || 0;
          break;
        case 'leadStatus':
          // Sort order: Hot Lead, Warm, Cold
          const statusOrder = { 'Hot Lead': 3, 'Warm': 2, 'Cold': 1 };
          aVal = statusOrder[a.leadStatus] || 0;
          bVal = statusOrder[b.leadStatus] || 0;
          break;
        case 'lastChanged':
          aVal = new Date(a.lastChanged || 0);
          bVal = new Date(b.lastChanged || 0);
          break;
        case 'webinarsAttended':
          aVal = a.webinarsAttendedCount || 0;
          bVal = b.webinarsAttendedCount || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [contacts, sortField, sortDirection]);

  const handleSync = async () => {
    if (!window.confirm('Sync all webinar registrants and attendees to Brevo? This may take a few minutes.')) {
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/.netlify/functions/syncWebinarContactsToBrevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ Sync complete!\n\nCreated: ${data.created}\nUpdated: ${data.updated}\nErrors: ${data.errors}`);
        loadSummary(); // Refresh summary
      } else {
        alert(`❌ Sync failed: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const exportToCSV = () => {
    if (contacts.length === 0) {
      alert('No contacts to export');
      return;
    }

    const headers = ['Email', 'Name', 'Organization', 'Job Title', 'Phone', 'City', 'State', 'Lead Status', 'Webinars Attended', 'Survey Contact'];
    const rows = contacts.map(c => [
      c.email,
      c.name,
      c.organization,
      c.jobTitle,
      c.phone,
      c.city,
      c.state,
      c.leadStatus,
      c.webinarsAttendedCount || 0,
      c.surveyContact
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLeadStatusBadge = (status) => {
    if (status === 'Hot Lead') return 'bg-red-100 text-red-800 border-red-300';
    if (status === 'Warm') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-600 border-gray-300';
  };

  const getLeadStatusIcon = (status) => {
    if (status === 'Hot Lead') return '🔥';
    if (status === 'Warm') return '⚡';
    return '❄️';
  };

  if (loading && !contacts.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="text-gray-600">Loading contacts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scroll anchor */}
      <div ref={topRef} />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-blue-600" size={36} />
            Contact CRM
          </h1>
          <p className="text-gray-600 mt-1">Unified contact management powered by Brevo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewContactModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <UserPlus size={18} />
            New Contact
          </button>
          <button
            onClick={loadSummary}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh Stats
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <TrendingUp size={18} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Webinars'}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Contacts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalContacts}</p>
              </div>
              <Users className="text-blue-600" size={32} />
            </div>
          </div>

          <div 
            onClick={() => { setFilterType('hot-leads'); setPage(0); }}
            className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-lg shadow border-2 border-red-200 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-semibold">Hot Leads</p>
                <p className="text-3xl font-bold text-red-900 mt-1">
                  {summary.hotLeads}
                  {summary.estimated && <span className="text-sm text-red-600 ml-1">*</span>}
                </p>
              </div>
              <Star className="text-red-600" size={32} />
            </div>
            <p className="text-xs text-red-600 mt-2">Click to filter</p>
          </div>

          <div 
            onClick={() => { setFilterType('webinar-attendees'); setPage(0); }}
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Webinar Attendees</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.webinarAttendees}
                  {summary.estimated && <span className="text-sm text-gray-600 ml-1">*</span>}
                </p>
              </div>
              <Users className="text-purple-600" size={32} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Click to filter</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Follow-Ups</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.pendingFollowUps}</p>
              </div>
              <Calendar className="text-yellow-600" size={32} />
            </div>
          </div>

          <div 
            onClick={() => { setFilterType('cold-leads'); setPage(0); }}
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cold Contacts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.coldContacts}
                  {summary.estimated && <span className="text-sm text-gray-600 ml-1">*</span>}
                </p>
              </div>
              <AlertCircle className="text-gray-400" size={32} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Click to filter</p>
          </div>
        </div>
      )}

      {/* Stats Note */}
      {summary?.estimated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-900">
            <strong>* Estimated:</strong> Stats calculated from a sample of {summary.sampleSize?.toLocaleString()} contacts and extrapolated across all {summary.totalContacts?.toLocaleString()} contacts for performance.
          </p>
        </div>
      )}

      {/* Brevo Login Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-lg shadow border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2 mb-2">
              <ExternalLink size={20} />
              Brevo Login
            </h3>
            <p className="text-sm text-purple-700 mb-3">
              For comprehensive contact management, log in to Brevo directly
            </p>
            <div className="bg-white p-3 rounded border border-purple-200 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-700 min-w-[80px]">Username:</span>
                <code className="bg-gray-100 px-2 py-1 rounded text-gray-900">chris@mymentalarmor.com</code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-700 min-w-[80px]">Password:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-gray-900">
                    {showBrevoPassword ? 'TechWerks1!!' : '••••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowBrevoPassword(!showBrevoPassword)}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    {showBrevoPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <a
            href="https://app.brevo.com/contacts/list"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            <ExternalLink size={20} />
            Open Brevo
          </a>
        </div>
      </div>

      {/* Dedicated Search Fields */}
      <div className="bg-white p-5 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Search size={20} className="text-blue-600" />
            Contact Search
          </h3>
          {hasSearched && (
            <button
              onClick={clearSearch}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear Search
            </button>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Search the entire database by any combination of fields. <strong>Combine fields</strong> (e.g., State + Organization) to narrow results. Perfect for targeted outreach campaigns!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Row 1: Personal Info */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={searchFirstName}
              onChange={(e) => setSearchFirstName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., John"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={searchLastName}
              onChange={(e) => setSearchLastName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., Smith"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., john@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Row 2: Organization & Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Organization</label>
            <input
              type="text"
              value={searchOrganization}
              onChange={(e) => setSearchOrganization(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., Acme Corp"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">State/Province</label>
            <input
              type="text"
              value={searchState}
              onChange={(e) => setSearchState(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., Delaware, CA, TX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Country/Region</label>
            <input
              type="text"
              value={searchCountry}
              onChange={(e) => setSearchCountry(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., United States, Canada"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
          >
            <Search size={18} />
            {loading ? 'Searching...' : 'Search Contacts'}
          </button>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Contacts</option>
              <option value="hot-leads">🔥 Hot Leads</option>
              <option value="webinar-attendees">🎥 Webinar Attendees</option>
              <option value="cold-leads">❄️ Cold Leads</option>
            </select>
          </div>

          {hasSearched && (
            <span className="text-sm text-gray-600">
              Found {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Results Info */}
      {hasSearched && !loading && !error && contacts.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-900">
            ✅ Search complete. Showing {contacts.length} matching contact{contacts.length !== 1 ? 's' : ''}. Click any row to view details, add notes, or update information.
          </p>
        </div>
      )}

      {/* No Search Yet */}
      {!hasSearched && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-900 font-medium">
            👆 Enter search criteria above to find contacts
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Search by Last Name, Email, or Organization to view and manage contact details
          </p>
        </div>
      )}

      {/* Contact List */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {hasSearched && contacts.length > 0 && (() => {
        const hideUnused = true; // Remove pagination for now
        if (hideUnused) return null;
          const totalPages = Math.ceil(summary.totalContacts / 1000);
          const currentPage = page + 1;
          
          // Calculate page range to show
          let startPage = Math.max(1, currentPage - 2);
          let endPage = Math.min(totalPages, currentPage + 2);
          
          // Adjust if we're at the beginning or end
          if (currentPage <= 3) {
            endPage = Math.min(7, totalPages);
          } else if (currentPage >= totalPages - 2) {
            startPage = Math.max(1, totalPages - 6);
          }
          
          const pageNumbers = [];
          for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
          }
          
          return (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
              {/* Page numbers */}
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {/* First page */}
                {startPage > 1 && (
                  <>
                    <button
                      onClick={() => setPage(0)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      1
                    </button>
                    {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                  </>
                )}
                
                {/* Page number buttons */}
                {pageNumbers.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum - 1)}
                    className={`px-3 py-1 text-sm rounded ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                
                {/* Last page */}
                {endPage < totalPages && (
                  <>
                    {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              {/* Previous/Next buttons */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} • Showing contacts {(page * 1000) + 1}-{Math.min((page + 1) * 1000, summary.totalContacts)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * 1000 >= summary.totalContacts}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Table display */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Contact
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    <button
                      onClick={() => handleSort('organization')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Organization
                      {sortField === 'organization' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    <button
                      onClick={() => handleSort('leadStatus')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Lead Status
                      {sortField === 'leadStatus' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    <button
                      onClick={() => handleSort('webinarsAttended')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Activity
                      {sortField === 'webinarsAttended' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact Info</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedContacts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  sortedContacts.map((contact) => (
                    <tr
                      key={contact.email}
                      onClick={() => setSelectedContact(contact)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">{contact.name}</div>
                          <div className="text-sm text-gray-600">{contact.email}</div>
                          {contact.jobTitle && (
                            <div className="text-xs text-gray-500 mt-1">{contact.jobTitle}</div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {contact.organization || '—'}
                        {contact.organizationType && (
                          <div className="text-xs text-gray-500 mt-1">{contact.organizationType}</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {contact.city && contact.state ? `${contact.city}, ${contact.state}` : 
                         contact.state || contact.city || '—'}
                        {contact.country && (
                          <div className="text-xs text-gray-500 mt-1">{contact.country}</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getLeadStatusBadge(contact.leadStatus)}`}>
                            {getLeadStatusIcon(contact.leadStatus)} {contact.leadStatus}
                          </span>
                          {contact.surveyContact === 'Yes' && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium" title="Survey: Contact me">
                              📋 Survey
                            </span>
                          )}
                        </div>
                        {contact.leadScore > 0 && (
                          <div className="text-xs text-gray-500 mt-1">Score: {contact.leadScore}/100</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-sm">
                        <div className="space-y-1">
                          {contact.webinarsAttendedCount > 0 && (
                            <div className="text-purple-700">
                              🎥 {contact.webinarsAttendedCount} webinar{contact.webinarsAttendedCount > 1 ? 's' : ''}
                            </div>
                          )}
                          {contact.notesCount > 0 && (
                            <div className="text-blue-700">
                              📝 {contact.notesCount} note{contact.notesCount > 1 ? 's' : ''}
                            </div>
                          )}
                          {contact.pendingTasks > 0 && (
                            <div className="text-orange-700 font-semibold">
                              ⏰ {contact.pendingTasks} pending task{contact.pendingTasks > 1 ? 's' : ''}
                            </div>
                          )}
                          {contact.webinarsAttendedCount === 0 && contact.notesCount === 0 && contact.pendingTasks === 0 && (
                            <div className="text-gray-400">No activity</div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {contact.phoneMobile && (
                          <div>📱 {contact.phoneMobile}</div>
                        )}
                        {contact.phoneOffice && (
                          <div>📞 {contact.phoneOffice}</div>
                        )}
                        {contact.linkedin && (
                          <div className="text-blue-600">
                            <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              in/ LinkedIn
                            </a>
                          </div>
                        )}
                        {!contact.phoneMobile && !contact.phoneOffice && !contact.linkedin && '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      }

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={loadSummary}
        />
      )}

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="text-purple-600" size={28} />
                <h2 className="text-2xl font-bold text-gray-900">Create New Contact</h2>
              </div>
              <button
                onClick={() => {
                  setShowNewContactModal(false);
                  setNewContact({ email: '', firstName: '', lastName: '', organization: '', phone: '', jobTitle: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newContact.jobTitle}
                    onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
                    placeholder="e.g., HR Director"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    placeholder="First name"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    placeholder="Last name"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Organization</label>
                  <input
                    type="text"
                    value={newContact.organization}
                    onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                    placeholder="Organization name"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Contact will be added to Brevo's DATABASE MASTER list (ID 108)
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewContactModal(false);
                  setNewContact({ email: '', firstName: '', lastName: '', organization: '', phone: '', jobTitle: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateContact}
                className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
              >
                Create Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all z-50 group"
          aria-label="Back to top"
        >
          <ChevronUp size={24} className="group-hover:scale-110 transition-transform" />
          <span className="absolute bottom-full mb-2 right-0 bg-gray-900 text-white text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Back to Top
          </span>
        </button>
      )}
    </div>
  );
};

export default ContactCRM;

