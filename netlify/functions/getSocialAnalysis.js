// netlify/functions/getSocialAnalysis.js
// AI analysis focused on social media content and performance

const { google } = require('googleapis');
const OpenAI = require('openai');
const { corsHeaders, methodGuard, ok, checkAuth } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CFG = {
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '2000', 10),
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '20000', 10),
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '6000', 10),
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

function parseSocialPosts(rows) {
  if (!rows) return [];
  return rows.map((row) => ({
    timestamp: row[0] || '',
    status: row[1] || '',
    contentType: row[2] || '',
    title: row[3] || '',
    body: row[4] || '',
    imageUrl: row[5] || '',
    videoUrl: row[6] || '',
    platforms: row[7] || '',
    scheduleDate: row[8] || '',
    publishedDate: row[9] || '',
    tags: row[17] || ''
  }));
}

async function getSocialAIInsights(socialData) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: 'AI analysis unavailable (no API key configured).',
      topPriorities: [],
      contentInsights: {},
      platformRecommendations: []
    };
  }

  const systemPrompt = `
You are a social media strategist for 49 North (Mental Armor™), specializing in government contracting and resilience training.

Analyze the social media data and return JSON with:
- executiveSummary: Brief overview of social media performance and content strategy
- topPriorities: Array of {title, action, urgency} for social media strategy
- contentInsights: Object with {topPerforming, suggestions} for content optimization
- platformRecommendations: Array of {platform, recommendation, reasoning} for platform-specific strategies

Focus on:
- Content performance trends
- Platform optimization opportunities
- Publishing schedule effectiveness
- Content type performance
`.trim();

  const userPrompt = `
CURRENT_DATE: ${new Date().toISOString().split('T')[0]}
SOCIAL MEDIA DATA:
${JSON.stringify(socialData, null, 2)}
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
    console.error('[SocialAI] OpenAI failed:', err.message);
    return {
      executiveSummary: 'AI analysis unavailable. Data processed below.',
      topPriorities: [],
      contentInsights: {},
      platformRecommendations: []
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
    // Check if social media sheet is configured
    if (!process.env.SOCIAL_MEDIA_SHEET_ID) {
      return ok(headers, {
        executiveSummary: 'Social media analysis unavailable - no social media sheet configured.',
        topPriorities: [],
        contentInsights: {},
        platformRecommendations: [],
        timestamp: new Date().toISOString(),
        summary: { socialPostsTotal: 0, socialPostsPublished: 0, socialPostsDrafts: 0 },
        note: 'SOCIAL_MEDIA_SHEET_ID not configured',
        processingTime: `${Date.now() - started}ms`,
        section: 'social'
      });
    }

    // Google auth
    const googleAuth = getGoogleAuth();
    const auth = await googleAuth.getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch social media data
    const socialRanges = ['MainPostData!A2:R'];
    
    const socialData = await withTimeout(
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.SOCIAL_MEDIA_SHEET_ID,
        ranges: socialRanges
      }),
      'socialBatchGet',
      CFG.GOOGLE_TIMEOUT_MS
    );

    if (!socialData) {
      return ok(headers, {
        executiveSummary: 'Unable to fetch social media data.',
        timestamp: new Date().toISOString(),
        summary: { socialPostsTotal: 0, socialPostsPublished: 0, socialPostsDrafts: 0 },
        error: 'Data fetch failed'
      });
    }

    // Parse data
    const socialPosts = parseSocialPosts(socialData.data.valueRanges[0]?.values || []);

    // Basic analysis
    const publishedPosts = socialPosts.filter((p) => p.status === 'Published');
    const draftPosts = socialPosts.filter((p) => p.status === 'Draft');
    const scheduledPosts = socialPosts.filter((p) => p.status === 'Scheduled');

    // Platform analysis
    const platformCounts = {};
    socialPosts.forEach((post) => {
      const platforms = (post.platforms || '').split(',').map(p => p.trim()).filter(Boolean);
      platforms.forEach(platform => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });
    });

    // Content type analysis
    const contentTypeCounts = {};
    socialPosts.forEach((post) => {
      const type = post.contentType || 'Unknown';
      contentTypeCounts[type] = (contentTypeCounts[type] || 0) + 1;
    });

    const socialDataForAI = {
      summary: {
        socialPostsTotal: socialPosts.length,
        socialPostsPublished: publishedPosts.length,
        socialPostsDrafts: draftPosts.length,
        socialPostsScheduled: scheduledPosts.length
      },
      platformDistribution: Object.entries(platformCounts)
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count),
      contentTypeDistribution: Object.entries(contentTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      recentPosts: publishedPosts
        .sort((a, b) => new Date(b.publishedDate || b.timestamp) - new Date(a.publishedDate || a.timestamp))
        .slice(0, 10)
        .map(post => ({
          title: post.title,
          contentType: post.contentType,
          platforms: post.platforms,
          publishedDate: post.publishedDate || post.timestamp,
          tags: post.tags
        }))
    };

    // AI analysis
    const aiInsights = await getSocialAIInsights(socialDataForAI);

    // Fallback if AI times out or fails
    const finalInsights = aiInsights || {
      executiveSummary: 'AI analysis timed out. Basic metrics shown below.',
      topPriorities: [
        { title: 'Review recent post performance', action: 'Check platform distribution and engagement', urgency: 'medium' }
      ],
      contentInsights: {
        topPerforming: 'Unable to analyze - AI timeout',
        suggestions: 'Try refreshing analysis or check OpenAI API limits'
      },
      platformRecommendations: []
    };

    return ok(headers, {
      ...finalInsights,
      timestamp: new Date().toISOString(),
      summary: socialDataForAI.summary,
      platformDistribution: socialDataForAI.platformDistribution,
      contentTypeDistribution: socialDataForAI.contentTypeDistribution,
      recentPosts: socialDataForAI.recentPosts,
      processingTime: `${Date.now() - started}ms`,
      section: 'social',
      aiTimeout: !aiInsights
    });

  } catch (e) {
    console.error('[SocialAnalysis] Error:', e?.message);
    return ok(headers, {
      executiveSummary: 'Social media analysis unavailable due to technical issues.',
      topPriorities: [],
      contentInsights: {},
      platformRecommendations: [],
      timestamp: new Date().toISOString(),
      summary: { socialPostsTotal: 0, socialPostsPublished: 0, socialPostsDrafts: 0 },
      error: e?.message || 'Unknown error',
      processingTime: `${Date.now() - started}ms`,
      section: 'social'
    });
  }
};
