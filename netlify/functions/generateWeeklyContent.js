// netlify/functions/generateWeeklyContent.js
// AI-powered weekly content generation for 49 North social media

const { google } = require('googleapis');
const OpenAI = require('openai');
const { corsHeaders, methodGuard, ok, bad, checkAuth, safeJson } = require('./_utils/http');
const { getGoogleAuth } = require('./_utils/google');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Config ----
const CFG = {
  OPENAI_MODEL: 'gpt-4o', // High quality model
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS ?? '1800', 10), // Reduced for speed
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS ?? '24000', 10), // 24s timeout (2s buffer)
  
  GOOGLE_TIMEOUT_MS: parseInt(process.env.GOOGLE_TIMEOUT_MS ?? '6000', 10),
  SHEET_ID: process.env.GOOGLE_SHEET_ID,
};

// Mental Armor Skills Database
const MENTAL_ARMOR_SKILLS = {
  'Foundations of Resilience': {
    module: 'Foundation, Values & Meaning, Resilient Thinking, Social Resilience',
    goal: 'Learn how resilience helps us withstand, recover, and grow — and why understanding its foundations is essential to mental strength and endurance.',
    benefits: [
      'Clarifies what resilience is and how it shows up in everyday life',
      'Builds a shared language and understanding around resilience concepts',
      'Corrects common myths about resilient people',
      'Explains neuroplasticity and how resilience changes the brain',
      'Introduces growth mindset and how it drives long-term development'
    ]
  },
  'Flex Your Strengths': {
    module: 'Values & Meaning',
    goal: 'Identify and apply your character strengths at work and at home—and notice and appreciate strengths in yourself and others.',
    benefits: [
      'Increased energy and performance',
      'Greater confidence and happiness',
      'Stronger relationships',
      'Greater ability to live your values and reach goals',
      'Reduced stress; more meaning and purpose'
    ]
  },
  'Values Based Living': {
    module: 'Values & Meaning',
    goal: 'Provide a sense of purpose and meaning by focusing on your core values.',
    benefits: [
      'Clear sense of direction and purpose',
      'Better alignment between actions and values',
      'Reduced stress from conflicting priorities',
      'Greater motivation and follow-through'
    ]
  },
  'Spiritual Resilience': {
    module: 'Values & Meaning',
    goal: 'Identify the beliefs, principles, and values that sustain well-being, purpose, and hope.',
    benefits: [
      'Inspires optimism and belief in growth',
      'Enables acceptance and positive perseverance through adversity',
      'Strengthens relationships and connection to others',
      'Supports deeper meaning, purpose, and transcendence'
    ]
  },
  'Cultivate Gratitude': {
    module: 'Values & Meaning',
    goal: 'Build optimism and positive emotions by deliberately paying attention to good things.',
    benefits: [
      'Improved sleep',
      'Progress on goals',
      'Stronger social relationships',
      'Lower risk of depression, anxiety, and loneliness',
      'Better coping with hassles and stress'
    ]
  },
  'Mindfulness': {
    module: 'Resilient Thinking',
    goal: 'Reduce stress and distraction; stay focused, calm, and engaged.',
    benefits: [
      'Greater optimism and confidence',
      'Stronger relationships',
      'Higher life satisfaction and well-being',
      'Better physical health'
    ]
  },
  'ReFrame': {
    module: 'Resilient Thinking',
    goal: 'Recognize how thoughts drive emotions and behavior; reframe to take more productive action.',
    benefits: [
      'Improved performance',
      'Alignment with personal values',
      'Stronger relationships',
      'Greater ability to achieve goals'
    ]
  },
  'Balance Your Thinking': {
    module: 'Resilient Thinking',
    goal: 'See situations accurately and act based on evidence.',
    benefits: [
      'Improved performance',
      'Alignment with values',
      'Stronger relationships',
      'Greater ability to achieve goals'
    ]
  },
  'What\'s Most Important': {
    module: 'Resilient Thinking',
    goal: 'Notice when old habits/"shoulds" hijack your thinking; refocus on what truly matters right now.',
    benefits: [
      'Improved performance',
      'Alignment with personal values',
      'Stronger relationships',
      'Greater ability to achieve goals'
    ]
  },
  'Interpersonal Problem Solving': {
    module: 'Social Resilience',
    goal: 'Address problems in a way that shows respect, lowers intensity, and leads to a solution both parties can live with.',
    benefits: [
      'Builds and strengthens relationships',
      'Builds optimism',
      'Helps achieve goals',
      'Supports acting on values',
      'Enables proactive problem solving'
    ]
  },
  'Good Listening & Celebrate Good News': {
    module: 'Social Resilience',
    goal: 'Build, strengthen, and maintain important relationships.',
    benefits: [
      'Stronger relationships',
      'Builds positive emotions',
      'Lays a foundation for times when support is needed'
    ]
  }
};

