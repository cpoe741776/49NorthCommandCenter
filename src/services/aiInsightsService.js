// src/services/aiInsightsService.js
export const fetchAIInsights = async (bypassCache = false, { full = false } = {}) => {
  const base = '/.netlify/functions/getAIInsights';
  // Default to fast path unless explicitly asking for full
  const qs = [];
  if (!full) qs.push('fast=1');
  if (bypassCache) qs.push(`t=${Date.now()}`);
  const url = `${base}${qs.length ? `?${qs.join('&')}` : ''}`;

  try {
    console.log(full ? 'Fetching full insights:' : 'Fetching fast insights:', url);
    let res = await fetch(url);

    // If full analysis times out or service unavailable, fall back to fast mode
    if ((res.status === 504 || res.status === 503) && full) {
      const fastUrl = `${base}?fast=1&t=${Date.now()}`;
      console.warn(`[AI] Full analysis failed (${res.status}). Falling back to fast: ${fastUrl}`);
      res = await fetch(fastUrl);
    }

    if (!res.ok) throw new Error('Failed to fetch AI insights');
    return await res.json();
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    throw error;
  }
};
