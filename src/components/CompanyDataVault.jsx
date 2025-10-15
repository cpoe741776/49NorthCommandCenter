// src/components/CompanyDataVault.jsx
import React, { useEffect, useState } from 'react';
import { Copy, Check, FileText, Building, MapPin, Phone, CreditCard, Tag, Users, Award, Package, ChevronDown, ChevronUp, Upload, Download, File, Trash2 } from 'lucide-react';

const LoadingSpinner = ({ size = 16 }) => (
  <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

const CompanyDataVault = () => {
  const [groupedData, setGroupedData] = useState({});
  const [commodityCodes, setCommodityCodes] = useState({});
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Tax Documents');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { loadAll(); }, []);
  const loadAll = async () => {
    try {
      setLoading(true);
      const [companyRes, codesRes, docsRes] = await Promise.all([
        fetch('/.netlify/functions/getCompanyData'),
        fetch('/.netlify/functions/getCommodityCodes'),
        fetch('/.netlify/functions/getCompanyDocuments'),
      ]);
      const [company, codes, docs] = await Promise.all([companyRes.json(), codesRes.json(), docsRes.json()]);
      if (company.success) setGroupedData(company.grouped);
      if (codes.success) setCommodityCodes(codes.grouped);
      if (docs.success) setDocuments(docs.grouped);
      if (!company.success || !codes.success) setError(company.error || codes.error || 'Failed to load data');
      else setError(null);
    } catch (e) {
      console.error(e);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text, id) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch {}
  };
  const copyCategory = (category) => copy((groupedData[category]||[]).map(i => `${i.fieldName}: ${i.fieldValue}`).join('\n'), `cat-${category}`);
  const copyAllCodesOf = (type) => copy((commodityCodes[type]||[]).filter(c=>c.active==='Yes').map(c=>c.codeNumber).join(', '), `codes-${type}`);
  const copyCodeWithDesc = (code) => copy(`${code.codeNumber} - ${code.description}`, `code-${code.id}`);
  const toggle = (type) => setExpanded(p => ({...p, [type]: !p[type]}));

  const iconFor = (category) => {
    const m = { 'Company Info': Building, 'Tax IDs': CreditCard, Addresses: MapPin, 'Contact Info': Phone, Banking: CreditCard, Classifications: Tag, 'Business Info': Award, Personnel: Users, Programs: FileText, Specializations: FileText, 'Past Performance': Award, 'Company Descriptions': FileText };
    const I = m[category] || FileText;
    return <I size={20} className="text-blue-600" />;
  };
  const colorFor = (type) => ({ NAICS:'bg-blue-100 text-blue-800 border-blue-300', NIGP:'bg-green-100 text-green-800 border-green-300', PSC:'bg-purple-100 text-purple-800 border-purple-300', UNSPSC:'bg-orange-100 text-orange-800 border-orange-300', CPV:'bg-pink-100 text-pink-800 border-pink-300', SIC:'bg-gray-100 text-gray-800 border-gray-300' }[type] || 'bg-gray-100 text-gray-800 border-gray-300');

  const codeTypeOrder = ['NAICS','NIGP','PSC','UNSPSC','CPV','SIC'];
  const sortedTypes = Object.keys(commodityCodes).sort((a,b)=> (codeTypeOrder.indexOf(a)===-1)-(codeTypeOrder.indexOf(b)===-1) || codeTypeOrder.indexOf(a)-codeTypeOrder.indexOf(b));

  const handleUpload = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File must be < 10MB'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = String(e.target?.result || '').split(',')[1];
        const res = await fetch('/.netlify/functions/uploadDocument',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ fileName:file.name, fileData:base64, category:uploadCategory, notes:'' }) });
        const out = await res.json();
        if (out.success) { await loadAll(); alert('✅ Document uploaded'); }
        else alert('❌ Upload failed: '+out.error);
      } catch (err) { alert('❌ Upload failed: '+err.message); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const deleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.documentName}" permanently?`)) return;
    setDeleting(doc.id);
    try {
      const res = await fetch('/.netlify/functions/deleteDocument',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ documentId: doc.id, driveFileId: doc.driveFileId }) });
      const out = await res.json();
      if (out.success) { await loadAll(); alert('✅ Document deleted'); }
      else alert('❌ Delete failed: '+out.error);
    } catch (e) { alert('❌ Delete failed: '+e.message); }
    finally { setDeleting(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-600">Loading company data...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">{error}</p><button onClick={loadAll} className="mt-2 text-red-600 hover:text-red-800">Try Again</button></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Data Vault</h1>
        <p className="text-gray-600 mt-1">Quick access to all company information for bid registrations</p>
      </div>

      {/* Documents */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 border-2 border-purple-200 relative">
        {uploading && <div className="absolute top-0 left-0 right-0 h-1 bg-purple-200 rounded-t-lg overflow-hidden"><div className="h-full bg-purple-600 animate-pulse w-full"/></div>}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <File className="text-purple-600" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Company Documents</h2>
              <p className="text-sm text-gray-600">Store and access important company files</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={uploadCategory} onChange={(e)=>setUploadCategory(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={uploading}>
              <option>Tax Documents</option><option>Certifications</option><option>Insurance</option><option>Contracts</option><option>Licenses</option><option>Other</option>
            </select>
            <label className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer ${uploading?'opacity-50 cursor-not-allowed':''}`}>
              {uploading ? <> <LoadingSpinner size={18}/> Uploading... </> : <> <Upload size={18}/> Upload Document </>}
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e)=>handleUpload(e.target.files?.[0])} disabled={uploading} className="hidden"/>
            </label>
          </div>
        </div>

        {Object.keys(documents).length ? (
          <div className="space-y-4">
            {Object.keys(documents).sort().map((category)=>(
              <div key={category} className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                <div className="bg-purple-50 px-4 py-3 border-b border-purple-200">
                  <h3 className="font-semibold text-gray-900">{category}</h3>
                  <p className="text-xs text-gray-600">{documents[category].length} document{documents[category].length!==1?'s':''}</p>
                </div>
                <div className="p-4 space-y-2">
                  {documents[category].map((doc)=>(
                    <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-purple-50">
                      <div className="flex items-center gap-3 flex-1">
                        <File size={20} className="text-purple-600"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{doc.documentName}</p>
                          <p className="text-xs text-gray-500">{doc.fileType} • {doc.fileSize} • Uploaded {doc.uploadDate}</p>
                          {doc.notes && <p className="text-xs text-gray-600 italic mt-1">{doc.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={doc.driveLink} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm ${deleting===doc.id?'opacity-50 pointer-events-none':''}`}>
                          <Download size={16}/> View
                        </a>
                        <button onClick={()=>deleteDoc(doc)} disabled={deleting===doc.id} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50">
                          {deleting===doc.id ? <><LoadingSpinner size={16}/> Deleting...</> : <><Trash2 size={16}/> Delete</>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border-2 border-dashed border-purple-300 p-8 text-center">
            <File size={48} className="text-purple-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No documents yet</p>
            <p className="text-sm text-gray-500">Upload your first document using the button above</p>
          </div>
        )}
      </div>

      {/* Company data by category */}
      <div className="space-y-4">
        {Object.keys(groupedData).filter(c=>c!=='Classifications' && c!=='Company Descriptions').sort().map((category)=>(
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {iconFor(category)}
                <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                <span className="text-sm text-gray-500">({groupedData[category].length} fields)</span>
              </div>
              <button onClick={()=>copyCategory(category)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                {copied===`cat-${category}` ? <><Check size={16}/>Copied!</> : <><Copy size={16}/>Copy All</>}
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedData[category].map((item)=>(
                <div key={item.id} onClick={()=>copy(item.fieldValue, item.fieldId)} className="group border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600 mb-1">{item.fieldName}</p>
                      <p className="text-base text-gray-900 font-mono break-words">{item.fieldValue || <span className="text-gray-400 italic">Not set</span>}</p>
                      {item.alternateValue && <p className="text-sm text-gray-600 mt-1">Alt: {item.alternateValue}</p>}
                      {item.notes && <p className="text-xs text-gray-500 mt-2">{item.notes}</p>}
                    </div>
                    <div className="ml-3">{copied===item.fieldId ? <Check size={18} className="text-green-600"/> : <Copy size={18} className="text-gray-400 group-hover:text-blue-600"/>}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Codes */}
      {!!Object.keys(commodityCodes).length && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-lg p-6 border-2 border-indigo-200">
          <div className="flex items-center gap-3 mb-6">
            <Package className="text-indigo-600" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Commodity & Classification Codes</h2>
              <p className="text-sm text-gray-600">Copy codes by type for registrations</p>
            </div>
          </div>

          <div className="space-y-3">
            {sortedTypes.map((type)=>{
              const codes = commodityCodes[type] || [];
              const active = codes.filter(c=>c.active==='Yes');
              const isOpen = !!expanded[type];
              const primary = codes.find(c=>c.priority==='Primary');
              return (
                <div key={type} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button onClick={()=>toggle(type)} className="hover:bg-gray-100 rounded p-1">{isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${colorFor(type)}`}>{type}</span>
                          <span className="text-sm text-gray-600">{active.length} active</span>
                        </div>
                        {primary && <p className="text-xs text-gray-500 mt-1 ml-1">Primary: {primary.codeNumber} - {primary.description}</p>}
                      </div>
                    </div>
                    <button onClick={()=>copyAllCodesOf(type)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                      {copied===`codes-${type}` ? <><Check size={16}/>Copied!</> : <><Copy size={16}/>Copy All Codes</>}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                      {active.map((code)=>(
                        <div key={code.id} onClick={()=>copyCodeWithDesc(code)} className="group flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-indigo-700">{code.codeNumber}</span>
                              {code.priority==='Primary' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-300">PRIMARY</span>}
                              {code.category && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{code.category}</span>}
                            </div>
                            <p className="text-sm text-gray-700">{code.description}</p>
                            {code.notes && <p className="text-xs text-gray-500 mt-1 italic">{code.notes}</p>}
                          </div>
                          <div className="ml-3">{copied===`code-${code.id}` ? <Check size={18} className="text-green-600"/> : <Copy size={18} className="text-gray-400 group-hover:text-indigo-600"/>}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Company Descriptions */}
      {groupedData['Company Descriptions'] && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="text-blue-600" />
            Ready-to-Use Company Descriptions
          </h2>
          <div className="space-y-4">
            {groupedData['Company Descriptions'].map((item)=>(
              <div key={item.id} className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{item.fieldName}</h3>
                  <button onClick={()=>copy(item.fieldValue, item.fieldId)} className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                    {copied===item.fieldId ? <><Check size={14}/>Copied!</> : <><Copy size={14}/>Copy</>}
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
