// CompanyDataVault.jsx //

import React, { useState, useEffect } from 'react';
import { Copy, Check, FileText, Building, MapPin, Phone, CreditCard, Tag, Users, Award, Package, ChevronDown, ChevronUp, Upload, Download, File } from 'lucide-react';

const CompanyDataVault = () => {
  const [groupedData, setGroupedData] = useState({});
  const [commodityCodes, setCommodityCodes] = useState({});
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [expandedCodeTypes, setExpandedCodeTypes] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Tax Documents');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      const companyResponse = await fetch('/.netlify/functions/getCompanyData');
      const companyResult = await companyResponse.json();
      
      const codesResponse = await fetch('/.netlify/functions/getCommodityCodes');
      const codesResult = await codesResponse.json();
      
      const docsResponse = await fetch('/.netlify/functions/getCompanyDocuments');
      const docsResult = await docsResponse.json();
      
      if (companyResult.success) {
        setGroupedData(companyResult.grouped);
      }
      
      if (codesResult.success) {
        setCommodityCodes(codesResult.grouped);
      }
      
      if (docsResult.success) {
        setDocuments(docsResult.grouped);
      }
      
      if (!companyResult.success || !codesResult.success) {
        setError(companyResult.error || codesResult.error);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];

        const response = await fetch('/.netlify/functions/uploadDocument', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileData: base64Data,
            category: uploadCategory,
            notes: ''
          })
        });

        const result = await response.json();

        if (result.success) {
          alert('Document uploaded successfully!');
          loadAllData();
        } else {
          alert('Upload failed: ' + result.error);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
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

  const copyAllCodesOfType = async (codeType) => {
    const codes = commodityCodes[codeType] || [];
    const activeOnly = codes.filter(c => c.active === 'Yes');
    const codeNumbers = activeOnly.map(c => c.codeNumber).join(', ');
    
    try {
      await navigator.clipboard.writeText(codeNumbers);
      setCopiedField(`codes-${codeType}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyCodeWithDescription = async (code) => {
    const text = `${code.codeNumber} - ${code.description}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(`code-${code.id}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleCodeType = (codeType) => {
    setExpandedCodeTypes(prev => ({
      ...prev,
      [codeType]: !prev[codeType]
    }));
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

  const getCodeTypeColor = (codeType) => {
    const colors = {
      'NAICS': 'bg-blue-100 text-blue-800 border-blue-300',
      'NIGP': 'bg-green-100 text-green-800 border-green-300',
      'PSC': 'bg-purple-100 text-purple-800 border-purple-300',
      'UNSPSC': 'bg-orange-100 text-orange-800 border-orange-300',
      'CPV': 'bg-pink-100 text-pink-800 border-pink-300',
      'SIC': 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[codeType] || 'bg-gray-100 text-gray-800 border-gray-300';
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
        <button onClick={loadAllData} className="mt-2 text-red-600 hover:text-red-800">
          Try Again
        </button>
      </div>
    );
  }

  const codeTypeOrder = ['NAICS', 'NIGP', 'PSC', 'UNSPSC', 'CPV', 'SIC'];
  const sortedCodeTypes = Object.keys(commodityCodes).sort((a, b) => {
    const aIndex = codeTypeOrder.indexOf(a);
    const bIndex = codeTypeOrder.indexOf(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

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

      {/* Documents Section - ALWAYS SHOW */}
<div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 border-2 border-purple-200">
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <File className="text-purple-600" size={28} />
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Company Documents</h2>
        <p className="text-sm text-gray-600">Store and access important company files</p>
      </div>
    </div>

    {/* Upload Button */}
    <div className="flex items-center gap-3">
      <select
        value={uploadCategory}
        onChange={(e) => setUploadCategory(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        <option>Tax Documents</option>
        <option>Certifications</option>
        <option>Insurance</option>
        <option>Contracts</option>
        <option>Licenses</option>
        <option>Other</option>
      </select>
      <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer">
        <Upload size={18} />
        {uploading ? 'Uploading...' : 'Upload Document'}
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  </div>

  {/* Documents by Category OR Empty State */}
  {Object.keys(documents).length > 0 ? (
    <div className="space-y-4">
      {Object.keys(documents).sort().map(category => (
        <div key={category} className="bg-white rounded-lg border border-purple-200 overflow-hidden">
          <div className="bg-purple-50 px-4 py-3 border-b border-purple-200">
            <h3 className="font-semibold text-gray-900">{category}</h3>
            <p className="text-xs text-gray-600">{documents[category].length} document{documents[category].length !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {documents[category].map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-purple-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <File size={20} className="text-purple-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{doc.documentName}</p>
                      <p className="text-xs text-gray-500">
                        {doc.fileType} • {doc.fileSize} • Uploaded {doc.uploadDate}
                      </p>
                      {doc.notes && (
                        <p className="text-xs text-gray-600 italic mt-1">{doc.notes}</p>
                      )}
                    </div>
                  </div>
                  
                    <a href={doc.driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="bg-white rounded-lg border-2 border-dashed border-purple-300 p-8 text-center">
      <File size={48} className="text-purple-300 mx-auto mb-4" />
      <p className="text-gray-600 mb-2">No documents yet</p>
      <p className="text-sm text-gray-500">
        Upload your first document using the button above, or add documents manually to the CompanyDocuments sheet
      </p>
    </div>
  )}
</div>

      {/* Company Data by Category */}
      <div className="space-y-4">
        {Object.keys(groupedData)
          .filter(cat => cat !== 'Classifications' && cat !== 'Company Descriptions')
          .sort()
          .map(category => (
            <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
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

      {/* Classifications Section - MOVED TO BOTTOM */}
      {Object.keys(commodityCodes).length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-lg p-6 border-2 border-indigo-200">
          <div className="flex items-center gap-3 mb-6">
            <Package className="text-indigo-600" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Commodity & Classification Codes</h2>
              <p className="text-sm text-gray-600">Copy codes by type for bid system registrations</p>
            </div>
          </div>

          <div className="space-y-3">
            {sortedCodeTypes.map(codeType => {
              const codes = commodityCodes[codeType] || [];
              const activeCodes = codes.filter(c => c.active === 'Yes');
              const isExpanded = expandedCodeTypes[codeType];
              const primaryCode = codes.find(c => c.priority === 'Primary');

              return (
                <div key={codeType} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleCodeType(codeType)}
                          className="flex items-center gap-2 hover:bg-gray-100 rounded p-1 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getCodeTypeColor(codeType)}`}>
                              {codeType}
                            </span>
                            <span className="text-sm text-gray-600">
                              {activeCodes.length} active code{activeCodes.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {primaryCode && (
                            <p className="text-xs text-gray-500 mt-1 ml-1">
                              Primary: {primaryCode.codeNumber} - {primaryCode.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => copyAllCodesOfType(codeType)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        {copiedField === `codes-${codeType}` ? (
                          <>
                            <Check size={16} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copy All Codes
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-2">
                        {activeCodes.map(code => (
                          <div
                            key={code.id}
                            onClick={() => copyCodeWithDescription(code)}
                            className="group flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono font-bold text-indigo-700">
                                  {code.codeNumber}
                                </span>
                                {code.priority === 'Primary' && (
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-300">
                                    PRIMARY
                                  </span>
                                )}
                                {code.category && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    {code.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700">{code.description}</p>
                              {code.notes && (
                                <p className="text-xs text-gray-500 mt-1 italic">{code.notes}</p>
                              )}
                            </div>
                            <div className="ml-3">
                              {copiedField === `code-${code.id}` ? (
                                <Check size={18} className="text-green-600" />
                              ) : (
                                <Copy size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Copy Summary */}
          <div className="mt-6 p-4 bg-white rounded-lg border border-indigo-200">
            <p className="text-sm text-gray-700 mb-3 font-semibold">Quick Copy Summary:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {sortedCodeTypes.map(codeType => {
                const activeCodes = (commodityCodes[codeType] || []).filter(c => c.active === 'Yes');
                return (
                  <button
                    key={codeType}
                    onClick={() => copyAllCodesOfType(codeType)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 hover:scale-105 transition-transform ${getCodeTypeColor(codeType)}`}
                  >
                    {codeType} ({activeCodes.length})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Company Descriptions Section - MOVED TO VERY BOTTOM */}
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