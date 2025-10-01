import React, { useState } from 'react';
import { Menu, X, FileText, Video, Share2, LayoutDashboard, ChevronDown, ChevronRight, ExternalLink, Archive } from 'lucide-react';

// Mock data for bids
const mockBids = [
  {
    id: 1,
    recommendation: "Respond",
    reasoning: "Strong alignment with peer support and mental health training for law enforcement. Keywords: peer support, CISM, mental health training.",
    emailSummary: "RFP for Mental Health First Aid training program for county sheriff's department",
    emailDateReceived: "2025-09-15",
    emailFrom: "procurement@county.gov",
    keywordsCategory: "Peer Support, Mental Health, Training",
    keywordsFound: "mental health, peer support, CISM, training program, law enforcement",
    relevance: "High",
    emailSubject: "RFP-2025-089: Mental Health Training Services",
    emailBody: "The County Sheriff's Office seeks qualified vendors to provide comprehensive mental health first aid training...",
    url: "https://county.gov/bids/rfp-2025-089",
    dueDate: "2025-10-15",
    significantSnippet: "Must include peer support training and CISM certification components",
    emailDomain: "county.gov"
  },
  {
    id: 2,
    recommendation: "Gather More Information",
    reasoning: "Mentions wellness and resilience but lacks specifics about training type. May be general HR wellness rather than performance-based resilience.",
    emailSummary: "Request for wellness program proposals for city employees",
    emailDateReceived: "2025-09-18",
    emailFrom: "hr@citymail.org",
    keywordsCategory: "Wellbeing, Resilience",
    keywordsFound: "wellness, resilience, employee wellbeing, stress management",
    relevance: "Medium",
    emailSubject: "RFQ: Employee Wellness Program Development",
    emailBody: "The City is seeking proposals for a comprehensive employee wellness program focusing on resilience and stress management...",
    url: "https://citymail.org/procurement/rfq-wellness",
    dueDate: "2025-10-20",
    significantSnippet: "Program should address mental health, physical wellness, and resilience building",
    emailDomain: "citymail.org"
  },
  {
    id: 3,
    recommendation: "Respond",
    reasoning: "Perfect fit: trauma-informed training for EMS and fire personnel. Multiple keyword matches in Mental Health and Training categories.",
    emailSummary: "Solicitation for trauma-informed care training for first responders",
    emailDateReceived: "2025-09-10",
    emailFrom: "contracts@statefire.gov",
    keywordsCategory: "Mental Health, Training, Peer Support",
    keywordsFound: "trauma-informed, first responder support, EMS, psychological safety, training delivery",
    relevance: "High",
    emailSubject: "ITB-2025-334: Trauma-Informed Care Training",
    emailBody: "State Fire Marshal's office requests bids for trauma-informed care training curriculum for EMS and fire personnel...",
    url: "https://statefire.gov/bids/itb-334",
    dueDate: "2025-10-08",
    significantSnippet: "Must include psychological first aid and peer support components",
    emailDomain: "statefire.gov"
  }
];

const mockDisregarded = [
  {
    id: 101,
    recommendation: "Disregard",
    reasoning: "General office supplies procurement - no relevance to resilience training or mental health services.",
    emailSubject: "RFP: Office Furniture and Supplies",
    emailDateReceived: "2025-09-12",
    emailFrom: "purchasing@admin.gov"
  }
];

// Navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bids', label: 'Bid Operations', icon: FileText },
  { id: 'webinars', label: 'Webinar Operations', icon: Video },
  { id: 'social', label: 'Social Media', icon: Share2 }
];

