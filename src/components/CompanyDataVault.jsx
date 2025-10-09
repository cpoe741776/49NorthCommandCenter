// CompanyDataVault.jsx //

import React, { useState, useEffect } from 'react';
import { Copy, Check, FileText, Building, MapPin, Phone, CreditCard, Tag, Users, Award } from 'lucide-react';

const CompanyDataVault = () => {

  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
  try {
    setLoading(true);
    const response = await fetch('/.netlify/functions/getCompanyData');
    const result = await response.json();
    
    if (result.success) {
      setGroupedData(result.grouped);  // Keep only this line
    } else {
      setError(result.error);
    }
  } catch (err) {
    setError('Failed to load company data');
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  const copyToClipboard = async (text, fieldId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyCategoryBlock = async (category) => {
    const categoryData = groupedData[category] || [];
    const text = categoryData
      .map(item => `${item.fieldName}: ${item.fieldValue}`)
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(`category-${category}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Company Info': Building,
      'Tax IDs': CreditCard,
      'Addresses': MapPin,
      'Contact Info': Phone,
      'Banking': CreditCard,
      'Classifications': Tag,
      'Business Info': Award,
      'Personnel': Users,
      'Programs': FileText,
      'Specializations': FileText,
      'Past Performance': Award,
      'Company Descriptions': FileText
    };
    const Icon = icons[category] || FileText;
    return <Icon size={20} className="text-blue-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading company data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button onClick={loadCompanyData} className="mt-2 text-red-600 hover:text-red-800">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Data Vault</h1>
        <p className="text-gray-600 mt-1">Quick access to all company information for bid registrations</p>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click any field to copy it to your clipboard. Use the "Copy All" button to copy entire sections.
        </p>
      </div>

      {/* Data by Category */}
      <div className="space-y-4">
        {Object.keys(groupedData).sort().map(category => (
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Category Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getCategoryIcon(category)}
                <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                <span className="text-sm text-gray-500">
                  ({groupedData[category].length} fields)
                </span>
              </div>
              <button
                onClick={() => copyCategoryBlock(category)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                {copiedField === `category-${category}` ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy All
                  </>
                )}
              </button>
            </div>

            {/* Category Items */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedData[category].map(item => (
                  <div
                    key={item.id}
                    onClick={() => copyToClipboard(item.fieldValue, item.fieldId)}
                    className="group border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-600 mb-1">
                          {item.fieldName}
                        </p>
                        <p className="text-base text-gray-900 font-mono break-words">
                          {item.fieldValue || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                        {item.alternateValue && (
                          <p className="text-sm text-gray-600 mt-1">
                            Alt: {item.alternateValue}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-2">{item.notes}</p>
                        )}
                      </div>
                      <div className="ml-3">
                        {copiedField === item.fieldId ? (
                          <Check size={18} className="text-green-600" />
                        ) : (
                          <Copy size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Company Descriptions Section - Special Formatting */}
      {groupedData['Company Descriptions'] && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="text-blue-600" />
            Ready-to-Use Company Descriptions
          </h2>
          <div className="space-y-4">
            {groupedData['Company Descriptions'].map(item => (
              <div key={item.id} className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{item.fieldName}</h3>
                  <button
                    onClick={() => copyToClipboard(item.fieldValue, item.fieldId)}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    {copiedField === item.fieldId ? (
                      <>
                        <Check size={14} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.fieldValue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDataVault;