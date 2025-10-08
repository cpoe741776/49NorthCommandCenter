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

    console.log('Aggregation complete. Calling OpenAI for comprehensive analysis...');

    // Call OpenAI for strategic insights with extended timeout for comprehensive analysis
    let insights;
    try {
      console.log('Starting OpenAI API call (comprehensive analysis)...');
      
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
Provide comprehensive, actionable strategic analysis covering:
1. Detailed bid prioritization with specific reasoning for each "Respond" status bid
2. In-depth content strategy analysis based on webinar engagement patterns
3. Business development opportunities from news articles with specific action plans
4. Risk identification with detailed mitigation strategies
5. Cross-operational insights and patterns

Be thorough and specific. This analysis is reviewed once or twice daily, so depth matters more than brevity.

Provide insights in this JSON structure:
{
  "executiveSummary": "3-4 sentence comprehensive overview of bid pipeline, webinar engagement, contact leads, market opportunities, and key risks",
  "topPriorities": [
    {"title": "Priority name", "description": "Detailed explanation of why this matters", "action": "Specific, actionable next steps", "urgency": "high/medium/low"}
  ],
  "bidRecommendations": [
    {"solicitation": "Bid number", "agency": "Agency name", "reason": "Detailed reasoning for prioritization based on bid specifics", "action": "Detailed next steps for response", "dueDate": "date"}
  ],
  "contentInsights": {
    "topPerforming": "Detailed analysis of what webinar content drives the most engagement and why",
    "suggestions": "Specific topic recommendations based on patterns in survey feedback, engagement data, and industry trends"
  },
  "newsOpportunities": [
    {"headline": "Article headline", "relevance": "Detailed explanation of how this creates opportunity for 49 North", "action": "Specific action plan to capitalize on this opportunity"}
  ],
  "riskAlerts": [
    {"issue": "Detailed description of the concern", "impact": "Specific business impact", "mitigation": "Detailed mitigation strategy with steps"}
  ]
}

DO NOT mention webinar engagement when discussing bids. They are separate business activities.`
            },
            {
              role: "user",
              content: `Analyze this operational data comprehensively and provide detailed strategic insights:

${JSON.stringify(aggregatedData, null, 2)}

Current date: ${new Date().toISOString().split('T')[0]}

Provide detailed analysis on:
1. Priority bids with "Respond" status - detailed response strategies for each
2. Content strategy - what's working in webinars and why, with specific recommendations
3. Contact leads - patterns and follow-up priorities (${aggregatedData.contactLeads.length} leads identified)
4. Business development - how to leverage the ${newsArticles.length} news articles found
5. Operational risks - what needs attention and specific mitigation plans
6. Cross-operational patterns - connections between different data sources

This is a comprehensive daily review, so be thorough and specific.`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 3000
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout after 60 seconds')), 60000)
        )
      ]);

      console.log('OpenAI API call completed successfully');
      insights = JSON.parse(completion.choices[0].message.content);
      
    } catch (openaiError) {
      console.error('OpenAI API Error:', openaiError);
      console.error('This was a comprehensive analysis attempt - consider retrying');
      
      // Return a detailed fallback response if OpenAI fails
      insights = {
        executiveSummary: `AI analysis temporarily unavailable. Current status: ${aggregatedData.summary.respondBidsCount} priority bids marked "Respond", ${aggregatedData.contactLeads.length} hot contact leads identified, ${newsArticles.length} relevant news articles found. Manual comprehensive review recommended.`,
        topPriorities: [
          {
            title: "Review Priority Bids for Response",
            description: `${aggregatedData.summary.respondBidsCount} bids marked as "Respond" require detailed review and response preparation. These represent immediate business opportunities.`,
            action: "Review each bid's requirements, assess alignment with 49 North's capabilities, and begin response preparation for bids with nearest deadlines",
            urgency: "high"
          },
          {
            title: "Follow Up with Hot Contact Leads",
            description: `${aggregatedData.contactLeads.length} webinar attendees have either requested immediate contact or asked for 3-month reminders. These are warm leads showing interest in Mental Armor™ programs.`,
            action: "Review contact lead details in Dashboard, prioritize by score, and initiate personalized follow-up communications",
            urgency: "high"
          },
          {
            title: "Analyze Market Opportunities from News",
            description: `${newsArticles.length} recent news articles about mental health training, resilience programs, and related topics have been identified. These may reveal new opportunities or partnerships.`,
            action: "Review each article for potential leads, grant opportunities, or market trends relevant to 49 North's services",
            urgency: "medium"
          }
        ],
        bidRecommendations: respondBids.slice(0, 5).map(bid => ({
          solicitation: bid.solicitation,
          agency: bid.agency,
          reason: `Marked as "Respond" in tracking system. ${bid.naics ? `NAICS: ${bid.naics}. ` : ''}${bid.setAside ? `Set-Aside: ${bid.setAside}. ` : ''}Review full requirements to assess strategic fit.`,
          action: `Review solicitation details, assess capability alignment, gather necessary documentation, and prepare tailored response highlighting 49 North's Mental Armor™ expertise`,
          dueDate: bid.dueDate
        })),
        contentInsights: {
          topPerforming: `Based on ${aggregatedData.summary.totalSurveyResponses} survey responses from ${aggregatedData.summary.completedWebinars} completed webinars, engagement metrics available in Webinar Operations`,
          suggestions: "Review detailed survey feedback to identify patterns in attendee interests, pain points, and requested topics. Consider trends in mental health training and resilience building for future webinar themes."
        },
        newsOpportunities: newsArticles.slice(0, 5).map(article => ({
          headline: article.title,
          relevance: "Potential business development opportunity - article may reveal new market needs, grant opportunities, or organizations seeking mental health training programs",
          action: "Review article content, identify key stakeholders mentioned, and assess relevance to 49 North's service offerings"
        })),
        riskAlerts: aggregatedData.summary.respondBidsCount === 0 ? [
          {
            issue: "No active bids currently marked for response",
            impact: "Potential gap in business pipeline and future revenue",
            mitigation: "Increase bid monitoring frequency, review 'Gather Info' status bids for potential advancement, and actively search for new opportunities aligned with 49 North's expertise"
          }
        ] : []
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
    console.log('Attempting to fetch news...');
    
    const response = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent('mental health training government OR resilience training military OR law enforcement mental health programs')}&hl=en-US&gl=US&ceid=US:en`);
    
    if (!response.ok) {
      console.log(`News fetch failed with status: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    console.log(`Fetched XML length: ${xml.length} characters`);
    
    // Log first 500 characters to see format
    console.log('XML preview:', xml.substring(0, 500));
    
    // Try multiple regex patterns
    const articles = [];
    
    // Pattern 1: Standard RSS with CDATA
    let itemRegex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null && articles.length < 5) {
      articles.push({
        title: match[1],
        link: match[2],
        pubDate: match[3],
        source: 'Google News'
      });
    }
    
    // Pattern 2: Try without CDATA if pattern 1 didn't work
    if (articles.length === 0) {
      console.log('Trying alternative RSS pattern...');
      itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;
      
      while ((match = itemRegex.exec(xml)) !== null && articles.length < 5) {
        articles.push({
          title: match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          link: match[2],
          pubDate: match[3],
          source: 'Google News'
        });
      }
    }
    
    console.log(`Successfully parsed ${articles.length} news articles`);
    return articles;
    
  } catch (error) {
    console.error('Error fetching news:', error);
    console.error('Error stack:', error.stack);
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

// Extract contact leads - ONLY those who requested contact OR want a reminder
function extractContactLeads(surveys, registrations) {
  const leads = new Map();
  
  console.log(`Processing ${surveys.length} surveys for contact requests`);
  
  // Surveys with contact requests OR reminder requests
  surveys.forEach((survey, idx) => {
    const email = survey.email?.toLowerCase().trim();
    if (!email) return;
    
    const contactRequestValue = survey.contactRequest;
    
    // Check if they want immediate contact OR a 3-month reminder
    const wantsContact = contactRequestValue && String(contactRequestValue).toLowerCase().includes('yes');
    const wantsReminder = contactRequestValue && String(contactRequestValue).includes('🟢 Drop me a reminder in 3 months or so');
    
    // Debug first few surveys
    if (idx < 5) {
      console.log(`Survey ${idx}: email=${survey.email}, contactRequest="${contactRequestValue}", wantsContact=${wantsContact}, wantsReminder=${wantsReminder}`);
    }
    
    // Include if they requested contact OR want a reminder
    if (wantsContact || wantsReminder) {
      if (!leads.has(email)) {
        // Find registration info for this email
        const reg = registrations.find(r => r.email?.toLowerCase().trim() === email);
        
        leads.set(email, {
          email: survey.email,
          name: reg?.name || 'Unknown',
          organization: reg?.organization || 'Unknown',
          phone: reg?.phone || '',
          score: 0,
          factors: [],
          comments: survey.comments || '',
          lastActivity: survey.timestamp
        });
      }
      
      const lead = leads.get(email);
      
      if (wantsContact) {
        lead.score += 50;
        lead.factors.push('Requested Contact');
      }
      
      if (wantsReminder) {
        lead.score += 30;
        lead.factors.push('Wants 3-Month Reminder');
      }
    }
  });
  
  console.log(`After contact/reminder filter: ${leads.size} leads`);
  
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