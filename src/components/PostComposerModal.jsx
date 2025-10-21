// src/components/PostComposerModal.jsx
import React, { useState, useMemo, useRef } from 'react';
import { X, Send, Save, Eye, Image as ImageIcon, Video, Calendar, Tag, AlertCircle, Info, ChevronDown, ChevronUp, Upload, Loader } from 'lucide-react';
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
    purpose: 'general',
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

  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPagination, setMediaPagination] = useState(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const fileInputRef = useRef(null);

  // Load initial post data when provided (for reusing posts)
  React.useEffect(() => {
    if (initialPost && isOpen) {
      const platformsFromPost = (initialPost.platforms || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      
      // Auto-set purpose based on contentType if provided
      let autoPurpose = initialPost.purpose || 'general';
      if (initialPost.contentType === 'monday-weekly') autoPurpose = 'weekly-monday';
      if (initialPost.contentType === 'wednesday-weekly') autoPurpose = 'weekly-wednesday';
      if (initialPost.contentType === 'friday-weekly') autoPurpose = 'weekly-friday';
      if (initialPost.contentType === 'webinar-1week') autoPurpose = 'webinar-1week';
      if (initialPost.contentType === 'webinar-1day') autoPurpose = 'webinar-1day';
      if (initialPost.contentType === 'webinar-1hour') autoPurpose = 'webinar-1hour';
      
      setFormData({
        title: initialPost.title || '',
        body: initialPost.body || initialPost.text || '',
        contentType: initialPost.contentType || 'announcement',
        purpose: autoPurpose,
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
        createdBy: 'user',
        webinarId: initialPost.webinarId || '',
        webinarTitle: initialPost.webinarTitle || '',
        webinarDate: initialPost.webinarDate || '',
        webinarTime: initialPost.webinarTime || ''
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

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });

      const base64Data = reader.result;

      // Upload to WordPress
      const response = await fetch('/.netlify/functions/uploadImageToWordPress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: base64Data,
          filename: file.name,
          mimeType: file.type
        })
      });

      const result = await response.json();

      if (result.success) {
        // Set the WordPress-hosted URL
        setFormData(prev => ({ ...prev, imageUrl: result.url }));
        alert(`✅ Image uploaded! (${(result.filesize / 1024).toFixed(1)}KB)`);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadMediaLibrary = async (page = 1, search = '') => {
    setLoadingMedia(true);
    try {
      let url = `/.netlify/functions/getWordPressMedia?per_page=24&page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setMediaLibrary(result.media || []);
        setMediaPagination(result.pagination);
      } else {
        console.error('Failed to load media:', result.error);
      }
    } catch (err) {
      console.error('Media library error:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleMediaSearch = () => {
    setMediaPage(1);
    loadMediaLibrary(1, mediaSearch);
  };

  const handleMediaPageChange = (newPage) => {
    setMediaPage(newPage);
    loadMediaLibrary(newPage, mediaSearch);
  };

  const handleSelectFromLibrary = (imageUrl) => {
    setFormData(prev => ({ ...prev, imageUrl }));
    setShowMediaLibrary(false);
  };

  // Load media library when shown
  React.useEffect(() => {
    if (showMediaLibrary && mediaLibrary.length === 0) {
      loadMediaLibrary(1, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMediaLibrary]);

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
      purpose: 'general',
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
          {(formData.contentType === 'webinar' || (typeof initialPost?.contentType === 'string' && initialPost.contentType.includes('webinar'))) && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Calendar size={24} className="text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 mb-2">
                    🎥 Webinar Social Post Tips
                    {initialPost?.webinarTitle && typeof initialPost.webinarTitle === 'string' && (
                      <span className="block text-sm font-normal text-purple-700 mt-1">
                        For: {initialPost.webinarTitle} ({initialPost.webinarDate || 'TBA'} at {initialPost.webinarTime || 'TBA'})
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
                    <ImageIcon size={16} className="inline mr-1" />
                    Image
                  </label>
                  
                  {/* Image Upload Buttons */}
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload Image
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setShowMediaLibrary(!showMediaLibrary)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <ImageIcon size={16} />
                      Media Library
                    </button>
                  </div>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {/* Image URL Input (manual entry) */}
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="Or paste image URL (Google Drive links auto-convert)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  
                  {/* Image Preview */}
                  {formData.imageUrl && (
                    <div className="mt-2 relative">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-full max-w-sm rounded border border-gray-300"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  
                  {/* Media Library Modal */}
                  {showMediaLibrary && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">WordPress Media Library</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMediaLibrary(false);
                            setMediaSearch('');
                            setMediaPage(1);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Search */}
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={mediaSearch}
                          onChange={(e) => setMediaSearch(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleMediaSearch()}
                          placeholder="Search images by name..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleMediaSearch}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Search
                        </button>
                      </div>

                      {/* Pagination Info */}
                      {mediaPagination && (
                        <div className="text-xs text-gray-600 mb-2">
                          Showing {((mediaPagination.page - 1) * mediaPagination.perPage) + 1}-
                          {Math.min(mediaPagination.page * mediaPagination.perPage, mediaPagination.totalItems)} of {mediaPagination.totalItems} items
                        </div>
                      )}
                      
                      {/* Media Grid */}
                      <div className="max-h-80 overflow-y-auto">
                        {loadingMedia ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader className="animate-spin text-blue-600" size={32} />
                          </div>
                        ) : mediaLibrary.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">
                            {mediaSearch ? 'No images found. Try a different search.' : 'No images in library. Upload one first!'}
                          </p>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {mediaLibrary.map(media => (
                              <div
                                key={media.id}
                                onClick={() => handleSelectFromLibrary(media.url)}
                                className="relative cursor-pointer group hover:ring-2 hover:ring-blue-500 rounded transition-all"
                                title={media.title}
                              >
                                <img
                                  src={media.thumbnail}
                                  alt={media.title}
                                  className="w-full h-24 object-cover rounded border border-gray-300"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all rounded flex flex-col items-center justify-center">
                                  <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold mb-1">
                                    Select
                                  </span>
                                  <span className="text-white opacity-0 group-hover:opacity-100 text-[10px] px-2 text-center">
                                    {media.title.substring(0, 30)}{media.title.length > 30 ? '...' : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pagination Controls */}
                      {mediaPagination && mediaPagination.totalPages > 1 && (
                        <div className="mt-3 pt-3 border-t border-gray-300 flex items-center justify-between">
                          <div className="text-xs text-gray-600">
                            Page {mediaPagination.page} of {mediaPagination.totalPages}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleMediaPageChange(mediaPage - 1)}
                              disabled={mediaPage <= 1}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              ← Prev
                            </button>
                            
                            {/* Page numbers */}
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(5, mediaPagination.totalPages) }, (_, i) => {
                                let pageNum;
                                if (mediaPagination.totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (mediaPage <= 3) {
                                  pageNum = i + 1;
                                } else if (mediaPage >= mediaPagination.totalPages - 2) {
                                  pageNum = mediaPagination.totalPages - 4 + i;
                                } else {
                                  pageNum = mediaPage - 2 + i;
                                }
                                
                                return (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => handleMediaPageChange(pageNum)}
                                    className={`px-2 py-1 rounded text-xs ${
                                      pageNum === mediaPage
                                        ? 'bg-blue-600 text-white font-semibold'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleMediaPageChange(mediaPage + 1)}
                              disabled={mediaPage >= mediaPagination.totalPages}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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

              {/* Post Purpose */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Tag size={16} className="inline mr-1" />
                  Post Purpose (Reminder Tracking)
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="general">General Content (No requirement)</option>
                  <optgroup label="Weekly Social Posts">
                    <option value="weekly-monday">📅 Weekly - Monday (Resilience Content)</option>
                    <option value="weekly-wednesday">📅 Weekly - Wednesday (Follow-up)</option>
                    <option value="weekly-friday">📅 Weekly - Friday (CTA/Learn More)</option>
                  </optgroup>
                  <optgroup label="Webinar Social Posts">
                    <option value="webinar-1week">🎥 Webinar - 1 Week Before</option>
                    <option value="webinar-1day">🎥 Webinar - 1 Day Before</option>
                    <option value="webinar-1hour">🎥 Webinar - 1 Hour Before</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select purpose to track this post against reminder requirements. "General Content" won't fulfill any reminders.
                </p>
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

