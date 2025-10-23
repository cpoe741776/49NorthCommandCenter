// src/components/AIContentAssistant.jsx
// AI-powered weekly content generation assistant

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Copy, Check, Calendar, MessageSquare, Target, Lightbulb } from 'lucide-react';

const AIContentAssistant = ({ onUseSuggestion }) => {
  const [dayType, setDayType] = useState('monday');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [mentalArmorSkills, setMentalArmorSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  const dayTypeOptions = [
    { value: 'monday', label: 'Monday - Resilience Skill Spotlight', icon: Lightbulb },
    { value: 'wednesday', label: 'Wednesday - Follow-Up & Deeper Dive', icon: MessageSquare },
    { value: 'friday', label: 'Friday - Call to Action', icon: Target },
    { value: 'custom', label: 'Custom Theme...', icon: Calendar }
  ];

  // Fetch Mental Armor Skills from backend
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('/.netlify/functions/getMentalArmorSkills');
        const data = await response.json();
        
        if (data.success && data.skills) {
          setMentalArmorSkills(data.skills);
          console.log('[AIContentAssistant] Loaded', data.skills.length, 'Mental Armor skills');
        } else {
          console.warn('[AIContentAssistant] Failed to load skills:', data.error);
          if (data.availableTabs) {
            console.log('[AIContentAssistant] Available tabs:', data.availableTabs);
          }
          // Fallback to empty array
          setMentalArmorSkills([]);
        }
      } catch (err) {
        console.error('[AIContentAssistant] Error fetching skills:', err);
        setMentalArmorSkills([]);
      } finally {
        setLoadingSkills(false);
      }
    };

    fetchSkills();
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuggestions(null);

    try {
      const appToken = window.__APP_TOKEN;
      if (!appToken) {
        throw new Error('Please log in to use AI content generation');
      }

      const response = await fetch('/.netlify/functions/generateWeeklyContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': appToken
        },
        body: JSON.stringify({
          dayType,
          selectedSkill: dayType === 'monday' && selectedSkill ? selectedSkill : null,
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

        {/* Skill Selector for Monday */}
        {dayType === 'monday' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💪 Skill to Focus On This Week
            </label>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              disabled={loadingSkills}
            >
              <option value="">🎲 Random Skill (Let AI Choose)</option>
              {mentalArmorSkills.map((skill) => (
                <option key={skill.skillTitle} value={skill.skillTitle}>
                  {skill.skillTitle}
                </option>
              ))}
            </select>
            {loadingSkills && (
              <p className="text-xs text-blue-600 mt-1">Loading skills from Google Sheet...</p>
            )}
            {!loadingSkills && mentalArmorSkills.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">No skills found. Please add skills to the MentalArmorSkills tab in your Google Sheet.</p>
            )}
            {!loadingSkills && mentalArmorSkills.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Choose a specific skill or leave blank for AI to pick randomly ({mentalArmorSkills.length} skills available)
              </p>
            )}
          </div>
        )}

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

                {/* Suggested Post Content */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-purple-900">
                      📝 Suggested Post for: {getDayTypeLabel(dayType)}
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(suggestion.content || suggestion.linkedinPost, `content-${suggestion.id}`)}
                      className="text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      {copiedId === `content-${suggestion.id}` ? (
                        <>
                          <Check size={16} />
                          <span className="text-xs">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-white rounded p-3 text-sm text-gray-800 whitespace-pre-wrap border border-purple-100">
                    {suggestion.content || suggestion.linkedinPost}
                  </div>
                  <p className="text-xs text-purple-700 mt-2">
                    💡 This content works for LinkedIn, Facebook, and Blog posts
                  </p>
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
