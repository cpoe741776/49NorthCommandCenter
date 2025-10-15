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
  NEWS_QUERY: process.env.NEWS_QUERY || 'mental health training government OR resilience training military OR law enforcement mental health programs',
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
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await withTimeout(fetch(url), 'newsFetch', CFG.NEWS_TIMEOUT_MS);
    if (!res) return [];
    if (!res.ok) return [];
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
          source: 'Google News'
        });
      }
      if (items.length) break;
    }

    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
    const seen = new Map();
    for (const it of items) {
      const key = (it.link || it.title).trim();
      const ts = Date.parse(it.pubDate || '') || 0;
      if (ts > 0 && ts < cutoff) continue;
      const prev = seen.get(key);
      if (!prev || ts > (Date.parse(prev.pubDate || '') || 0)) {
        seen.set(key, it);
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

async function getNewsAIInsights(newsData) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: 'AI analysis unavailable (no API key configured).',
      topPriorities: [],
      newsOpportunities: [],
      marketTrends: []
    };
  }

  const systemPrompt = `
You are a market intelligence analyst for 49 North (Mental Armor™), specializing in government contracting opportunities and resilience training market trends.

Analyze the news data and return JSON with:
- executiveSummary: Brief overview of market opportunities and trends
- topPriorities: Array of {title, action, urgency} for market engagement
- newsOpportunities: Array of {headline, relevance, action} for specific opportunities
- marketTrends: Array of {trend, impact, recommendation} for market insights

Focus on:
- Government contracting opportunities
- Mental health and resilience training trends
- Military and law enforcement programs
- Policy changes affecting your market
`.trim();

  const userPrompt = `
CURRENT_DATE: ${new Date().toISOString().split('T')[0]}
NEWS DATA:
${JSON.stringify(newsData, null, 2)}
`.trim();

  try {
    const res = await Promise.race([
      openai.chat.completions.create({
        model: CFG.OPENAI_MODEL,
        temperature: CFG.OPENAI_TEMPERATURE,
        max_tokens: CFG.OPENAI_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout')), CFG.OPENAI_TIMEOUT_MS))
    ]);
    const txt = res.choices?.[0]?.message?.content || '{}';
    return JSON.parse(txt);
  } catch (err) {
    console.error('[NewsAI] OpenAI failed:', err.message);
    return {
      executiveSummary: 'AI analysis unavailable. News data processed below.',
      topPriorities: [],
      newsOpportunities: [],
      marketTrends: []
    };
  }
}

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
        executiveSummary: 'No relevant news found in the last 90 days.',
        topPriorities: [],
        newsOpportunities: [],
        marketTrends: [],
        timestamp: new Date().toISOString(),
        summary: { totalArticles: 0, recentArticles: 0 },
        note: 'No news articles found',
        processingTime: `${Date.now() - started}ms`,
        section: 'news'
      });
    }

    const newsDataForAI = {
      summary: {
        totalArticles: newsArticles.length,
        recentArticles: newsArticles.filter(article => {
          const daysAgo = Math.floor((Date.now() - Date.parse(article.pubDate || '')) / (1000 * 60 * 60 * 24));
          return daysAgo <= 30;
        }).length
      },
      articles: newsArticles.map(article => ({
        title: article.title,
        link: article.link,
        publishedAt: article.pubDate,
        source: article.source,
        daysAgo: Math.floor((Date.now() - Date.parse(article.pubDate || '')) / (1000 * 60 * 60 * 24))
      }))
    };

    // AI analysis
    const aiInsights = await getNewsAIInsights(newsDataForAI);

    return ok(headers, {
      ...aiInsights,
      timestamp: new Date().toISOString(),
      summary: newsDataForAI.summary,
      articles: newsDataForAI.articles,
      processingTime: `${Date.now() - started}ms`,
      section: 'news'
    });

  } catch (e) {
    console.error('[NewsAnalysis] Error:', e?.message);
    return ok(headers, {
      executiveSummary: 'News analysis unavailable due to technical issues.',
      topPriorities: [],
      newsOpportunities: [],
      marketTrends: [],
      timestamp: new Date().toISOString(),
      summary: { totalArticles: 0, recentArticles: 0 },
      error: e?.message || 'Unknown error',
      processingTime: `${Date.now() - started}ms`,
      section: 'news'
    });
  }
};