// Company Information
const COMPANY_INFO = {
  name: '49 North, a division of TechWerks, LLC',
  description: 'TechWerks, LLC is a Service-Disabled Veteran-Owned Small Business (SDVOSB) founded in 2009, specializing in comprehensive consulting services for federal, state, local, and international government agencies. Our core capabilities span healthcare information technology, training and curriculum development, program management and consulting, research and evaluation services, and general government operations support.',
  website: 'https://www.mymentalarmor.com',
  companyWebsite: 'https://www.techwerks-llc.com',
  hashtags: ['#Resilience', '#Leadership', '#MentalArmor', '#49North', '#Wellbeing', '#VUCA']
};

exports.handler = async (event) => {
  console.log('[GenerateWeeklyContent] Handler called with method:', event.httpMethod);
  
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) {
    console.log('[GenerateWeeklyContent] Method guard failed:', guard);
    return guard;
  }

  try {
    console.log('[GenerateWeeklyContent] Step 1: Parsing body...');
    const [body, parseError] = safeJson(event.body);
    if (parseError) {
      console.log('[GenerateWeeklyContent] JSON parse error:', parseError);
      return bad(headers, 'Invalid JSON body: ' + parseError.message);
    }
    if (!body) {
      console.log('[GenerateWeeklyContent] Empty body');
      return bad(headers, 'Empty request body');
    }

    console.log('[GenerateWeeklyContent] Step 2: Extracting parameters...');
    const { dayType, customPrompt } = body;

    if (!dayType) {
      console.log('[GenerateWeeklyContent] Missing dayType');
      return bad(headers, 'dayType is required');
    }

    console.log('[GenerateWeeklyContent] Step 3: dayType =', dayType, 'customPrompt =', customPrompt ? 'provided' : 'null');

    console.log('[GenerateWeeklyContent] Step 4: Getting recent posts from Google Sheets...');
    const recentPosts = await getRecentPosts();
    console.log('[GenerateWeeklyContent] Step 5: Retrieved', recentPosts.length, 'recent posts');

    // Generate content based on day type
    console.log('[GenerateWeeklyContent] Step 6: Generating AI content...');
    let suggestions;
    if (dayType === 'custom' && customPrompt && customPrompt.trim()) {
      console.log('[GenerateWeeklyContent] Using custom content generation');
      suggestions = await generateCustomContent(customPrompt, recentPosts);
    } else {
      console.log('[GenerateWeeklyContent] Using day-specific content generation');
      suggestions = await generateDaySpecificContent(dayType, recentPosts);
    }

    console.log('[GenerateWeeklyContent] Step 7: Generated', suggestions.length, 'suggestion(s)');

    return ok(headers, {
      success: true,
      suggestions,
      context: {
        dayType,
        customPrompt: customPrompt || null,
        recentPostsReviewed: recentPosts.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[GenerateWeeklyContent] Error:', error);
    console.error('[GenerateWeeklyContent] Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate content',
        details: error.message,
        stack: error.stack
      })
    };
  }
};

async function getRecentPosts() {
  try {
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CFG.SHEET_ID,
      range: 'MainPostData!A2:U', // A2:U to skip header row
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return []; // No data

    // Get last 10 posts (rows already exclude header since we used A2:U)
    // Columns: A=timestamp, B=status, C=contentType, D=title, E=body, F=imageUrl, G=videoUrl, 
    //          H=platforms, I=scheduleDate, J=publishedDate, K=postPermalink, L=facebookPostId,
    //          M=linkedInPostId, N=wordPressPostId, O=brevoEmailId, P=analytics, Q=createdBy,
    //          R=tags, S=Purpose, T=Webinar ID, U=Webinar Title
    const recentPosts = rows.slice(0, 10).map(row => ({
      timestamp: row[0] || '',
      status: row[1] || '',
      contentType: row[2] || '',
      title: row[3] || '',
      body: row[4] || '',
      platforms: row[7] || '',
      purpose: row[18] || '', // Column S (index 18)
      publishedDate: row[9] || '',
      tags: row[17] || ''
    })).filter(post => post.title && post.body);

    return recentPosts;
  } catch (error) {
    console.warn('[GenerateWeeklyContent] Could not fetch recent posts:', error.message);
    return [];
  }
}

