// src/components/Maintenance.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Archive, Key, Trash2, Database, 
  AlertTriangle, CheckCircle2, Clock, Activity,
  TrendingUp, Zap
} from 'lucide-react';

const Maintenance = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [processing, setProcessing] = useState({
    archiveDisregards: false,
    archiveSocial: false,
    cleanupData: false,
    clearCaches: false
  });

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/.netlify/functions/getMaintenanceStatus');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load maintenance status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleArchiveDisregards = async () => {
    if (!window.confirm(`Archive ${status.disregardsToArchive} disregarded emails older than 90 days?`)) return;
    
    setProcessing(prev => ({ ...prev, archiveDisregards: true }));
    try {
      const res = await fetch('/.netlify/functions/archiveOldDisregards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysThreshold: 90 })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Archived ${data.archived} emails to Disregarded_Archive tab`);
        loadStatus();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, archiveDisregards: false }));
    }
  };

  const handleArchiveSocial = async () => {
    if (!window.confirm(`Archive ${status.socialPostsToArchive} social posts older than 180 days?`)) return;
    
    setProcessing(prev => ({ ...prev, archiveSocial: true }));
    try {
      const res = await fetch('/.netlify/functions/archiveOldSocialPosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysThreshold: 180 })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Archived ${data.archived} posts to MainPostData_Archive tab`);
        loadStatus();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, archiveSocial: false }));
    }
  };

  const handleCleanupData = async () => {
    if (!window.confirm('Clean up old drafts, duplicates, and orphaned data?')) return;
    
    setProcessing(prev => ({ ...prev, cleanupData: true }));
    try {
      const res = await fetch('/.netlify/functions/cleanupOldData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Cleanup complete:\n- ${data.oldDraftsDeleted} drafts deleted\n- ${data.duplicatesRemoved} duplicates removed\n- ${data.orphanedReminders} orphaned reminders cleaned`);
        loadStatus();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, cleanupData: false }));
    }
  };

  const handleClearCaches = async () => {
    if (!window.confirm('Clear all server-side caches? This will force fresh data on next load.')) return;
    
    setProcessing(prev => ({ ...prev, clearCaches: true }));
    try {
      const res = await fetch('/.netlify/functions/clearCaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ All caches cleared! Next load will fetch fresh data.');
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, clearCaches: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="text-gray-600">Loading maintenance status...</span>
      </div>
    );
  }

  const getTokenStatusColor = (token) => {
    if (!token) return 'text-gray-400';
    if (!token.valid) return 'text-red-600';
    if (token.expiresIn && token.expiresIn <= 7) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTokenStatusIcon = (token) => {
    if (!token) return <Clock size={20} />;
    if (!token.valid) return <AlertTriangle size={20} />;
    if (token.expiresIn && token.expiresIn <= 7) return <AlertTriangle size={20} />;
    return <CheckCircle2 size={20} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="text-blue-600" size={36} />
            System Maintenance
          </h1>
          <p className="text-gray-600 mt-1">Keep your app healthy and performant</p>
        </div>
        <button
          onClick={loadStatus}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={18} /> Refresh Status
        </button>
      </div>

      {/* Last Run / Next Run */}
      {status?.lastRun && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="text-gray-600" size={20} />
              <h3 className="font-semibold text-gray-900">Last Maintenance</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {new Date(status.lastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {Math.floor((Date.now() - new Date(status.lastRun).getTime()) / (1000 * 60 * 60 * 24))} days ago
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Recommended Next Run</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {new Date(status.nextRecommendedRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              In {Math.ceil((new Date(status.nextRecommendedRun).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
            </p>
          </div>
        </div>
      )}

      {/* Data Archival */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Archive className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Data Archival</h2>
        </div>

        <div className="space-y-4">
          {/* Disregarded Emails */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">Disregarded Emails (90+ days old)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Move old disregarded emails to archive to keep the list clean
                </p>
              </div>
              {status?.disregardsToArchive > 0 ? (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                  {status.disregardsToArchive} to archive
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Clean
                </span>
              )}
            </div>
            {status?.disregardsToArchive > 0 && (
              <button
                onClick={handleArchiveDisregards}
                disabled={processing.archiveDisregards}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing.archiveDisregards ? (
                  <>
                    <RefreshCw className="inline animate-spin mr-2" size={16} />
                    Archiving...
                  </>
                ) : (
                  <>Archive {status.disregardsToArchive} Emails</>
                )}
              </button>
            )}
          </div>

          {/* Social Posts */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">Social Posts (180+ days old)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Archive old published posts to improve performance
                </p>
              </div>
              {status?.socialPostsToArchive > 0 ? (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                  {status.socialPostsToArchive} to archive
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Clean
                </span>
              )}
            </div>
            {status?.socialPostsToArchive > 0 && (
              <button
                onClick={handleArchiveSocial}
                disabled={processing.archiveSocial}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing.archiveSocial ? (
                  <>
                    <RefreshCw className="inline animate-spin mr-2" size={16} />
                    Archiving...
                  </>
                ) : (
                  <>Archive {status.socialPostsToArchive} Posts</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* API Token Health */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Key className="text-purple-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">API Token Health</h2>
        </div>

        {status?.tokenHealth && (
          <div className="space-y-3">
            {/* LinkedIn */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                {getTokenStatusIcon(status.tokenHealth.linkedin)}
                <div>
                  <h3 className="font-semibold text-gray-900">LinkedIn Access Token</h3>
                  {status.tokenHealth.linkedin?.valid ? (
                    <p className="text-sm text-gray-600">
                      Valid {status.tokenHealth.linkedin.expiresIn ? `(${status.tokenHealth.linkedin.expiresIn} days left)` : ''}
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">Invalid or expired</p>
                  )}
                </div>
              </div>
              <span className={`font-semibold ${getTokenStatusColor(status.tokenHealth.linkedin)}`}>
                {status.tokenHealth.linkedin?.valid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>

            {/* Facebook */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                {getTokenStatusIcon(status.tokenHealth.facebook)}
                <div>
                  <h3 className="font-semibold text-gray-900">Facebook Page Token</h3>
                  {status.tokenHealth.facebook?.valid ? (
                    <p className="text-sm text-gray-600">
                      {status.tokenHealth.facebook.neverExpires ? 'Never expires' : 'Valid'}
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">Invalid or expired</p>
                  )}
                </div>
              </div>
              <span className={`font-semibold ${getTokenStatusColor(status.tokenHealth.facebook)}`}>
                {status.tokenHealth.facebook?.valid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>

            {/* Google */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                {getTokenStatusIcon(status.tokenHealth.google)}
                <div>
                  <h3 className="font-semibold text-gray-900">Google Service Account</h3>
                  <p className="text-sm text-gray-600">
                    {status.tokenHealth.google?.valid ? 'Valid' : 'Invalid or misconfigured'}
                  </p>
                </div>
              </div>
              <span className={`font-semibold ${getTokenStatusColor(status.tokenHealth.google)}`}>
                {status.tokenHealth.google?.valid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>

            {/* Brevo */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                {getTokenStatusIcon(status.tokenHealth.brevo)}
                <div>
                  <h3 className="font-semibold text-gray-900">Brevo API Key</h3>
                  <p className="text-sm text-gray-600">
                    {status.tokenHealth.brevo?.valid ? 'Valid' : 'Invalid or expired'}
                  </p>
                </div>
              </div>
              <span className={`font-semibold ${getTokenStatusColor(status.tokenHealth.brevo)}`}>
                {status.tokenHealth.brevo?.valid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>

            {/* WordPress */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getTokenStatusIcon(status.tokenHealth.wordpress)}
                <div>
                  <h3 className="font-semibold text-gray-900">WordPress Authentication</h3>
                  <p className="text-sm text-gray-600">
                    {status.tokenHealth.wordpress?.valid ? 'Valid' : 'Invalid or expired'}
                  </p>
                </div>
              </div>
              <span className={`font-semibold ${getTokenStatusColor(status.tokenHealth.wordpress)}`}>
                {status.tokenHealth.wordpress?.valid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>

            {/* Token Renewal Instructions */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">🔧 Token Renewal Instructions</h4>
              
              {/* LinkedIn */}
              <div className="mb-4 pb-4 border-b border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-blue-900">LinkedIn Access Token</div>
                  {status.tokenHealth?.linkedin?.valid ? (
                    <span className="text-green-600 text-sm">✅ Valid</span>
                  ) : (
                    <span className="text-red-600 text-sm">❌ Expired</span>
                  )}
                </div>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>1.</strong> Click button below to start OAuth flow</p>
                  <p><strong>2.</strong> Authorize 49 North on LinkedIn</p>
                  <p><strong>3.</strong> Copy the access token shown</p>
                  <p><strong>4.</strong> Add to Netlify: <code className="bg-blue-100 px-1 rounded text-xs">LINKEDIN_ACCESS_TOKEN</code></p>
                  <p><strong>5.</strong> Redeploy site</p>
                  <a
                    href="/.netlify/functions/linkedinOAuthHelper"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    Renew LinkedIn Token →
                  </a>
                </div>
              </div>

              {/* Facebook */}
              <div className="mb-4 pb-4 border-b border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-blue-900">Facebook Page Token</div>
                  {status.tokenHealth?.facebook?.valid ? (
                    <span className="text-green-600 text-sm">✅ Valid</span>
                  ) : (
                    <span className="text-red-600 text-sm">❌ Invalid</span>
                  )}
                </div>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>1.</strong> Visit Facebook Graph API Explorer</p>
                  <p><strong>2.</strong> Select your Page from dropdown</p>
                  <p><strong>3.</strong> Add permissions: <code className="bg-blue-100 px-1 rounded text-xs">pages_manage_posts, pages_read_engagement</code></p>
                  <p><strong>4.</strong> Click "Generate Access Token"</p>
                  <p><strong>5.</strong> Add to Netlify: <code className="bg-blue-100 px-1 rounded text-xs">FACEBOOK_PAGE_ACCESS_TOKEN</code></p>
                  <a
                    href="https://developers.facebook.com/tools/explorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    Open Graph API Explorer →
                  </a>
                </div>
              </div>

              {/* Google */}
              <div className="mb-4 pb-4 border-b border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-blue-900">Google Service Account</div>
                  {status.tokenHealth?.google?.valid ? (
                    <span className="text-green-600 text-sm">✅ Valid</span>
                  ) : (
                    <span className="text-red-600 text-sm">❌ Invalid</span>
                  )}
                </div>
                <div className="text-sm text-blue-800">
                  <p>Service Account credentials don't expire. If invalid, check:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Netlify has <code className="bg-blue-100 px-1 rounded text-xs">GOOGLE_CLIENT_EMAIL</code></li>
                    <li>Netlify has <code className="bg-blue-100 px-1 rounded text-xs">GOOGLE_PRIVATE_KEY</code></li>
                    <li>Key is properly formatted (includes BEGIN/END markers)</li>
                  </ul>
                </div>
              </div>

              {/* Brevo */}
              <div className="mb-4 pb-4 border-b border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-blue-900">Brevo API Key</div>
                  {status.tokenHealth?.brevo?.valid ? (
                    <span className="text-green-600 text-sm">✅ Valid</span>
                  ) : (
                    <span className="text-red-600 text-sm">❌ Invalid</span>
                  )}
                </div>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>1.</strong> Log in to Brevo dashboard</p>
                  <p><strong>2.</strong> Go to Settings → API Keys</p>
                  <p><strong>3.</strong> Generate new API key</p>
                  <p><strong>4.</strong> Add to Netlify: <code className="bg-blue-100 px-1 rounded text-xs">BREVO_API_KEY</code></p>
                  <a
                    href="https://app.brevo.com/settings/keys/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    Open Brevo API Keys →
                  </a>
                </div>
              </div>

              {/* WordPress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-blue-900">WordPress Application Password</div>
                  {status.tokenHealth?.wordpress?.valid ? (
                    <span className="text-green-600 text-sm">✅ Valid</span>
                  ) : (
                    <span className="text-red-600 text-sm">❌ Invalid</span>
                  )}
                </div>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>1.</strong> Log in to WordPress admin</p>
                  <p><strong>2.</strong> Go to Users → Profile → Application Passwords</p>
                  <p><strong>3.</strong> Create new application password</p>
                  <p><strong>4.</strong> Add to Netlify: <code className="bg-blue-100 px-1 rounded text-xs">WP_APPLICATION_PASSWORD</code></p>
                  <a
                    href="https://mymentalarmor.com/wp-admin/profile.php"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    Open WordPress Profile →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Cleanup */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="text-orange-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Data Cleanup</h2>
        </div>

        <div className="space-y-4">
          {/* Old Drafts */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">Draft Posts (30+ days old)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Delete old unpublished drafts that are no longer needed
                </p>
              </div>
              {status?.oldDrafts > 0 ? (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                  {status.oldDrafts} to delete
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Clean
                </span>
              )}
            </div>
          </div>

          {/* Duplicate Webinars */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">Duplicate Webinars</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Remove duplicate webinar entries from Zoom API sync
                </p>
              </div>
              {status?.duplicateWebinars > 0 ? (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                  {status.duplicateWebinars} duplicates
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Clean
                </span>
              )}
            </div>
          </div>

          {/* Orphaned Reminders */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">Orphaned Reminder Entries</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Clean up reminder tracking entries for past/deleted webinars
                </p>
              </div>
              {status?.orphanedReminders > 0 ? (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                  {status.orphanedReminders} orphaned
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Clean
                </span>
              )}
            </div>
          </div>

          {/* Cleanup Button */}
          {(status?.oldDrafts > 0 || status?.duplicateWebinars > 0 || status?.orphanedReminders > 0) && (
            <button
              onClick={handleCleanupData}
              disabled={processing.cleanupData}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {processing.cleanupData ? (
                <>
                  <RefreshCw className="inline animate-spin mr-2" size={18} />
                  Running Cleanup...
                </>
              ) : (
                <>
                  <Trash2 className="inline mr-2" size={18} />
                  Run Data Cleanup
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Cache Management */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Database className="text-green-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Cache Management</h2>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Server-side caches reduce API calls and improve performance. Clear caches when you've manually updated Google Sheets and need immediate refresh.
          </p>

          {status?.cacheStatus && (
            <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Reminders Cache:</span>
                <span className="text-gray-900 font-medium">{status.cacheStatus.reminders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Webinars Cache:</span>
                <span className="text-gray-900 font-medium">{status.cacheStatus.webinars}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Social Cache:</span>
                <span className="text-gray-900 font-medium">{status.cacheStatus.social}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleClearCaches}
            disabled={processing.clearCaches}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {processing.clearCaches ? (
              <>
                <RefreshCw className="inline animate-spin mr-2" size={18} />
                Clearing...
              </>
            ) : (
              <>
                <Zap className="inline mr-2" size={18} />
                Clear All Caches
              </>
            )}
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Performance Metrics</h2>
        </div>

        {status?.performance && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* API Quota */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-700 font-semibold mb-1">API Quota Usage</div>
              <div className="text-2xl font-bold text-blue-900">
                {status.performance.apiQuotaUsage}/60
              </div>
              <div className="text-xs text-blue-600 mt-1">requests this minute</div>
              {status.performance.apiQuotaUsage > 50 && (
                <div className="text-xs text-red-600 mt-2">⚠️ Near limit!</div>
              )}
            </div>

            {/* Cache Hit Rate */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-700 font-semibold mb-1">Cache Hit Rate</div>
              <div className="text-2xl font-bold text-green-900">
                {status.performance.cacheHitRate}%
              </div>
              <div className="text-xs text-green-600 mt-1">requests served from cache</div>
            </div>

            {/* Avg Execution Time */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-700 font-semibold mb-1">Avg Response Time</div>
              <div className="text-2xl font-bold text-purple-900">
                {status.performance.avgExecutionTime}ms
              </div>
              <div className="text-xs text-purple-600 mt-1">function execution</div>
            </div>

            {/* Error Rate */}
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-700 font-semibold mb-1">Error Rate</div>
              <div className="text-2xl font-bold text-orange-900">
                {status.performance.errorRate}%
              </div>
              <div className="text-xs text-orange-600 mt-1">failed requests</div>
              {status.performance.errorRate > 5 && (
                <div className="text-xs text-red-600 mt-2">⚠️ High error rate!</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Maintenance Instructions */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow border border-blue-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">📚 Maintenance Best Practices</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <strong className="text-blue-900">Weekly:</strong> Check token health and performance metrics
          </div>
          <div>
            <strong className="text-blue-900">Monthly:</strong> Archive old disregarded emails, clean up old drafts
          </div>
          <div>
            <strong className="text-blue-900">Quarterly:</strong> Archive old social posts, review data structure
          </div>
          <div>
            <strong className="text-blue-900">As Needed:</strong> Clear caches after manual sheet updates
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;

