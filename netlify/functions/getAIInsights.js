const { google } = require('googleapis');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event, context) => {
  console.log('Function started');
  
  try {
    console.log('Authenticating with Google...');
    
    // Authenticate with Google Sheets
    const serviceAccountKey = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
    );

    console.log('Creating auth...');
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Fetching data from sheets...');
    // Fetch data from all sheets - now including ALL columns to get status
    const [bidsData, webinarData] = await Promise.all([
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        ranges: ['Active_Bids!A2:Z', 'Submitted!A2:Z', 'Disregarded!A2:Z']
      }),
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: process.env.WEBINAR_SHEET_ID,
        ranges: ['Webinars!A2:L', 'Survey_Responses!A2:L', 'Registrations!A2:F']
      })
    ]);

    console.log('Data fetched successfully. Parsing...');
    
    // Parse the data
    const activeBids = parseBids(bidsData.data.valueRanges[0].values || []);
    const submittedBids = parseBids(bidsData.data.valueRanges[1].values || []);
    const disregardedBids = parseBids(bidsData.data.valueRanges[2].values || []);
    const webinars = parseWebinars(webinarData.data.valueRanges[0].values || []);
    const surveys = parseSurveys(webinarData.data.valueRanges[1].values || []);
    const registrations = parseRegistrations(webinarData.data.valueRanges[2].values || []);

    console.log(`Parsed: ${activeBids.length} active bids, ${submittedBids.length} submitted, ${webinars.length} webinars, ${surveys.length} surveys, ${registrations.length} registrations`);

    // Extract contact leads from surveys - ONLY those who requested contact
    console.log('Extracting contact leads...');
    const contactLeads = extractContactLeads(surveys, registrations);
    console.log(`Found ${contactLeads.length} contact leads`);

    // Filter bids with "Respond" status
    const respondBids = activeBids.filter(bid => 
      bid.status && bid.status.toLowerCase().includes('respond')
    );
    console.log(`Found ${respondBids.length} bids with "Respond" status`);

    // Fetch relevant news articles
    console.log('Fetching news articles...');
    const newsArticles = await fetchRelevantNews();
    console.log(`Found ${newsArticles.length} news articles`);

    // Aggregate and analyze
    console.log('Aggregating data...');
    const aggregatedData = {
      timestamp: new Date().toISOString(),
      summary: {
        activeBidsCount: activeBids.length,
        respondBidsCount: respondBids.length,
        submittedBidsCount: submittedBids.length,
        disregardedBidsCount: disregardedBids.length,
        completedWebinars: webinars.filter(w => w.status === 'Completed').length,
        upcomingWebinars: webinars.filter(w => w.status === 'Upcoming').length,
        totalSurveyResponses: surveys.length,
        contactRequests: contactLeads.length,
        totalRegistrations: registrations.length
      },
      
      // Priority bids - only those with "Respond" status
      priorityBids: respondBids.slice(0, 10).map(bid => ({
        solicitation: bid.solicitation,
        agency: bid.agency,
        title: bid.title,
        dueDate: bid.dueDate,
        status: bid.status,
        setAside: bid.setAside,
        naics: bid.naics
      })),
      
      // Contact leads - only those who requested contact
      contactLeads: contactLeads,
      
      // News articles for business development
      newsArticles: newsArticles,
      
      // Cross-operation insights
      organizations: identifyOrganizations(activeBids, registrations, surveys),
      
      // Engagement patterns
      engagement: {
        topDomains: getTopDomains(surveys),
        webinarTrends: getWebinarTrends(webinars, surveys),
        bidPatterns: getBidPatterns(activeBids, submittedBids)
      },
      
      // Opportunities
      opportunities: {
        urgentBids: activeBids.filter(b => {
          const daysUntilDue = Math.ceil((new Date(b.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
          return daysUntilDue <= 7 && daysUntilDue > 0;
        }).map(b => ({
          solicitation: b.solicitation,
          agency: b.agency,
          title: b.title,
          dueDate: b.dueDate,
          status: b.status,
          daysRemaining: Math.ceil((new Date(b.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
        }))
      },
      
      // Recent activity
      recentActivity: {
        lastWebinar: webinars.filter(w => w.status === 'Completed').sort((a, b) => new Date(b.date) - new Date(a.date))[0],
        recentContactRequests: contactLeads.slice(0, 5),
        newBids: activeBids.filter(b => {
          const addedDate = new Date(b.dateAdded || b.discovered);
          const daysSinceAdded = (new Date() - addedDate) / (1000 * 60 * 60 * 24);
          return daysSinceAdded <= 7;
        }).length
      }
    };

    console.log('Aggregation complete. Calling OpenAI...');

    // Call OpenAI for strategic insights with timeout protection
    let insights;
    try {
      console.log('Starting OpenAI API call...');
      
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a strategic business analyst for 49 North, a mental health training company specializing in Mental Armor™ programs for government agencies and organizations.

CRITICAL RULES:

**BIDS ARE COMPLETELY SEPARATE FROM WEBINARS/CONTACTS:**
- Bids = incoming government contract opportunities (from SAM.gov)
- Webinars/Surveys = marketing/engagement activities
- DO NOT connect bids to webinar attendees or survey respondents
- DO NOT suggest that webinar engagement indicates bid alignment
- Priority bids are determined SOLELY by their "Respond" status in the spreadsheet

**YOUR ROLE:**
1. Analyze priority bids (status="Respond") and suggest response strategies
2. Content strategy - what webinar topics resonate
3. Business development - analyze news articles for opportunities
4. Risk identification - operational concerns

Provide insights in this JSON structure:
{
  "executiveSummary": "2-3 sentence overview of bid pipeline, webinar engagement, and market opportunities",
  "topPriorities": [
    {"title": "Priority name", "description": "Why this matters", "action": "Specific next step", "urgency": "high/medium/low"}
  ],
  "bidRecommendations": [
    {"solicitation": "Bid number", "agency": "Agency name", "reason": "Why prioritize (based on bid details, NOT webinars)", "action": "Next step to respond", "dueDate": "date"}
  ],
  "contentInsights": {
    "topPerforming": "What webinar content drives engagement",
    "suggestions": "Topics to try based on survey feedback"
  },
  "newsOpportunities": [
    {"headline": "Article headline", "relevance": "How this creates opportunity for 49 North", "action": "Suggested next step"}
  ],
  "riskAlerts": [
    {"issue": "What's concerning", "impact": "Business impact", "mitigation": "How to address"}
  ]
}

DO NOT mention webinar engagement when discussing bids. They are separate business activities.`
            },
            {
              role: "user",
              content: `Analyze this operational data and provide strategic insights:

${JSON.stringify(aggregatedData, null, 2)}

Current date: ${new Date().toISOString().split('T')[0]}

Focus on:
1. Priority bids with "Respond" status - suggest response strategies based on bid details
2. Content strategy for webinars based on survey feedback
3. Business development opportunities from news articles
4. Operational risks

DO NOT connect bids to webinar attendees. They are separate activities.`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 2000
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout after 25 seconds')), 25000)
        )
      ]);

      console.log('OpenAI API call completed');
      insights = JSON.parse(completion.choices[0].message.content);
      
    } catch (openaiError) {
      console.error('OpenAI API Error:', openaiError);
      
      // Return a fallback response if OpenAI fails
      insights = {
        executiveSummary: "AI analysis temporarily unavailable. Manual review recommended.",
        topPriorities: [
          {
            title: "Review Priority Bids",
            description: `${aggregatedData.respondBidsCount} bids marked as "Respond" need review`,
            action: "Prioritize bids with upcoming deadlines",
            urgency: "high"
          }
        ],
        bidRecommendations: respondBids.slice(0, 3).map(bid => ({
          solicitation: bid.solicitation,
          agency: bid.agency,
          reason: `Marked as "Respond" in tracking system`,
          action: "Review requirements and assess fit",
          dueDate: bid.dueDate
        })),
        contentInsights: {
          topPerforming: "Webinar data available in Webinar Operations",
          suggestions: "Review survey feedback for content ideas"
        },
        newsOpportunities: newsArticles.slice(0, 3).map(article => ({
          headline: article.title,
          relevance: "Potential business development opportunity",
          action: "Review article and assess relevance"
        })),
        riskAlerts: []
      };
    }

    console.log('Preparing response...');
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        insights,
        contactLeads: contactLeads.slice(0, 15), // Top 15 contact leads (only those who requested contact)
        priorityBids: respondBids.slice(0, 10), // Top 10 bids with "Respond" status
        newsArticles: newsArticles,
        aggregatedData: {
          summary: aggregatedData.summary,
          opportunities: aggregatedData.opportunities,
          organizations: aggregatedData.organizations.slice(0, 10)
        },
        generatedAt: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error generating AI insights:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};

// Helper function to fetch relevant news
async function fetchRelevantNews() {
  try {
    const response = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent('mental health training government OR resilience training military OR law enforcement mental health programs')}&hl=en-US&gl=US&ceid=US:en`);
    
    if (!response.ok) {
      console.log('News fetch failed, returning empty array');
      return [];
    }

    const xml = await response.text();
    
    // Parse RSS feed (simple extraction)
    const articles = [];
    const itemRegex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null && articles.length < 5) {
      articles.push({
        title: match[1],
        link: match[2],
        pubDate: match[3],
        source: 'Google News'
      });
    }
    
    console.log(`Parsed ${articles.length} news articles`);
    return articles;
    
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

// Helper functions
function parseBids(rows) {
  if (!rows) return [];
  return rows.map(row => ({
    status: row[0] || '', // Column A - Recommendation/Status
    solicitation: row[1],
    agency: row[2],
    title: row[3],
    dueDate: row[4],
    discovered: row[5],
    dateAdded: row[6],
    setAside: row[7],
    naics: row[8],
    placeOfPerformance: row[9],
    link: row[10] || ''
  }));
}

function parseWebinars(rows) {
  if (!rows) return [];
  return rows.map(row => ({
    id: row[0],
    title: row[1],
    date: row[2],
    time: row[3],
    status: row[6],
    registrationCount: parseInt(row[8]) || 0,
    attendanceCount: parseInt(row[9]) || 0
  }));
}

function parseSurveys(rows) {
  if (!rows) return [];
  return rows.map(row => ({
    timestamp: row[0],
    email: row[1],
    webinarId: row[2],
    relevance: row[3],
    rhonda: row[4],
    chris: row[5],
    guest: row[6],
    sharing: row[7],
    attending: row[8],
    contactRequest: row[9],
    comments: row[10]
  }));
}

function parseRegistrations(rows) {
  if (!rows) return [];
  return rows.map(row => ({
    timestamp: row[0],
    webinarId: row[1],
    name: row[2],
    email: row[3],
    organization: row[4],
    phone: row[5]
  }));
}

// Extract contact leads - ONLY those who requested contact
function extractContactLeads(surveys, registrations) {
  const leads = new Map();
  
  // ONLY surveys with explicit contact requests
  surveys.forEach(survey => {
    const email = survey.email?.toLowerCase().trim();
    if (!email) return;
    
    const wantsContact = survey.contactRequest?.toLowerCase().includes('yes');
    
    // ONLY include if they requested contact
    if (wantsContact) {
      if (!leads.has(email)) {
        // Find registration info for this email
        const reg = registrations.find(r => r.email?.toLowerCase().trim() === email);
        
        leads.set(email, {
          email: survey.email,
          name: reg?.name || 'Unknown',
          organization: reg?.organization || 'Unknown',
          phone: reg?.phone || '',
          score: 50, // Base score for requesting contact
          factors: ['Requested Contact'],
          comments: survey.comments || '',
          lastActivity: survey.timestamp
        });
      }
    }
  });
  
  // Count multiple webinar attendance to boost score
  const attendanceCounts = new Map();
  registrations.forEach(reg => {
    const email = reg.email?.toLowerCase().trim();
    if (email) {
      attendanceCounts.set(email, (attendanceCounts.get(email) || 0) + 1);
    }
  });
  
  leads.forEach((lead, email) => {
    const count = attendanceCounts.get(email) || 0;
    if (count >= 2) {
      lead.score += 30 * (count - 1);
      lead.factors.push(`${count} Webinars Attended`);
    }
    
    // Boost for leaving comments
    if (lead.comments && lead.comments.trim().length > 10) {
      lead.score += 20;
      lead.factors.push('Left Detailed Comments');
    }
  });
  
  return Array.from(leads.values())
    .sort((a, b) => b.score - a.score);
}

function identifyOrganizations(bids, registrations, surveys) {
  const orgs = new Map();
  
  // From bids
  bids.forEach(bid => {
    const key = bid.agency?.toLowerCase().trim();
    if (key && key.length > 2) {
      if (!orgs.has(key)) orgs.set(key, { name: bid.agency, sources: new Set(), count: 0 });
      orgs.get(key).sources.add('bid');
      orgs.get(key).count++;
    }
  });
  
  // From registrations
  registrations.forEach(reg => {
    const key = reg.organization?.toLowerCase().trim();
    if (key && key.length > 2) {
      if (!orgs.has(key)) orgs.set(key, { name: reg.organization, sources: new Set(), count: 0 });
      orgs.get(key).sources.add('webinar');
      orgs.get(key).count++;
    }
  });
  
  return Array.from(orgs.values())
    .filter(org => org.sources.size > 1)
    .map(org => ({ ...org, sources: Array.from(org.sources) }))
    .sort((a, b) => b.count - a.count);
}

function getTopDomains(surveys) {
  const domains = {};
  surveys.forEach(s => {
    if (s.email) {
      const domain = s.email.split('@')[1]?.toLowerCase();
      if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
        domains[domain] = (domains[domain] || 0) + 1;
      }
    }
  });
  
  return Object.entries(domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));
}

function getWebinarTrends(webinars, surveys) {
  const completed = webinars.filter(w => w.status === 'Completed');
  const totalAttendance = completed.reduce((sum, w) => sum + w.attendanceCount, 0);
  
  return {
    avgAttendance: Math.round(totalAttendance / completed.length) || 0,
    avgResponseRate: totalAttendance > 0 ? Math.round((surveys.length / totalAttendance) * 100) : 0,
    totalCompleted: completed.length,
    totalAttendance
  };
}

function getBidPatterns(activeBids, submittedBids) {
  const total = activeBids.length + submittedBids.length;
  return {
    active: activeBids.length,
    submitted: submittedBids.length,
    conversionRate: total > 0 ? Math.round((submittedBids.length / total) * 100) : 0
  };
}