async function generateDaySpecificContent(dayType, recentPosts) {
  const skillNames = Object.keys(MENTAL_ARMOR_SKILLS);
  const randomSkill = skillNames[Math.floor(Math.random() * skillNames.length)];
  const skill = MENTAL_ARMOR_SKILLS[randomSkill];

  let systemPrompt, userPrompt;

  switch (dayType) {
    case 'monday':
      systemPrompt = `You are a content strategist for 49 North, a division of TechWerks, LLC, specializing in resilience training and mental strength development. Generate 1 social media post suggestion for Monday - Resilience Skill Spotlight day.`;
      
      userPrompt = `Create 1 high-quality post suggestion for Monday's resilience skill spotlight. Focus on the skill: "${randomSkill}".

SKILL DETAILS:
- Goal: ${skill.goal}
- Benefits: ${skill.benefits.join(', ')}

COMPANY CONTEXT:
- Company: ${COMPANY_INFO.name}
- Website: ${COMPANY_INFO.website}
- Description: ${COMPANY_INFO.description}

RECENT POSTS CONTEXT:
${recentPosts.slice(0, 5).map(post => `- ${post.title}: ${post.body.substring(0, 100)}...`).join('\n')}

REQUIREMENTS:
1. START with an engaging QUESTION that targets organizational leaders
2. Keep post SHORT (150-250 words max - LinkedIn ideal length)
3. Provide 2-3 SPECIFIC, ACTIONABLE tips for teams/organizations
4. Focus on workplace/team applications (not individual self-help)
5. Include relevant hashtags: ${COMPANY_INFO.hashtags.join(', ')}
6. End with clear CTA to www.mymentalarmor.com

FORMAT: Return ONLY a valid JSON array (NO markdown blocks).
[
  {
    "title": "Engaging post title",
    "content": "CONVERSATION STARTER QUESTION?\n\n[2-3 short paragraphs with 2-3 actionable tips for teams]\n\n[CTA to website]\n\n[Hashtags]",
    "hashtags": ["#Tag1", "#Tag2"],
    "imageSuggestion": {"type": "Photo", "description": "Brief description", "mood": "Professional", "searchTerms": "keywords"}
  }
]
Provide 1 object (150-250 words total).`;

      break;

    case 'wednesday':
      systemPrompt = `You are a content strategist for 49 North, a division of TechWerks, LLC. Generate 1 social media post suggestion for Wednesday - Follow-up & Deeper Dive day.`;
      
      userPrompt = `Create 1 high-quality post suggestion for Wednesday's follow-up content. Build on Monday's resilience concept with deeper insights.

MONDAY'S POST (QUOTE THIS DIRECTLY):
${recentPosts.find(post => post.purpose?.includes('monday') || post.purpose?.includes('weekly-monday'))?.body || 'No recent Monday post found - proceed with generic resilience follow-up'}

REQUIREMENTS:
1. START with a QUESTION related to Monday's post
2. QUOTE or REFERENCE a specific phrase from Monday's post above
3. Keep post SHORT (150-250 words max)
4. Provide 2-3 actionable tips for teams to apply Monday's concept
5. Target organizational leaders/teams (not individuals)
6. End with CTA to www.mymentalarmor.com
7. Include hashtags: ${COMPANY_INFO.hashtags.join(', ')}

FORMAT: Return ONLY a valid JSON array (NO markdown blocks).
[
  {
    "title": "Title connecting to Monday",
    "content": "QUESTION?\n\n[Reference Monday's specific point]\n\n[2-3 actionable tips for teams]\n\n[CTA]\n\n[Hashtags]",
    "hashtags": ["#Tag1", "#Tag2"],
    "imageSuggestion": {"type": "Photo", "description": "Brief", "mood": "Professional", "searchTerms": "keywords"}
  }
]
Provide 1 object (150-250 words).`;

      break;

    case 'friday':
      systemPrompt = `You are a content strategist for 49 North, a division of TechWerks, LLC. Generate 1 social media post suggestion for Friday - Call to Action day.`;
      
      userPrompt = `Create 1 high-quality post suggestion for Friday's call-to-action content. Synthesize the week's themes into a compelling CTA.

WEEK'S POSTS:
Monday: ${recentPosts.find(post => post.purpose?.includes('monday'))?.body || 'No Monday post'}
Wednesday: ${recentPosts.find(post => post.purpose?.includes('wednesday'))?.body || 'No Wednesday post'}

REQUIREMENTS:
1. START with a QUESTION for organizational leaders
2. REFERENCE both Monday + Wednesday themes briefly
3. Keep post SHORT (150-250 words max)
4. Position 49 North as the solution for teams
5. Strong CTA to www.mymentalarmor.com
6. Include hashtags: ${COMPANY_INFO.hashtags.join(', ')}

FORMAT: Return ONLY a valid JSON array (NO markdown blocks).
[
  {
    "title": "CTA title",
    "content": "QUESTION?\n\n[Tie Monday+Wednesday together]\n\n[What 49 North offers teams]\n\n[Strong CTA]\n\n[Hashtags]",
    "hashtags": ["#Tag1", "#Tag2"],
    "imageSuggestion": {"type": "Photo", "description": "Brief", "mood": "Professional", "searchTerms": "keywords"}
  }
]
Provide 1 object (150-250 words).`;

      break;

    default:
      throw new Error(`Invalid dayType: ${dayType}`);
  }

  return await callOpenAI(systemPrompt, userPrompt);
}