// BidCard Component
const BidCard = ({ bid, onStatusChange }) => {
  const [expanded, setExpanded] = useState(false);
  const isRespond = bid.recommendation === "Respond";
  
  return (
    <div className={`border-l-4 ${isRespond ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'} p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow`}>
      <div 
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${isRespond ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>
              {bid.recommendation}
            </span>
            <span className="text-xs text-gray-500">{bid.emailDateReceived}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{bid.emailSubject}</h3>
          <p className="text-sm text-gray-600 mt-1">{bid.emailSummary}</p>
        </div>
        <button className="ml-4 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">AI Reasoning:</label>
            <p className="text-sm text-gray-700 mt-1">{bid.reasoning}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">From:</label>
              <p className="text-sm text-gray-700">{bid.emailFrom}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Due Date:</label>
              <p className="text-sm text-gray-700">{bid.dueDate}</p>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Keywords Found:</label>
            <p className="text-sm text-gray-700">{bid.keywordsFound}</p>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Categories:</label>
            <p className="text-sm text-gray-700">{bid.keywordsCategory}</p>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Significant Snippet:</label>
            <p className="text-sm text-gray-700 italic">"{bid.significantSnippet}"</p>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Original Source:</label>
            <a 
              href={bid.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {bid.url} <ExternalLink size={14} />
            </a>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => onStatusChange(bid.id, 'submitted')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Mark as Submitted
            </button>
            <button 
              onClick={() => onStatusChange(bid.id, 'disregard')}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm font-medium"
            >
              Disregard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const respondCount = mockBids.filter(b => b.recommendation === "Respond").length;
  const gatherInfoCount = mockBids.filter(b => b.recommendation === "Gather More Information").length;
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
        <p className="text-gray-600 mt-1">49 North Business Operations Dashboard</p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Bids</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{mockBids.length}</p>
            </div>
            <FileText className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm">
            <span className="text-green-600 font-semibold">{respondCount} Respond</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-yellow-600 font-semibold">{gatherInfoCount} Need Info</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Webinars</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">5</p>
            </div>
            <Video className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Next: Oct 5, 2025
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Social Posts Scheduled</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">12</p>
            </div>
            <Share2 className="text-blue-600" size={40} />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            This week: 4 posts
          </div>
        </div>
      </div>
      
      {/* Quick Access */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors">
            <h3 className="font-semibold text-gray-900">Review High-Priority Bids</h3>
            <p className="text-sm text-gray-600 mt-1">{respondCount} bids marked as "Respond" awaiting review</p>
          </div>
          <div className="border border-gray-200 rounded p-4 hover:border-blue-600 cursor-pointer transition-colors">
            <h3 className="font-semibold text-gray-900">Check Webinar Registrations</h3>
            <p className="text-sm text-gray-600 mt-1">3 webinars with registration deadlines this week</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Bid Operations Component
const BidOperations = () => {
  const [bids, setBids] = useState(mockBids);
  const [showArchive, setShowArchive] = useState(false);
  
  const handleStatusChange = (bidId, status) => {
    setBids(bids.filter(b => b.id !== bidId));
    alert(`Bid ${bidId} marked as ${status}`);
  };
  
  const respondBids = bids.filter(b => b.recommendation === "Respond");
  const gatherInfoBids = bids.filter(b => b.recommendation === "Gather More Information");
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bid Operations</h1>
          <p className="text-gray-600 mt-1">Active RFPs and Proposals</p>
        </div>
        <button 
          onClick={() => setShowArchive(!showArchive)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          <Archive size={18} />
          {showArchive ? 'Hide Archive' : 'View Archive'}
        </button>
      </div>
      
      {showArchive && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Disregarded Bids</h2>
          <div className="space-y-2">
            {mockDisregarded.map(bid => (
              <div key={bid.id} className="bg-white p-4 rounded border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{bid.emailSubject}</h3>
                    <p className="text-sm text-gray-600 mt-1">{bid.reasoning}</p>
                    <p className="text-xs text-gray-500 mt-2">From: {bid.emailFrom} • {bid.emailDateReceived}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Respond Column */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Respond ({respondBids.length})</h2>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="space-y-3">
            {respondBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No high-priority bids at this time</p>
            ) : (
              respondBids.map(bid => (
                <BidCard key={bid.id} bid={bid} onStatusChange={handleStatusChange} />
              ))
            )}
          </div>
        </div>
        
        {/* Gather More Information Column */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Gather More Information ({gatherInfoBids.length})</h2>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </div>
          <div className="space-y-3">
            {gatherInfoBids.length === 0 ? (
              <p className="text-gray-500 text-sm">No bids need additional information</p>
            ) : (
              gatherInfoBids.map(bid => (
                <BidCard key={bid.id} bid={bid} onStatusChange={handleStatusChange} />
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Proposal Workspace Placeholder */}
      <div className="bg-white p-6 rounded-lg shadow border-2 border-dashed border-gray-300">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Proposal Workspace</h2>
        <p className="text-gray-600">Document library, templates, and proposal writing tools coming soon...</p>
      </div>
    </div>
  );
};

// Placeholder Components
const WebinarOperations = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Webinar Operations</h1>
    <div className="bg-white p-12 rounded-lg shadow text-center">
      <Video className="mx-auto text-gray-300 mb-4" size={64} />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
      <p className="text-gray-600">Webinar scheduling, registration tracking, survey analysis, and marketing tools</p>
    </div>
  </div>
);

const SocialMediaOperations = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Social Media Operations</h1>
    <div className="bg-white p-12 rounded-lg shadow text-center">
      <Share2 className="mx-auto text-gray-300 mb-4" size={64} />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
      <p className="text-gray-600">Content calendar, post composer, asset library, and performance analytics</p>
    </div>
  </div>
);

// Main App Component
const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'bids': return <BidOperations />;
      case 'webinars': return <WebinarOperations />;
      case 'social': return <SocialMediaOperations />;
      default: return <Dashboard />;
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`bg-[#003049] text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-lg">49 North</h1>
              <p className="text-xs text-blue-200">Command Center</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-blue-800 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded transition-colors ${
                  currentPage === item.id 
                    ? 'bg-blue-700 text-white' 
                    : 'text-blue-100 hover:bg-blue-800'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {renderPage()}
        </div>
        
        {/* News Ticker */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#003049] text-white py-2 px-4 text-sm">
          <div className="flex items-center gap-8 overflow-hidden">
            <span className="font-semibold">Latest Updates:</span>
            <div className="flex gap-8 animate-marquee">
              <span>• New RFP from County Sheriff - Mental Health Training (Due Oct 15)</span>
              <span>• Webinar "Resilience for First Responders" - 42 registrations</span>
              <span>• Social post scheduled for Oct 3 - Peer Support Awareness</span>
              <span>• Bid response submitted - State Fire Marshal Trauma Training</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;