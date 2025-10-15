// src/services/separateAnalysisService.js
// Service for loading separate AI analysis sections

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { etag, ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ 
      etag: '', 
      ts: Date.now(), 
      data 
    }));
  } catch {}
}

async function fetchAnalysisSection(section, bypassCache = false) {
  const cacheKey = `analysis.${section}.v1`;
  
  if (!bypassCache) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch(`/.netlify/functions/get${section.charAt(0).toUpperCase() + section.slice(1)}Analysis`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(window.__APP_TOKEN && { 'X-App-Token': window.__APP_TOKEN })
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    writeCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`[${section}Analysis] Error:`, error);
    throw error;
  }
}

export async function fetchBidsAnalysis(bypassCache = false) {
  return fetchAnalysisSection('bids', bypassCache);
}

export async function fetchWebinarAnalysis(bypassCache = false) {
  return fetchAnalysisSection('webinars', bypassCache);
}

export async function fetchSocialAnalysis(bypassCache = false) {
  return fetchAnalysisSection('social', bypassCache);
}

export async function fetchNewsAnalysis(bypassCache = false) {
  return fetchAnalysisSection('news', bypassCache);
}

export async function fetchAllAnalysis(bypassCache = false) {
  const sections = ['bids', 'webinars', 'social', 'news'];
  const results = {};
  
  // Load all sections in parallel
  const promises = sections.map(async (section) => {
    try {
      results[section] = await fetchAnalysisSection(section, bypassCache);
    } catch (error) {
      results[section] = { 
        error: error.message,
        executiveSummary: `${section} analysis unavailable`,
        section 
      };
    }
  });
  
  await Promise.all(promises);
  return results;
}
