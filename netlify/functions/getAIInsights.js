const { google } = require('googleapis');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event, context) => {
  try {
    // Authenticate with Google Sheets
    const serviceAccountKey = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch data from all sheets
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

    // Parse the data
    const activeBids = parseBids(bidsData.data.valueRanges[0].values || []);
    const submittedBids = parseBids(bidsData.data.valueRanges[1].values || []);
    const disregardedBids = parseBids(bidsData.data.valueRanges[2].values || []);
    const webinars = parseWebinars(webinarData.data.valueRanges[0].values || []);
    const surveys = parseSurveys(webinarData.data.valueRanges[1].values || []);
    const registrations = parseRegistrations(webinarData.data.valueRanges[2].values || []);

    // Aggregate and analyze
    const aggregatedData = {
      timestamp: new Date().toISOString(),
      summary: {
        activeBidsCount: activeBids.length,
        submittedBidsCount: submittedBids.length,
        disregardedBidsCount: disregardedBids.length,
        completedWebinars: webinars.filter(w => w.status === 'Completed').length,
        upcomingWebinars: webinars.filter(w => w.status === 'Upcoming').length,
        totalSurveyResponses: surveys.length,
        contactRequests: surveys.filter(s => s.contactRequest?.toLowerCase().includes('yes')).length,
        totalRegistrations: registrations.length
      },
      
      // Cross-operation insights
      organizations: identifyOrganizations(activeBids, registrations, surveys),
      
      // Lead scoring
      leads: scoreLeads(registrations, surveys, activeBids),
      
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
        }),
        highEngagementNoContact: findHighEngagementLeads(surveys, registrations),
        crossOverOpportunities: findCrossOvers(activeBids, registrations)
      },
      
      // Recent activity
      recentActivity: {
        lastWebinar: webinars.filter(w => w.status === 'Completed').sort((a, b) => new Date(b.date) - new Date(a.date))[0],
        recentContactRequests: surveys.filter(s => s.contactRequest?.toLowerCase().includes('yes')).slice(-5),
        newBids: activeBids.filter(b => {
          const addedDate = new Date(b.dateAdded || b.discovered);
          const daysSinceAdded = (new Date() - addedDate) / (1000 * 60 * 60 * 24);
          return daysSinceAdded <= 7;
        })
      }
    };

    // Call OpenAI for strategic insights
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a strategic business analyst for 49 North, a mental health training company specializing in Mental Armor™ programs for government agencies and organizations.

Your role is to analyze operational data across bids, webinars, and marketing activities to provide actionable insights for sales and marketing.

Focus on:
1. Lead prioritization (hot leads = webinar engagement + contact request + active bid with that organization)
2. Cross-selling opportunities (organizations engaging in one area but not others)
3. Content strategy (which webinar topics drive highest engagement and conversions)
4. Timing optimization (when to follow up, best times for outreach)
5. Risk identification (declining engagement, missed opportunities)
6. Bid strategy (which opportunities to prioritize based on engagement data)

Provide insights in this JSON structure:
{
  "executiveSummary": "2-3 sentence overview of current state and key opportunities",
  "topPriorities": [
    {"title": "Priority name", "description": "Why this matters", "action": "Specific next step", "urgency": "high/medium/low"}
  ],
  "hotLeads": [
    {"organization": "Name", "reason": "Why they're hot (be specific)", "suggestedAction": "Concrete next step", "score": "numerical score"}
  ],
  "contentInsights": {
    "topPerforming": "What's working in webinar content",
    "suggestions": "Specific topics to try next based on survey feedback"
  },
  "riskAlerts": [
    {"issue": "What's concerning", "impact": "Potential business impact", "mitigation": "How to address"}
  ],
  "opportunityMapping": [
    {"type": "cross-sell/upsell/follow-up", "description": "The opportunity with specifics", "potential": "high/medium/low", "nextStep": "What to do"}
  ],
  "bidRecommendations": [
    {"solicitation": "Bid number", "agency": "Agency name", "reason": "Why prioritize this", "action": "Next step"}
  ]
}`
        },
        {
          role: "user",
          content: `Analyze this operational data and provide strategic insights:

