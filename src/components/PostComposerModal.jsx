// src/components/PostComposerModal.jsx
import React, { useState, useMemo } from 'react';
import { X, Send, Save, Eye, Image, Video, Calendar, Tag, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { createSocialPost, publishSocialPost } from '../services/socialMediaService';

// SEO Keywords for 49 North posts
const SEO_KEYWORDS = [
  'resilience training', 'mental strength training', 'psychological resilience', 'Mental Armor™',
  'wellbeing', 'stress management', 'performance under pressure', 'first responder resilience',
  'leadership development', 'burnout prevention', 'workplace wellbeing', 'mental fitness',
  'ReFrame', 'Values Based Living', 'Mindfulness', 'Spiritual Resilience',
  'emergency services wellbeing', 'law enforcement resilience', 'firefighter resilience',
  'healthcare resilience', 'physician wellbeing', 'nurse wellbeing', 'educator resilience',
  '49 North™', 'BG Rhonda Cornum', 'Dr. Jill Antonishak', 'Christopher Poe'
];

const MENTAL_ARMOR_SKILLS = [
  'Foundations of Resilience', 'Values Based Living', 'Flex Your Strengths', 'Mindfulness',
  'Spiritual Resilience', 'Cultivate Gratitude', 'ReFrame', 'Balance Your Thinking',
  'What\'s Most Important', 'Interpersonal Problem Solving', 'Celebrate Good News'
];

// Platform-specific character limits
const PLATFORM_LIMITS = {
  Facebook: { title: 80, body: 63206 },
  LinkedIn: { title: 150, body: 3000 },
  Website: { title: 100, body: 'unlimited' },
  Email: { title: 60, body: 'unlimited' }
};

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
  const [showInstructions, setShowInstructions] = useState(true);
  const [showKeywords, setShowKeywords] = useState(false);

  // Character counts
  const titleCount = formData.title.length;
  const bodyCount = formData.body.length;

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
      if (PLATFORM_LIMITS[platform].title !== 'unlimited' && titleCount > PLATFORM_LIMITS[platform].title) {
        errors.push(`Title exceeds ${platform} limit (${PLATFORM_LIMITS[platform].title} chars)`);
      }
      if (PLATFORM_LIMITS[platform].body !== 'unlimited' && bodyCount > PLATFORM_LIMITS[platform].body) {
        errors.push(`Body exceeds ${platform} limit (${PLATFORM_LIMITS[platform].body} chars)`);
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

          {/* Publishing Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full flex items-center justify-between p-4 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info size={20} className="text-blue-600" />
                <span className="font-semibold text-blue-900">Publishing Guidelines & Best Practices</span>
              </div>
              {showInstructions ? <ChevronUp size={20} className="text-blue-600" /> : <ChevronDown size={20} className="text-blue-600" />}
            </button>
            {showInstructions && (
              <div className="p-4 pt-0 text-sm text-blue-900 space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                  <strong className="text-yellow-900">⚠️ IMPORTANT:</strong>
                  <p className="mt-1 text-yellow-800">Content published to platforms is distributed immediately. Ensure your post is fully written, approved, and free of errors before publishing.</p>
                  <p className="mt-2 text-yellow-800"><strong>Brevo emails create DRAFTS</strong> for your review before sending to 28K+ contacts.</p>
                </div>
                
                <div>
                  <strong className="text-blue-800">✅ Example of a Strong Post:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-blue-700">
                    <li><strong>Title:</strong> "ReFraming for Resilience: Mental Armor Skill That Lasts"</li>
                    <li><strong>Body:</strong> Include key takeaway, why it matters, and field examples</li>
                    <li><strong>Keywords:</strong> Sprinkle 2-3 SEO keywords naturally throughout</li>
                    <li><strong>Tags:</strong> Use relevant Mental Armor skills (ReFrame, Mindfulness, etc.)</li>
                  </ul>
                </div>

                <div>
                  <strong className="text-blue-800">🔍 SEO Best Practices:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-blue-700">
                    <li>Include clear keywords in title and body (see keyword list below)</li>
                    <li>Mention your main topic 2-3 times naturally</li>
                    <li>Use short paragraphs and section headers</li>
                    <li>Avoid passive voice and vague statements</li>
                    <li>Add external links (research) and internal links (MyMentalArmor.com pages)</li>
                  </ul>
                </div>

                <div>
                  <strong className="text-blue-800">📝 Content Structure:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-blue-700">
                    <li><strong>Key Takeaway:</strong> What will readers learn?</li>
                    <li><strong>Why It Matters:</strong> Why is this important? (General examples)</li>
                    <li><strong>From the Field:</strong> Real-world examples, quotes, or statistics</li>
                    <li><strong>Main Body:</strong> 3-5 paragraphs with actionable insights</li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowKeywords(true)}
                  className="mt-3 text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                >
                  View SEO Keywords & Mental Armor Skills →
                </button>
              </div>
            )}
          </div>

          {/* Webinar Post Helper */}
          {(formData.contentType === 'webinar' || initialPost?.contentType?.includes('webinar')) && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Calendar size={24} className="text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 mb-2">
                    🎥 Webinar Social Post Tips
                    {initialPost?.webinarTitle && (
                      <span className="block text-sm font-normal text-purple-700 mt-1">
                        For: {initialPost.webinarTitle} ({initialPost.webinarDate} at {initialPost.webinarTime})
                      </span>
                    )}
                  </h3>
                  
                  {initialPost?.contentType === 'webinar-1week' && (
                    <div className="bg-white p-3 rounded border border-purple-200 mt-2">
                      <div className="font-medium text-purple-900 mb-1">📅 1 Week Before - Promotional Post</div>
                      <div className="text-sm text-purple-800 space-y-1">
                        <p>• <strong>Goal:</strong> Build awareness and encourage early registration</p>
                        <p>• <strong>Tone:</strong> Exciting and informative</p>
                        <p>• <strong>Include:</strong> Webinar topic, date/time, key takeaways, registration link</p>
                        <p>• <strong>Example:</strong> "Join us next week for our live webinar on [Topic]! Learn practical strategies for [key benefit]. Register now → [link]"</p>
                      </div>
                    </div>
                  )}
                  
                  {initialPost?.contentType === 'webinar-1day' && (
                    <div className="bg-white p-3 rounded border border-purple-200 mt-2">
                      <div className="font-medium text-purple-900 mb-1">⏰ 1 Day Before - Urgency Post</div>
                      <div className="text-sm text-purple-800 space-y-1">
                        <p>• <strong>Goal:</strong> Create urgency for last-minute registrations</p>
                        <p>• <strong>Tone:</strong> Urgent but friendly</p>
                        <p>• <strong>Include:</strong> "Tomorrow!" emphasis, time reminder, last chance to register</p>
                        <p>• <strong>Example:</strong> "Tomorrow at 2 PM EST! Don't miss our webinar on [Topic]. Last chance to register → [link]"</p>
                      </div>
                    </div>
                  )}
                  
                  {initialPost?.contentType === 'webinar-1hour' && (
                    <div className="bg-white p-3 rounded border border-purple-200 mt-2">
                      <div className="font-medium text-purple-900 mb-1">🚀 1 Hour Before - "Starting Soon!"</div>
                      <div className="text-sm text-purple-800 space-y-1">
                        <p>• <strong>Goal:</strong> Remind registered participants and catch walk-ins</p>
                        <p>• <strong>Tone:</strong> Exciting and immediate</p>
                        <p>• <strong>Include:</strong> "Starting in 1 hour!", join link, what to expect</p>
                        <p>• <strong>Example:</strong> "Starting in 1 hour! Join us live for [Topic]. Not registered yet? There's still time! → [link]"</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-purple-700 bg-purple-100 p-2 rounded">
                    <strong>💡 Pro Tips:</strong> Include registration link, use eye-catching images, tag relevant Mental Armor skills, schedule posts for optimal engagement times
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEO Keywords Panel */}
          {showKeywords && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-purple-100">
                <div className="flex items-center gap-2">
                  <Tag size={20} className="text-purple-600" />
                  <span className="font-semibold text-purple-900">SEO Keywords & Skills</span>
                </div>
                <button onClick={() => setShowKeywords(false)} className="text-purple-600 hover:text-purple-800">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">🎯 Recommended SEO Keywords:</h4>
                  <div className="flex flex-wrap gap-2">
                    {SEO_KEYWORDS.map((keyword, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          navigator.clipboard.writeText(keyword);
                          alert(`Copied: ${keyword}`);
                        }}
                        className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs hover:bg-purple-200 transition-colors"
                        title="Click to copy"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-purple-700 mt-2">Click any keyword to copy. Naturally include 2-3 in your post.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">🛡️ Mental Armor Skills:</h4>
                  <div className="flex flex-wrap gap-2">
                    {MENTAL_ARMOR_SKILLS.map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-purple-700 mt-2">Use these in your tags field if relevant to your content.</p>
                </div>
              </div>
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