async function generateCustomContent(customPrompt, recentPosts) {
  const systemPrompt = `You are a content strategist for 49 North, a division of TechWerks, LLC, specializing in resilience training and mental strength development. Generate 1 social media post suggestion based on the user's custom request.`;
  
  const userPrompt = `Create 1 high-quality post suggestion based on this custom request: "${customPrompt}"

COMPANY CONTEXT:
- Company: ${COMPANY_INFO.name}
- Website: ${COMPANY_INFO.website}
- Description: ${COMPANY_INFO.description}

RECENT POSTS CONTEXT:
${recentPosts.slice(0, 5).map(post => `- ${post.title}: ${post.body.substring(0, 100)}...`).join('\n')}

REQUIREMENTS:
1. START with an engaging QUESTION for organizational leaders
2. Keep post SHORT (150-250 words max)
3. Provide 2-3 actionable tips for teams/organizations
4. Follow custom theme while targeting workplace applications
5. Include hashtags: ${COMPANY_INFO.hashtags.join(', ')}
6. End with CTA to www.mymentalarmor.com

FORMAT: Return ONLY a valid JSON array (NO markdown blocks).
[
  {
    "title": "Engaging title",
    "content": "QUESTION?\n\n[2-3 paragraphs with actionable tips for teams]\n\n[CTA]\n\n[Hashtags]",
    "hashtags": ["#Tag1", "#Tag2"],
    "imageSuggestion": {"type": "Photo", "description": "Brief", "mood": "Professional", "searchTerms": "keywords"}
  }
]
Provide 1 object (150-250 words).`;

  return await callOpenAI(systemPrompt, userPrompt);
}

async function callOpenAI(systemPrompt, userPrompt) {
  try {
    console.log('[GenerateWeeklyContent] Calling OpenAI with model:', CFG.OPENAI_MODEL, 'max_tokens:', CFG.OPENAI_MAX_TOKENS);
    
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: CFG.OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: CFG.OPENAI_TEMPERATURE,
        max_tokens: CFG.OPENAI_MAX_TOKENS,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timed out after 20s')), CFG.OPENAI_TIMEOUT_MS)
      )
    ]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated by OpenAI');
    }

    // Strip markdown code blocks if present (OpenAI sometimes wraps JSON in ```json ... ```)
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      // Remove opening ```json and closing ```
      cleanedContent = cleanedContent
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
    }

    console.log('[GenerateWeeklyContent] Cleaned OpenAI response:', cleanedContent.substring(0, 200) + '...');

    // Parse JSON response
    const suggestions = JSON.parse(cleanedContent);
    
    // Validate and clean up suggestions
    return suggestions.map((suggestion, index) => ({
      id: index + 1,
      title: suggestion.title || `Suggestion ${index + 1}`,
      content: suggestion.content || suggestion.linkedinPost || suggestion.facebookPost || suggestion.blogPost || '',
      linkedinPost: suggestion.content || suggestion.linkedinPost || '', // For backward compatibility
      facebookPost: suggestion.content || suggestion.facebookPost || '', // For backward compatibility
      blogPost: suggestion.content || suggestion.blogPost || '', // For backward compatibility
      hashtags: Array.isArray(suggestion.hashtags) ? suggestion.hashtags : [],
      imageSuggestion: suggestion.imageSuggestion || {
        type: 'Photo',
        description: 'Professional workplace or resilience-themed image',
        mood: 'Professional, inspiring',
        searchTerms: 'workplace resilience, professional development, mental strength'
      }
    }));

  } catch (error) {
    console.error('[GenerateWeeklyContent] OpenAI error:', error);
    throw new Error(`OpenAI generation failed: ${error.message}`);
  }
}