${JSON.stringify(aggregatedData, null, 2)}

Current date: ${new Date().toISOString().split('T')[0]}

Provide actionable insights for the next 1-2 weeks focusing on highest-value opportunities. Be specific with organization names, bid numbers, and concrete actions.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2500
    });

    const insights = JSON.parse(completion.choices[0].message.content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        insights,
        aggregatedData: {
          summary: aggregatedData.summary,
          leads: aggregatedData.leads.slice(0, 10),
          opportunities: aggregatedData.opportunities,
          organizations: aggregatedData.organizations.slice(0, 10)
        },
        generatedAt: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error generating AI insights:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
};

// Helper functions
function parseBids(rows) {
  if (!rows) return [];
  return rows.map(row => ({
    solicitation: row[0],
    agency: row[1],
    title: row[2],
    dueDate: row[3],
    discovered: row[4],
    dateAdded: row[5],
    setAside: row[6],
    naics: row[7],
    placeOfPerformance: row[8]
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

function scoreLeads(registrations, surveys, bids) {
  const leadScores = new Map();
  
  // Score based on webinar attendance
  registrations.forEach(reg => {
    const key = reg.email?.toLowerCase().trim();
    if (!key) return;
    
    if (!leadScores.has(key)) {
      leadScores.set(key, {
        email: reg.email,
        name: reg.name,
        organization: reg.organization,
        score: 0,
        factors: []
      });
    }
    
    const lead = leadScores.get(key);
    lead.score += 10;
    lead.factors.push('webinar_registration');
  });
  
  // Boost for survey completion
  surveys.forEach(survey => {
    const key = survey.email?.toLowerCase().trim();
    if (!key) return;
    
    if (leadScores.has(key)) {
      const lead = leadScores.get(key);
      lead.score += 20;
      lead.factors.push('survey_response');
      
      // Extra boost for contact request
      if (survey.contactRequest?.toLowerCase().includes('yes')) {
        lead.score += 30;
        lead.factors.push('contact_request');
      }
    }
  });
  
  // Major boost if their organization has active bids
  bids.forEach(bid => {
    leadScores.forEach(lead => {
      if (lead.organization && bid.agency?.toLowerCase().includes(lead.organization.toLowerCase())) {
        lead.score += 50;
        lead.factors.push('active_bid_match');
      }
    });
  });
  
  return Array.from(leadScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
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

function findHighEngagementLeads(surveys, registrations) {
  const engagement = new Map();
  
  registrations.forEach(reg => {
    const key = reg.email?.toLowerCase().trim();
    if (!key) return;
    if (!engagement.has(key)) {
      engagement.set(key, { 
        email: reg.email, 
        name: reg.name, 
        organization: reg.organization, 
        webinarCount: 0, 
        surveyCount: 0,
        contactRequest: false
      });
    }
    engagement.get(key).webinarCount++;
  });
  
  surveys.forEach(survey => {
    const key = survey.email?.toLowerCase().trim();
    if (key && engagement.has(key)) {
      engagement.get(key).surveyCount++;
      if (survey.contactRequest?.toLowerCase().includes('yes')) {
        engagement.get(key).contactRequest = true;
      }
    }
  });
  
  return Array.from(engagement.values())
    .filter(lead => lead.webinarCount >= 2 || lead.surveyCount >= 1 || lead.contactRequest)
    .sort((a, b) => (b.webinarCount + b.surveyCount * 2) - (a.webinarCount + a.surveyCount * 2))
    .slice(0, 20);
}

function findCrossOvers(activeBids, registrations) {
  const bidAgencies = new Set(
    activeBids.map(b => b.agency?.toLowerCase().trim()).filter(Boolean)
  );
  const webinarOrgs = new Set(
    registrations.map(r => r.organization?.toLowerCase().trim()).filter(Boolean)
  );
  
  const crossovers = [];
  bidAgencies.forEach(agency => {
    webinarOrgs.forEach(org => {
      if (agency.includes(org) || org.includes(agency)) {
        crossovers.push({ 
          bidAgency: agency, 
          webinarOrganization: org,
          match: 'high'
        });
      }
    });
  });
  
  return crossovers.slice(0, 15);
}