// SocialMediaOperations.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Share2, RefreshCw, Download, Filter, Plus, Calendar, CheckCircle2, Clock, FileText, Copy, AlertCircle, Trash2, Send } from 'lucide-react';
import { fetchSocialMediaContent, publishSocialPost } from '../services/socialMediaService';
import { fetchReminders } from '../services/reminderService';
import PostComposerModal from './PostComposerModal';
import AIContentAssistant from './AIContentAssistant';

const badgeForStatus = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'published') return { cls: 'bg-green-100 text-green-800', icon: <CheckCircle2 size={14} /> };
  if (v === 'scheduled') return { cls: 'bg-blue-100 text-blue-800', icon: <Calendar size={14} /> };
  if (v === 'draft') return { cls: 'bg-yellow-100 text-yellow-800', icon: <Clock size={14} /> };
  return { cls: 'bg-gray-100 text-gray-800', icon: <FileText size={14} /> };
};

const SocialMediaOperations = () => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [posts, setPosts] = useState([]);
  const [summary, setSummary] = useState({ totalPosts: 0, published: 0, scheduled: 0, drafts: 0 });
  const [composerOpen, setComposerOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null); // For reusing/editing posts
  const [successMessage, setSuccessMessage] = useState(null);
  const [weeklyReminders, setWeeklyReminders] = useState(null);
  const [webinarReminders, setWebinarReminders] = useState(null);

  // filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');   // all | Published | Scheduled | Draft
  const [platform, setPlatform] = useState('all'); // all | LinkedIn | Facebook | X | ...

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const data = await fetchSocialMediaContent();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setSummary(data.summary || { totalPosts: 0, published: 0, scheduled: 0, drafts: 0 });

      // Ticker integration removed - now handled by comprehensive ticker system
    } catch (e) {
      setErr(e?.message || 'Failed to load social posts');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeeklyReminders = useCallback(async () => {
    try {
      const reminderData = await fetchReminders();
      setWeeklyReminders(reminderData.weeklyReminders);
      setWebinarReminders(reminderData.webinarReminders || []);
    } catch (e) {
      console.warn('Failed to load weekly reminders:', e);
      setWeeklyReminders(null);
      setWebinarReminders(null);
    }
  }, []);

  useEffect(() => { 
    load();
    loadWeeklyReminders();
  }, [load, loadWeeklyReminders]);

  const platforms = useMemo(() => {
    const set = new Set();
    posts.forEach(p => {
      const list = (p.platforms || '').split(',').map(s => s.trim()).filter(Boolean);
      list.forEach(pl => set.add(pl));
    });
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    if (!Array.isArray(posts) || posts.length === 0) return [];
    
    const ql = q.trim().toLowerCase();
    return posts.filter(p => {
      if (!p || typeof p !== 'object') return false; // Skip invalid posts
      const matchQ = !ql || [p.title, p.body, p.text].some(v => String(v || '').toLowerCase().includes(ql));
      const matchStatus = status === 'all' || String(p.status || '').toLowerCase() === status.toLowerCase();
      const plist = String(p.platforms || '').split(',').map(s => s.trim());
      const matchPlatform = platform === 'all' || plist.includes(platform);
      return matchQ && matchStatus && matchPlatform;
    }).sort((a, b) => {
      const ta = Date.parse(a.scheduledDate || a.publishedDate || a.timestamp || a.createdAt || 0) || 0;
      const tb = Date.parse(b.scheduledDate || b.publishedDate || b.timestamp || b.createdAt || 0) || 0;
      return tb - ta;
    });
  }, [posts, q, status, platform]);

  const exportCsv = useCallback(() => {
    const headers = ['Title','Status','Platforms','Scheduled','Published','Created','Author','Link'];
    const esc = (v) => String(v ?? '').replace(/"/g, '""');
    const rows = filtered.map(p => ([
      p.title || '',
      p.status || '',
      p.platforms || '',
      p.scheduledDate || '',
      p.publishedDate || '',
      p.createdAt || '',
      p.author || '',
      p.link || p.url || ''
    ]));
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${esc(c)}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `social_posts_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [filtered]);

  const handleUseAISuggestion = useCallback((suggestion) => {
    // Pre-fill the post composer with AI suggestion
    setPostToEdit({
      title: suggestion.title,
      content: suggestion.linkedinPost, // Default to LinkedIn version
      platforms: 'LinkedIn,Facebook,Blog', // Default platforms
      contentType: 'ai-generated',
      aiSuggestion: suggestion // Store full suggestion for reference
    });
    setComposerOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Social Media Operations</h1>
          <p className="text-gray-600 mt-1">Content calendar, composer, assets & performance analytics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={18} /> Refresh
          </button>
          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Plus size={18} /> New Post
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
          >
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* AI Content Assistant */}
      <AIContentAssistant onUseSuggestion={handleUseAISuggestion} />

      {/* KPI cards - clickable to filter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          onClick={() => setStatus('all')}
          className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Posts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalPosts}</p>
            </div>
            <Share2 className="text-blue-600" size={40} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Click to show all</p>
        </div>
        
        <div 
          onClick={() => setStatus('Published')}
          className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow border border-green-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-semibold">Published</p>
              <p className="text-3xl font-bold text-green-900 mt-1">{summary.published}</p>
            </div>
            <CheckCircle2 className="text-green-600" size={40} />
          </div>
          <p className="text-xs text-green-600 mt-2">Click to filter</p>
        </div>
        
        <div 
          onClick={() => setStatus('Scheduled')}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow border border-blue-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-semibold">Scheduled</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{summary.scheduled}</p>
            </div>
            <Calendar className="text-blue-600" size={40} />
          </div>
          <p className="text-xs text-blue-600 mt-2">Click to filter</p>
        </div>
        
        <div 
          onClick={() => setStatus('Draft')}
          className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow border border-yellow-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-semibold">Drafts</p>
              <p className="text-3xl font-bold text-yellow-900 mt-1">{summary.drafts}</p>
            </div>
            <Clock className="text-yellow-600" size={40} />
          </div>
          <p className="text-xs text-yellow-600 mt-2">Click to filter</p>
        </div>
      </div>

      {/* Weekly Post Reminders */}
      {weeklyReminders && weeklyReminders.monday && weeklyReminders.wednesday && weeklyReminders.friday && (weeklyReminders.monday.overdue || weeklyReminders.wednesday.overdue || weeklyReminders.friday.overdue) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">📅 Weekly Post Reminders</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Missing posts for Week {weeklyReminders.currentWeek}:
              </p>
              <div className="mt-2 space-y-1 text-sm">
                {weeklyReminders.monday.overdue && (
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-800">
                      • <strong>Monday</strong> ({weeklyReminders.monday.date}) - "Resilience Skill of the Week" - <span className="text-red-600">Overdue</span>
                    </span>
                    <button
                      onClick={() => {
                        setPostToEdit({ contentType: 'monday-weekly' });
                        setComposerOpen(true);
                      }}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Create Now →
                    </button>
                  </div>
                )}
                {weeklyReminders.wednesday.overdue && (
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-800">
                      • <strong>Wednesday</strong> ({weeklyReminders.wednesday.date}) - "Putting Skills Into Practice" - <span className="text-red-600">Overdue</span>
                    </span>
                    <button
                      onClick={() => {
                        setPostToEdit({ contentType: 'wednesday-weekly' });
                        setComposerOpen(true);
                      }}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Create Now →
                    </button>
                  </div>
                )}
                {weeklyReminders.friday.overdue && (
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-800">
                      • <strong>Friday</strong> ({weeklyReminders.friday.date}) - "Learn More / CTA" - <span className="text-red-600">Overdue</span>
                    </span>
                    <button
                      onClick={() => {
                        setPostToEdit({ contentType: 'friday-weekly' });
                        setComposerOpen(true);
                      }}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Create Now →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Posts Info */}
      {weeklyReminders && weeklyReminders.monday && weeklyReminders.wednesday && weeklyReminders.friday && (weeklyReminders.monday.status === 'upcoming' || weeklyReminders.wednesday.status === 'upcoming' || weeklyReminders.friday.status === 'upcoming') && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg shadow">
          <div className="flex items-start gap-3">
            <Calendar className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">📅 Upcoming Weekly Posts</h3>
              <div className="mt-2 space-y-1 text-sm text-blue-800">
                {weeklyReminders.monday.status === 'upcoming' && (
                  <div>• <strong>Monday</strong> - Due in {weeklyReminders.monday.daysUntil} days ({weeklyReminders.monday.date})</div>
                )}
                {weeklyReminders.wednesday.status === 'upcoming' && (
                  <div>• <strong>Wednesday</strong> - Due in {weeklyReminders.wednesday.daysUntil} days ({weeklyReminders.wednesday.date})</div>
                )}
                {weeklyReminders.friday.status === 'upcoming' && (
                  <div>• <strong>Friday</strong> - Due in {weeklyReminders.friday.daysUntil} days ({weeklyReminders.friday.date})</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webinar Social Post Reminders */}
      {webinarReminders && webinarReminders.some(w => 
        w.socialReminders?.oneWeek?.status === 'overdue' || 
        w.socialReminders?.oneDay?.status === 'overdue' || 
        w.socialReminders?.oneHour?.status === 'overdue'
      ) && (
        <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg shadow">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-purple-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900">🎥 Webinar Social Post Reminders</h3>
              <p className="text-sm text-purple-800 mt-1">
                Create promotional social posts for upcoming webinars:
              </p>
              <div className="mt-2 space-y-2">
                {webinarReminders.filter(w => 
                  w.socialReminders?.oneWeek?.status === 'overdue' ||
                  w.socialReminders?.oneDay?.status === 'overdue' ||
                  w.socialReminders?.oneHour?.status === 'overdue'
                ).map(webinar => (
                  <div key={webinar.webinarId} className="bg-white p-3 rounded border border-purple-200">
                    <div className="font-semibold text-purple-900 text-sm">{webinar.webinarTitle}</div>
                    <div className="text-xs text-purple-700 mt-1">{webinar.webinarDate} at {webinar.webinarTime}</div>
                    <div className="mt-2 space-y-1 text-xs">
                      {webinar.socialReminders?.oneWeek?.status === 'overdue' && (
                        <div className="flex items-center justify-between">
                          <span className="text-purple-800">
                            • <strong>1 Week Before</strong> - Promotional post - <span className="text-red-600">Overdue</span>
                          </span>
                          <button
                            onClick={() => {
                              setPostToEdit({ 
                                contentType: 'webinar-1week', 
                                webinarId: webinar.webinarId,
                                webinarTitle: webinar.webinarTitle,
                                webinarDate: webinar.webinarDate,
                                webinarTime: webinar.webinarTime
                              });
                              setComposerOpen(true);
                            }}
                            className="text-purple-600 hover:underline font-medium ml-2"
                          >
                            Create Now →
                          </button>
                        </div>
                      )}
                      {webinar.socialReminders?.oneDay?.status === 'overdue' && (
                        <div className="flex items-center justify-between">
                          <span className="text-purple-800">
                            • <strong>1 Day Before</strong> - "Tomorrow!" post - <span className="text-red-600">Overdue</span>
                          </span>
                          <button
                            onClick={() => {
                              setPostToEdit({ 
                                contentType: 'webinar-1day', 
                                webinarId: webinar.webinarId,
                                webinarTitle: webinar.webinarTitle,
                                webinarDate: webinar.webinarDate,
                                webinarTime: webinar.webinarTime
                              });
                              setComposerOpen(true);
                            }}
                            className="text-purple-600 hover:underline font-medium ml-2"
                          >
                            Create Now →
                          </button>
                        </div>
                      )}
                      {webinar.socialReminders?.oneHour?.status === 'overdue' && (
                        <div className="flex items-center justify-between">
                          <span className="text-purple-800">
                            • <strong>1 Hour Before</strong> - "Starting soon!" post - <span className="text-red-600">Overdue</span>
                          </span>
                          <button
                            onClick={() => {
                              setPostToEdit({ 
                                contentType: 'webinar-1hour', 
                                webinarId: webinar.webinarId,
                                webinarTitle: webinar.webinarTitle,
                                webinarDate: webinar.webinarDate,
                                webinarTime: webinar.webinarTime
                              });
                              setComposerOpen(true);
                            }}
                            className="text-purple-600 hover:underline font-medium ml-2"
                          >
                            Create Now →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={18} className="text-gray-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or body…"
            className="px-3 py-2 border border-gray-300 rounded w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="Published">Published</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Draft">Draft</option>
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All platforms</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="ml-auto text-sm text-gray-600">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Loading / Error / Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-600">
          <RefreshCw className="animate-spin mr-2" size={18} /> Loading posts…
        </div>
      ) : err ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {err}
        </div>
      ) : (
        <div className="bg-white p-0 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Platforms</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Link</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((p, i) => {
                const statusBadge = badgeForStatus(p.status);
                const scheduled = p.scheduleDate ? new Date(p.scheduleDate).toLocaleString() : '';
                const published = p.publishedDate ? new Date(p.publishedDate).toLocaleString() : '';
                const created = p.timestamp || p.createdAt ? new Date(p.timestamp || p.createdAt).toLocaleString() : '';
                
                // Ensure all values are strings/primitives
                const safeTitle = String(p.title || '(Untitled)');
                const safeBody = String(p.body || '');
                const safeStatus = String(p.status || '—');
                const safePlatforms = String(p.platforms || '');
                const safeLink = String(p.link || p.url || p.postPermalink || '');
                
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-semibold">{safeTitle}</div>
                      {safeBody && <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{safeBody}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${statusBadge.cls}`}>
                        {statusBadge.icon}{safeStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {safePlatforms
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean)
                        .map(pl => (
                          <span key={pl} className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mr-1 mb-1">
                            {pl}
                          </span>
                        ))}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {scheduled && (
                        <div className="mb-1">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                            <Calendar size={12} />
                            Scheduled:
                          </span>
                          <div className="text-gray-900 font-medium">{scheduled}</div>
                        </div>
                      )}
                      {published && <div className="mb-1"><span className="font-medium text-green-700">Published:</span> <span className="text-gray-900">{published}</span></div>}
                      {!scheduled && !published && created && <div className="text-gray-500"><span className="font-medium">Created:</span> {created}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {safeLink ? (
                        <a href={safeLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View
                        </a>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* Reuse button - always available */}
                        <button
                          onClick={() => {
                            // Normalize post data to ensure all fields are primitives
                            const normalizedPost = {
                              title: String(p.title || ''),
                              body: String(p.body || p.text || ''),
                              contentType: typeof p.contentType === 'string' ? p.contentType : 'announcement',
                              imageUrl: String(p.imageUrl || ''),
                              videoUrl: String(p.videoUrl || ''),
                              platforms: String(p.platforms || ''),
                              tags: String(p.tags || ''),
                              scheduleDate: String(p.scheduleDate || ''),
                              purpose: String(p.purpose || ''),
                              status: String(p.status || '')
                            };
                            setPostToEdit(normalizedPost);
                            setComposerOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                          title="Reuse/Copy this post"
                        >
                          <Copy size={14} />
                          Reuse
                        </button>

                        {/* Publish Now - only for Draft/Scheduled */}
                        {(p.status === 'Draft' || p.status === 'Scheduled') && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Publish "${p.title}" now?`)) return;
                              try {
                                const result = await publishSocialPost({ postId: p.timestamp });
                                if (result.success) {
                                  alert('✅ Published successfully!');
                                  load(); // Refresh list
                                } else {
                                  alert('❌ Publish failed: ' + JSON.stringify(result.results));
                                }
                              } catch (err) {
                                alert('❌ Error: ' + err.message);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                            title="Publish immediately"
                          >
                            <Send size={14} />
                            Publish
                          </button>
                        )}

                        {/* Delete - only for Draft/Scheduled */}
                        {(p.status === 'Draft' || p.status === 'Scheduled') && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete "${p.title}"?\n\nThis cannot be undone.`)) return;
                              try {
                                const response = await fetch(`/.netlify/functions/deleteSocialPost?postId=${encodeURIComponent(p.timestamp)}`, {
                                  method: 'DELETE'
                                });
                                const result = await response.json();
                                if (result.success) {
                                  alert('✅ Post deleted');
                                  load(); // Refresh list
                                } else {
                                  alert('❌ Delete failed: ' + result.error);
                                }
                              } catch (err) {
                                alert('❌ Error: ' + err.message);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                            title="Delete this post"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-gray-500">
                    No posts match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800 whitespace-pre-wrap">{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="mt-2 text-green-600 hover:text-green-800 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Post Composer Modal */}
      <PostComposerModal
        isOpen={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setPostToEdit(null);
        }}
        initialPost={postToEdit}
        onSuccess={(message) => {
          setSuccessMessage(message);
          setPostToEdit(null);
          load(); // Refresh posts list
          setTimeout(() => setSuccessMessage(null), 8000);
        }}
      />
    </div>
  );
};

export default SocialMediaOperations;
