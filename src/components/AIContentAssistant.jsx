// src/components/AIContentAssistant.jsx
// AI-powered weekly content generation assistant

import React, { useState } from 'react';
import { Sparkles, Loader2, Copy, Check, Calendar, MessageSquare, Target, Lightbulb } from 'lucide-react';

const AIContentAssistant = ({ onUseSuggestion }) => {
  const [dayType, setDayType] = useState('monday');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const dayTypeOptions = [
    { value: 'monday', label: 'Monday - Resilience Skill Spotlight', icon: Lightbulb },
    { value: 'wednesday', label: 'Wednesday - Follow-Up & Deeper Dive', icon: MessageSquare },
    { value: 'friday', label: 'Friday - Call to Action', icon: Target },
    { value: 'custom', label: 'Custom Theme...', icon: Calendar }
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuggestions(null);

    try {
      const response = await fetch('/.netlify/functions/generateWeeklyContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': localStorage.getItem('appToken')
        },
        body: JSON.stringify({
          dayType,
          customPrompt: dayType === 'custom' ? customPrompt : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Server error (${response.status}): ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate content');
      }

      setSuggestions(data.suggestions);
    } catch (err) {
      console.error('AI Content Generation Error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseSuggestion = (suggestion) => {
    if (onUseSuggestion) {
      onUseSuggestion(suggestion);
    }
  };

  const handleCopyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getDayTypeLabel = (value) => {
    const option = dayTypeOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="text-purple-600" size={24} />
        <h2 className="text-xl font-bold text-gray-900">🤖 AI Weekly Content Assistant</h2>
      </div>

      <div className="space-y-4">
        {/* Day Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Content Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {dayTypeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setDayType(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    dayType === option.value
                      ? 'border-purple-500 bg-purple-100 text-purple-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Prompt Input */}
        {dayType === 'custom' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Custom Theme or Topic
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., 'Holiday stress and family resilience' or 'Year-end reflection and goal setting'"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
            />
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (dayType === 'custom' && !customPrompt.trim())}
          className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating Content...
            </>
          ) : (
            <>
              <Sparkles size={20} />
              Generate Post Suggestions
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error generating content:</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Suggestions Display */}
        {suggestions && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={16} />
              <span>Generated for: {getDayTypeLabel(dayType)}</span>
            </div>

            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{suggestion.title}</h3>
                  <button
                    onClick={() => handleUseSuggestion(suggestion)}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    Use This Suggestion
                  </button>
                </div>

                {/* Platform Versions */}
                <div className="space-y-3">
                  {/* LinkedIn */}
                  <div className="bg-blue-50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-900">LinkedIn</span>
                      <button
                        onClick={() => handleCopyToClipboard(suggestion.linkedinPost, `linkedin-${suggestion.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {copiedId === `linkedin-${suggestion.id}` ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="text-sm text-blue-800">{suggestion.linkedinPost}</p>
                  </div>

                  {/* Facebook */}
                  <div className="bg-blue-50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-900">Facebook</span>
                      <button
                        onClick={() => handleCopyToClipboard(suggestion.facebookPost, `facebook-${suggestion.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {copiedId === `facebook-${suggestion.id}` ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="text-sm text-blue-800">{suggestion.facebookPost}</p>
                  </div>

                  {/* Blog */}
                  <div className="bg-green-50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-green-900">Blog</span>
                      <button
                        onClick={() => handleCopyToClipboard(suggestion.blogPost, `blog-${suggestion.id}`)}
                        className="text-green-600 hover:text-green-800"
                      >
                        {copiedId === `blog-${suggestion.id}` ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="text-sm text-green-800 line-clamp-3">{suggestion.blogPost}</p>
                  </div>
                </div>

                {/* Hashtags */}
                {suggestion.hashtags && suggestion.hashtags.length > 0 && (
                  <div className="mt-3">
                    <span className="text-sm font-semibold text-gray-700">Hashtags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestion.hashtags.map((tag, index) => (
                        <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Suggestion */}
                {suggestion.imageSuggestion && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                    <span className="text-sm font-semibold text-yellow-900">Image Suggestion:</span>
                    <div className="mt-1 text-sm text-yellow-800">
                      <p><strong>Type:</strong> {suggestion.imageSuggestion.type}</p>
                      <p><strong>Description:</strong> {suggestion.imageSuggestion.description}</p>
                      <p><strong>Mood:</strong> {suggestion.imageSuggestion.mood}</p>
                      {suggestion.imageSuggestion.searchTerms && (
                        <p><strong>Search Terms:</strong> {suggestion.imageSuggestion.searchTerms}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIContentAssistant;
