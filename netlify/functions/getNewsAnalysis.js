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
  NEWS_QUERY: process.env.NEWS_QUERY || 'mental health OR psychological health OR resilience training OR employee wellbeing OR workplace mental health OR police mental health OR firefighter mental health OR military mental health OR veteran mental health OR school mental health OR university mental health OR corporate mental health OR government mental health OR community mental health',
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

function generateFallbackAnalysis(newsData) {
  const articles = newsData.articles || [];
  const corporateArticles = articles.filter(a => 
    a.title.toLowerCase().includes('corporate') || 
    a.title.toLowerCase().includes('workplace') || 
    a.title.toLowerCase().includes('employee') ||
    a.title.toLowerCase().includes('hr')
  );
  const communityArticles = articles.filter(a => 
    a.title.toLowerCase().includes('city') || 
    a.title.toLowerCase().includes('county') || 
    a.title.toLowerCase().includes('state') ||
    a.title.toLowerCase().includes('municipal') ||
    a.title.toLowerCase().includes('community')
  );
  const educationArticles = articles.filter(a => 
    a.title.toLowerCase().includes('school') || 
    a.title.toLowerCase().includes('university') || 
    a.title.toLowerCase().includes('college') ||
    a.title.toLowerCase().includes('student') ||
    a.title.toLowerCase().includes('education')
  );
  const firstResponderArticles = articles.filter(a => 
    a.title.toLowerCase().includes('police') || 
    a.title.toLowerCase().includes('firefighter') || 
    a.title.toLowerCase().includes('ems') ||
    a.title.toLowerCase().includes('first responder') ||
    a.title.toLowerCase().includes('emergency')
  );
  const defenseArticles = articles.filter(a => 
    a.title.toLowerCase().includes('military') || 
    a.title.toLowerCase().includes('defense') || 
    a.title.toLowerCase().includes('veteran') ||
    a.title.toLowerCase().includes('army') ||
    a.title.toLowerCase().includes('navy') ||
    a.title.toLowerCase().includes('air force')
  );
  const federalArticles = articles.filter(a => 
    a.title.toLowerCase().includes('federal') || 
    a.title.toLowerCase().includes('government') || 
    a.title.toLowerCase().includes('agency') ||
    a.title.toLowerCase().includes('department')
  );

  const summary = `Found ${articles.length} relevant US articles across six key sectors: ${corporateArticles.length} corporate/HR initiatives, ${communityArticles.length} municipal/community programs, ${educationArticles.length} education sector developments, ${firstResponderArticles.length} first responder programs, ${defenseArticles.length} military/defense initiatives, and ${federalArticles.length} federal agency programs.`;

  const priorities = [];
  if (corporateArticles.length > 0) {
    priorities.push({
      title: 'Corporate Mental Health Programs',
      action: 'Review corporate wellness trends and HR initiatives',
      urgency: 'medium'
    });
  }
  if (communityArticles.length > 0) {
    priorities.push({
      title: 'Municipal Mental Health Funding',
      action: 'Monitor city/county mental health budget allocations',
      urgency: 'high'
    });
  }
  if (educationArticles.length > 0) {
    priorities.push({
      title: 'Education Sector Mental Health',
      action: 'Track K12 and higher education mental health programs',
      urgency: 'medium'
    });
  }
  if (firstResponderArticles.length > 0) {
    priorities.push({
      title: 'First Responder Mental Health',
      action: 'Monitor police, fire, and EMS psychological health programs',
      urgency: 'high'
    });
  }
  if (defenseArticles.length > 0) {
    priorities.push({
      title: 'Military/Defense Mental Health',
      action: 'Track military and veteran mental health initiatives',
      urgency: 'high'
    });
  }
  if (federalArticles.length > 0) {
    priorities.push({
      title: 'Federal Agency Mental Health',
      action: 'Monitor federal government mental health programs',
      urgency: 'medium'
    });
  }

  return {
    executiveSummary: summary,
    topPriorities: priorities,
    newsOpportunities: articles.slice(0, 3).map(article => ({
      headline: article.title,
      relevance: 'Relevant to mental health and resilience training market',
      action: 'Review for potential market opportunities'
    })),
    marketTrends: [
      {
        trend: 'Growing focus on workplace mental health',
        impact: 'Increased demand for corporate resilience training',
        recommendation: 'Develop corporate wellness program offerings'
      }
    ]
  };
}

async function getNewsAIInsights(newsData) {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackAnalysis(newsData);
  }

  const systemPrompt = `
You are a market intelligence analyst for 49 North (Mental Armor™), specializing in psychological health and resilience training across education, corporate, and community sectors.

Analyze the news data and return JSON with:
- executiveSummary: Brief overview of market opportunities and trends
- topPriorities: Array of {title, action, urgency} for market engagement
- newsOpportunities: Array of {headline, relevance, action} for specific opportunities
- marketTrends: Array of {trend, impact, recommendation} for market insights

Focus on:
- K12 and Higher Education mental health programs and student resilience initiatives
- Corporate HR programs for employee wellbeing, psychological health, and workplace resilience
- City, county, and state funding for community mental health services
- First responder mental health challenges and psychological health programs (police, fire, EMS)
- Military and defense department mental health initiatives and veteran programs
- Federal agency mental health programs and government employee wellbeing
- Educational psychology services and school-based mental health programs
- Corporate wellness trends and employee assistance programs
- Municipal mental health initiatives and community resilience programs
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
    console.log('[NewsAI] Using fallback analysis due to timeout or error');
    return generateFallbackAnalysis(newsData);
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
