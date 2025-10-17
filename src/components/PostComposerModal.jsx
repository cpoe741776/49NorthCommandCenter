// src/components/PostComposerModal.jsx
import React, { useState, useMemo } from 'react';
import { X, Send, Save, Eye, Image, Video, Calendar, Tag, AlertCircle } from 'lucide-react';
import { createSocialPost, publishSocialPost } from '../services/socialMediaService';

const PostComposerModal = ({ isOpen, onClose, onSuccess, initialPost }) => {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    contentType: 'announcement',
    imageUrl: '',
    videoUrl: '',
    platforms: {
      Facebook: false,
      LinkedIn: false,
      Website: false,
      Email: false
    },
    scheduleDate: '',
    tags: '',
    createdBy: 'user'
  });

  // Load initial post data when provided (for reusing posts)
  React.useEffect(() => {
    if (initialPost && isOpen) {
      const platformsFromPost = (initialPost.platforms || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      
      setFormData({
        title: initialPost.title || '',
        body: initialPost.body || initialPost.text || '',
        contentType: initialPost.contentType || 'announcement',
        imageUrl: initialPost.imageUrl || '',
        videoUrl: initialPost.videoUrl || '',
        platforms: {
          Facebook: platformsFromPost.includes('Facebook'),
          LinkedIn: platformsFromPost.includes('LinkedIn'),
          Website: platformsFromPost.includes('Website'),
          Email: platformsFromPost.includes('Email')
        },
        scheduleDate: '', // Clear schedule date for reused posts
        tags: initialPost.tags || '',
        createdBy: 'user'
      });
    } else if (!isOpen) {
      // Reset when modal closes
      resetForm();
    }
  }, [initialPost, isOpen]);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Character counts
  const titleCount = formData.title.length;
  const bodyCount = formData.body.length;

  // Platform-specific limits
  const limits = {
    Facebook: { title: 80, body: 63206 },
    LinkedIn: { title: 150, body: 3000 },
    Website: { title: 100, body: 'unlimited' },
    Email: { title: 60, body: 'unlimited' }
  };

  // Validation
  const selectedPlatforms = useMemo(() => 
    Object.entries(formData.platforms).filter(([_, v]) => v).map(([k]) => k),
    [formData.platforms]
  );

  const validation = useMemo(() => {
    const errors = [];
    if (!formData.title.trim()) errors.push('Title is required');
    if (!formData.body.trim()) errors.push('Body is required');
    if (selectedPlatforms.length === 0) errors.push('Select at least one platform');

    // Platform-specific validation
    selectedPlatforms.forEach(platform => {
      if (limits[platform].title !== 'unlimited' && titleCount > limits[platform].title) {
        errors.push(`Title exceeds ${platform} limit (${limits[platform].title} chars)`);
      }
      if (limits[platform].body !== 'unlimited' && bodyCount > limits[platform].body) {
        errors.push(`Body exceeds ${platform} limit (${limits[platform].body} chars)`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }, [formData, selectedPlatforms, titleCount, bodyCount]);

  const handlePlatformToggle = (platform) => {
    setFormData(prev => ({
      ...prev,
      platforms: { ...prev.platforms, [platform]: !prev.platforms[platform] }
    }));
  };

  const handleSaveDraft = async () => {
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        platforms: selectedPlatforms.join(','),
        status: 'Draft'
      };

      const result = await createSocialPost(payload);
      
      if (result.success) {
        onSuccess?.('Draft saved successfully!');
        resetForm();
        onClose();
      } else {
        setError(result.error || 'Failed to save draft');
      }
    } catch (e) {
      setError(e.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    if (!window.confirm(`Publish to ${selectedPlatforms.join(', ')} now?`)) return;

    setPublishing(true);
    setError(null);

    try {
      // First create the post
      const payload = {
        ...formData,
        platforms: selectedPlatforms.join(','),
        status: 'Draft' // Will be updated to Published by publishSocialPost
      };

      const createResult = await createSocialPost(payload);
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create post');
      }

      // Then publish it
      const publishResult = await publishSocialPost({ 
        postId: createResult.postId 
      });

      if (publishResult.success) {
        // Show detailed results
        const messages = [];
        if (publishResult.results.facebook) messages.push('✅ Facebook');
        if (publishResult.results.linkedin) messages.push('✅ LinkedIn');
        if (publishResult.results.wordpress) messages.push('✅ Website');
        if (publishResult.results.brevo) messages.push('✅ Email (draft created in Brevo)');
        
        onSuccess?.(`Published successfully!\n\n${messages.join('\n')}`);
        resetForm();
        onClose();
      } else {
        setError('Publish failed: ' + JSON.stringify(publishResult.results));
      }
    } catch (e) {
      setError(e.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      body: '',
      contentType: 'announcement',
      imageUrl: '',
      videoUrl: '',
      platforms: { Facebook: false, LinkedIn: false, Website: false, Email: false },
      scheduleDate: '',
      tags: '',
      createdBy: 'user'
    });
    setError(null);
    setShowPreview(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {initialPost ? 'Reuse Post' : 'Create Social Media Post'}
            </h2>
            {initialPost && (
              <p className="text-sm text-blue-600 mt-1">
                ✨ Content loaded from past post - customize and republish
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {/* Preview Toggle */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Eye size={18} />
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>

          {showPreview ? (
            /* Preview Mode */
            <div className="space-y-6">
              <div className="border rounded-lg p-6 bg-gray-50">
                <h3 className="text-xl font-bold mb-4">{formData.title || 'No Title'}</h3>
                {formData.imageUrl && (
                  <img src={formData.imageUrl} alt="Preview" className="w-full max-w-md mb-4 rounded" />
                )}
                {formData.videoUrl && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                    <Video size={18} className="inline mr-2" />
                    Video: {formData.videoUrl}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{formData.body || 'No content'}</div>
                {formData.tags && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {formData.tags.split(',').map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        #{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Publishing to:</strong> {selectedPlatforms.join(', ') || 'No platforms selected'}
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title / Subject Line *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter post title or email subject..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={200}
                />
                <div className="text-xs text-gray-500 mt-1">{titleCount} / 200 characters</div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Post Content *
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Write your post content here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[200px]"
                  rows={8}
                />
                <div className="text-xs text-gray-500 mt-1">{bodyCount} characters</div>
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Target Platforms *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.keys(formData.platforms).map(platform => (
                    <button
                      key={platform}
                      onClick={() => handlePlatformToggle(platform)}
                      className={`p-4 border-2 rounded-lg text-center transition-all ${
                        formData.platforms[platform]
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold">{platform}</div>
                      {formData.platforms[platform] && (
                        <div className="text-xs mt-1">✓ Selected</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media URLs */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Image size={16} className="inline mr-1" />
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Video size={16} className="inline mr-1" />
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Schedule Date & Content Type */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    Schedule Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduleDate}
                    onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Content Type
                  </label>
                  <select
                    value={formData.contentType}
                    onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="announcement">Announcement</option>
                    <option value="webinar">Webinar Promotion</option>
                    <option value="article">Article/Blog</option>
                    <option value="case_study">Case Study</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Tag size={16} className="inline mr-1" />
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="mental-armor, training, resilience"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Validation Warnings */}
              {!validation.isValid && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-sm text-yellow-800">
                    <strong>Please fix:</strong>
                    <ul className="list-disc list-inside mt-2">
                      {validation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handlePublishNow}
              disabled={saving || publishing || !validation.isValid}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
              {publishing ? 'Publishing...' : 'Publish Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostComposerModal;

