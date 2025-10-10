import React, { useState } from 'react';
import { X, ExternalLink, Globe, Key, Eye, EyeOff, Calendar, DollarSign, Mail, CheckCircle, Clock, AlertCircle, Tag, Hash, Shield } from 'lucide-react';

const BidSystemDetailModal = ({ system, onClose }) => {
  const [showPassword, setShowPassword] = useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active':
        return <CheckCircle className="text-green-600" size={24} />;
      case 'Pending Registration':
        return <Clock className="text-yellow-600" size={24} />;
      case 'Access Issues':
        return <AlertCircle className="text-red-600" size={24} />;
      default:
        return <Clock className="text-gray-600" size={24} />;
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

  const DetailRow = ({ icon: Icon, label, value, isPassword = false }) => {
    if (!value || (value === '$0' && label === 'Annual Cost')) return null;
    
    return (
      <div className="py-3 border-b border-gray-200 last:border-0">
        <div className="flex items-start gap-3">
          {Icon && <Icon className="text-gray-500 mt-0.5" size={18} />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</p>
            {isPassword ? (
              <div className="flex items-center gap-2">
                <p className="text-base text-gray-900 font-mono">
                  {showPassword ? value : '••••••••••••'}
                </p>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={16} className="text-gray-600" />
                  ) : (
                    <Eye size={16} className="text-gray-600" />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-base text-gray-900 break-words">{value}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(system.status)}
                <h2 className="text-2xl font-bold text-gray-900">{system.systemName}</h2>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(system.status)}`}>
                  {system.status}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {system.category}
                </span>
                {system.systemId && (
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                    ID: {system.systemId}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors ml-4"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Quick Actions */}
          <div className="mb-6 flex gap-3">
            {system.loginUrl && (
              
                <a href={system.loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                <ExternalLink size={20} />
                Open Login Page
              </a>
            )}
            {system.websiteUrl && !system.loginUrl && (
              
                <a href={system.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
              >
                <Globe size={20} />
                Visit Website
              </a>
            )}
            {system.websiteUrl && system.loginUrl && (
              
                <a href={system.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Globe size={18} />
                Website
              </a>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Tag size={18} />
                  System Information
                </h3>
                <div className="space-y-0">
                  <DetailRow label="System Name" value={system.systemName} />
                  <DetailRow label="Geographic Coverage" value={system.geographicCoverage} />
                  <DetailRow label="Category" value={system.category} />
                  <DetailRow label="Status" value={system.status} />
                </div>
              </div>

              {/* Commodity Codes */}
              {(system.codeType || system.codeNumbers) && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Hash size={18} className="text-indigo-600" />
                    Commodity Codes
                  </h3>
                  <div className="space-y-0">
                    {system.codeType && (
                      <DetailRow label="Code Type" value={system.codeType} />
                    )}
                    {system.codeNumbers && (
                      <DetailRow label="Code Numbers" value={system.codeNumbers} />
                    )}
                  </div>
                  <p className="text-xs text-indigo-700 mt-3 bg-indigo-100 rounded p-2">
                    These codes are monitored for relevant opportunities
                  </p>
                </div>
              )}

              {/* Credentials */}
              {(system.username || system.password) && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Key size={18} className="text-blue-600" />
                    Login Credentials
                  </h3>
                  <div className="space-y-0">
                    {system.username && (
                      <DetailRow icon={null} label="Username" value={system.username} />
                    )}
                    {system.password && (
                      <DetailRow icon={null} label="Password" value={system.password} isPassword={true} />
                    )}
                  </div>
                </div>
              )}

              {/* Email Alerts */}
              <div className={`rounded-lg p-4 border ${system.emailAlertsEnabled === 'Yes' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Mail size={18} className={system.emailAlertsEnabled === 'Yes' ? 'text-green-600' : 'text-gray-600'} />
                  Email Alerts
                </h3>
                <div className="space-y-0">
                  <DetailRow icon={null} label="Alerts Enabled" value={system.emailAlertsEnabled || 'No'} />
                  {system.alertEmailAddress && (
                    <DetailRow icon={null} label="Alert Email" value={system.alertEmailAddress} />
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* URLs */}
              {(system.websiteUrl || system.loginUrl) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Globe size={18} />
                    Links
                  </h3>
                  <div className="space-y-3">
                    {system.websiteUrl && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Website URL</p>
                        
                          <a href={system.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm break-all"
                        >
                          {system.websiteUrl}
                        </a>
                      </div>
                    )}
                    {system.loginUrl && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Login URL</p>
                        
                          <a href={system.loginUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm break-all"
                        >
                          {system.loginUrl}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Important Dates */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar size={18} />
                  Important Dates
                </h3>
                <div className="space-y-0">
                  {system.registrationDate && (
                    <DetailRow icon={null} label="Registration Date" value={system.registrationDate} />
                  )}
                  {system.lastLoginDate && (
                    <DetailRow icon={null} label="Last Login" value={system.lastLoginDate} />
                  )}
                  {system.renewalDate && (
                    <DetailRow icon={null} label="Renewal Date" value={system.renewalDate} />
                  )}
                  {system.dateAdded && (
                    <DetailRow icon={null} label="Date Added to System" value={system.dateAdded} />
                  )}
                  {system.lastUpdated && (
                    <DetailRow icon={null} label="Last Updated" value={system.lastUpdated} />
                  )}
                </div>
                {!system.registrationDate && !system.lastLoginDate && !system.renewalDate && (
                  <p className="text-sm text-gray-500 italic">No dates recorded</p>
                )}
              </div>

              {/* Subscription Details */}
              <div className={`rounded-lg p-4 border ${system.subscriptionType && system.subscriptionType !== 'Free' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign size={18} className={system.subscriptionType && system.subscriptionType !== 'Free' ? 'text-purple-600' : 'text-gray-600'} />
                  Subscription Details
                </h3>
                <div className="space-y-0">
                  <DetailRow icon={null} label="Subscription Type" value={system.subscriptionType || 'Free'} />
                  {system.annualCost && system.annualCost !== '$0' && (
                    <DetailRow icon={null} label="Annual Cost" value={system.annualCost} />
                  )}
                  {(!system.annualCost || system.annualCost === '$0') && (
                    <div className="py-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Annual Cost</p>
                      <p className="text-base text-gray-900">Free / $0</p>
                    </div>
                  )}
                </div>
              </div>

              {/* System ID Card */}
              {system.systemId && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield size={18} className="text-blue-600" />
                    System Identifier
                  </h3>
                  <div className="bg-white rounded p-3 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">System ID</p>
                    <p className="text-2xl font-bold text-blue-600 font-mono">{system.systemId}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section - Full Width */}
          {system.notes && (
            <div className="mt-6 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Tag size={18} className="text-yellow-600" />
                Notes & Additional Information
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{system.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors font-semibold"
            >
              Close
            </button>
            {system.loginUrl && (
              
                <a href={system.loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                <ExternalLink size={18} />
                Open Login
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidSystemDetailModal;