import React, { useState } from 'react';
import { X, ExternalLink, Globe, Key, Eye, EyeOff, Calendar, DollarSign, Mail, CheckCircle, Clock, AlertCircle, Tag } from 'lucide-react';

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
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(system.status)}
                <h2 className="text-2xl font-bold text-gray-900">{system.systemName}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(system.status)}`}>
                  {system.status}
                </span>
                <span className="text-sm text-gray-600">{system.category}</span>
                {system.systemId && (
                  <span className="text-xs text-gray-500 font-mono">ID: {system.systemId}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink size={18} />
                Open Login Page
              </a>
            )}
            {system.websiteUrl && !system.loginUrl && (
              
                <a href={system.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Globe size={18} />
                Visit Website
              </a>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Tag size={18} />
                  System Information
                </h3>
                <div className="space-y-0">
                  <DetailRow label="Geographic Coverage" value={system.geographicCoverage} />
                  <DetailRow label="Category" value={system.category} />
                  {system.codeType && (
                    <DetailRow label="Code Type" value={system.codeType} />
                  )}
                  {system.codeNumbers && (
                    <DetailRow label="Code Numbers" value={system.codeNumbers} />
                  )}
                </div>
              </div>

              {/* Credentials */}
              {(system.username || system.password) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Key size={18} />
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
              {system.emailAlertsEnabled === 'Yes' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Mail size={18} />
                    Email Alerts
                  </h3>
                  <div className="space-y-0">
                    <DetailRow icon={null} label="Alerts Enabled" value={system.emailAlertsEnabled} />
                    {system.alertEmailAddress && (
                      <DetailRow icon={null} label="Alert Email" value={system.alertEmailAddress} />
                    )}
                  </div>
                </div>
              )}
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
                  <div className="space-y-0">
                    {system.websiteUrl && (
                      <div className="py-3 border-b border-gray-200 last:border-0">
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
                      <div className="py-3">
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

              {/* Dates */}
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
              </div>

              {/* Subscription */}
              {system.subscriptionType && system.subscriptionType !== 'Free' && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign size={18} />
                    Subscription
                  </h3>
                  <div className="space-y-0">
                    <DetailRow icon={null} label="Type" value={system.subscriptionType} />
                    {system.annualCost && system.annualCost !== '$0' && (
                      <DetailRow icon={null} label="Annual Cost" value={system.annualCost} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section - Full Width */}
          {system.notes && (
            <div className="mt-6 bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{system.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BidSystemDetailModal;