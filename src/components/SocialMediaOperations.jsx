// SocialMediaOperations.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Share2, RefreshCw, Download, Filter, Plus, Calendar, CheckCircle2, Clock, FileText } from 'lucide-react';
import { fetchSocialMediaContent } from '../services/socialMediaService';

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

  useEffect(() => { load(); }, [load]);

  const platforms = useMemo(() => {
    const set = new Set();
    posts.forEach(p => {
      const list = (p.platforms || '').split(',').map(s => s.trim()).filter(Boolean);
      list.forEach(pl => set.add(pl));
    });
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return posts.filter(p => {
      const matchQ = !ql || [p.title, p.body, p.text].some(v => String(v || '').toLowerCase().includes(ql));
      const matchStatus = status === 'all' || String(p.status || '').toLowerCase() === status.toLowerCase();
      const plist = (p.platforms || '').split(',').map(s => s.trim());
      const matchPlatform = platform === 'all' || plist.includes(platform);
      return matchQ && matchStatus && matchPlatform;
    }).sort((a, b) => {
      const ta = Date.parse(a.scheduledDate || a.publishedDate || a.createdAt || 0) || 0;
      const tb = Date.parse(b.scheduledDate || b.publishedDate || b.createdAt || 0) || 0;
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
            onClick={() => alert('Composer coming soon — wired to post to your Google Sheet and queue to platforms.')}
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Posts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalPosts}</p>
            </div>
            <Share2 className="text-blue-600" size={40} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Published</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{summary.published}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Scheduled</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{summary.scheduled}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Drafts</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{summary.drafts}</p>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((p, i) => {
                const statusBadge = badgeForStatus(p.status);
                const scheduled = p.scheduledDate ? new Date(p.scheduledDate).toLocaleString() : '';
                const published = p.publishedDate ? new Date(p.publishedDate).toLocaleString() : '';
                const created = p.createdAt ? new Date(p.createdAt).toLocaleString() : '';
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-semibold">{p.title || '(Untitled)'}</div>
                      {p.body && <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{p.body}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${statusBadge.cls}`}>
                        {statusBadge.icon}{p.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(p.platforms || '')
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
                      {scheduled && <div><span className="font-medium text-gray-700">Scheduled:</span> {scheduled}</div>}
                      {published && <div><span className="font-medium text-gray-700">Published:</span> {published}</div>}
                      {created && <div><span className="font-medium text-gray-700">Created:</span> {created}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(p.link || p.url) ? (
                        <a href={p.link || p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View
                        </a>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-gray-500">
                    No posts match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Roadmap: Upload • Retrieve • Analyze */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Next Up</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li><span className="font-medium">Upload:</span> add a Netlify function <code>createSocialPost</code> to write rows to your Google Sheet; wire the “New Post” button to a modal that POSTs {`{title, body, platforms, scheduledDate}`}, then refresh.</li>
          <li><span className="font-medium">Retrieve:</span> `fetchSocialMediaContent()` already normalizes data; extend it with filters <code>?status=Scheduled&platform=LinkedIn</code> and ETag for 304s.</li>
          <li><span className="font-medium">Analyze:</span> nightly function computes per-platform cadence, best post time windows, and CTR if you add links; surface in KPI cards and a “Trends” sub-tab.</li>
        </ul>
      </div>
    </div>
  );
};

export default SocialMediaOperations;
