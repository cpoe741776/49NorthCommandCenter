// netlify/functions/getNewsAnalysis.js
// AI analysis focused on relevant news and market opportunities

const OpenAI = require('openai');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CFG = {
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '4000', 10),
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '20000', 10),
  NEWS_TIMEOUT_MS: parseInt(process.env.NEWS_TIMEOUT_MS ?? '8000', 10),
  NEWS_QUERY: process.env.NEWS_QUERY || '(corporate mental health OR workplace mental health OR employee wellbeing OR HR mental health) OR (police mental health OR firefighter mental health OR first responder mental health OR EMS mental health) OR (military mental health OR veteran mental health OR defense mental health OR army mental health) OR (school mental health OR university mental health OR student mental health OR education mental health) OR (city mental health OR county mental health OR state mental health OR municipal mental health) OR (federal mental health OR government mental health OR agency mental health OR department mental health)',
  NEWS_MAX: parseInt(process.env.NEWS_MAX ?? '10', 10),
};

async function withTimeout(promise, label, ms) {
  const timer = setTimeout(() => console.warn(`[Timeout] ${label} > ${ms}ms`), ms + 1);
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms))
    ]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if ((err?.message || '').includes('timeout')) {
      console.warn(`[Timeout] ${label} hit timeout`);
      return null;
    }
    throw err;
  }
}

function sanitize(s) {
  return (s || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

async function fetchRelevantNews(query, limit) {
  try {
    // Search US only
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await withTimeout(fetch(url), 'newsFetch-US', CFG.NEWS_TIMEOUT_MS);
    if (!res || !res.ok) return [];
    const xml = await res.text();

    const items = [];
    const regexes = [
      /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
      /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g
    ];

    for (let rx of regexes) {
      let m;
      while ((m = rx.exec(xml)) && items.length < limit * 2) {
        items.push({
          title: sanitize(m[1]),
          link: sanitize(m[2]),
          pubDate: sanitize(m[3]),
          source: 'Google News',
          region: 'US'
        });
      }
      if (items.length) break;
    }

    // Process and deduplicate articles
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
    const seen = new Map();
    
    for (const article of items) {
      const key = (article.link || article.title).trim();
      const ts = Date.parse(article.pubDate || '') || 0;
      if (ts > 0 && ts < cutoff) continue;
      const prev = seen.get(key);
      if (!prev || ts > (Date.parse(prev.pubDate || '') || 0)) {
        seen.set(key, article);
      }
    }
    
    return Array.from(seen.values())
      .sort((a, b) => Date.parse(b.pubDate || '') - Date.parse(a.pubDate || ''))
      .slice(0, limit);
      
  } catch (e) {
    console.error('[News] Fetch error:', e?.message);
    return [];
  }
}

// Removed AI analysis - just return articles directly

// Removed AI analysis function - no longer needed

exports.handler = async (event, context) => {
  const started = Date.now();
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;
  if (!checkAuth(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    // Fetch relevant news
    const newsArticles = await fetchRelevantNews(CFG.NEWS_QUERY, CFG.NEWS_MAX);

    if (!newsArticles || newsArticles.length === 0) {
      return ok(headers, {
        articles: [],
        timestamp: new Date().toISOString(),
        summary: { totalArticles: 0, recentArticles: 0 },
        note: 'No news articles found',
        processingTime: `${Date.now() - started}ms`,
        section: 'news'
      });
    }

    const articles = newsArticles.map(article => ({
      title: article.title,
      link: article.link,
      publishedAt: article.pubDate,
      source: article.source,
      region: article.region,
      daysAgo: Math.floor((Date.now() - Date.parse(article.pubDate || '')) / (1000 * 60 * 60 * 24))
    }));

    return ok(headers, {
      articles,
      timestamp: new Date().toISOString(),
      summary: {
        totalArticles: articles.length,
        recentArticles: articles.filter(article => article.daysAgo <= 30).length
      },
      processingTime: `${Date.now() - started}ms`,
      section: 'news'
    });

  } catch (e) {
    console.error('[NewsAnalysis] Error:', e?.message);
    return ok(headers, {
      articles: [],
      timestamp: new Date().toISOString(),
      summary: { totalArticles: 0, recentArticles: 0 },
      error: e?.message || 'Unknown error',
      processingTime: `${Date.now() - started}ms`,
      section: 'news'
    });
  }
};
