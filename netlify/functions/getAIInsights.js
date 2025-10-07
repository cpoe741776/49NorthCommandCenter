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

    // Extract contact leads from surveys
    const contactLeads = extractContactLeads(surveys, registrations, activeBids);

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
      
      // Contact leads with priority scoring
      contactLeads: contactLeads,
      
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
          daysRemaining: Math.ceil((new Date(b.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
        })),
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
        }).length
      }
    };

    // Call OpenAI for strategic insights
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a strategic business analyst for 49 North, a mental health training company specializing in Mental Armor™ programs for government agencies and organizations.

CRITICAL: Understand the business model correctly:

**BIDS PROCESS:**
- Bids are INCOMING opportunities from automated systems (SAM.gov) - NOT something 49 North creates
- Active_Bids = opportunities they are considering responding to
- Submitted = bids they have already responded to
- Disregarded = opportunities they decided not to pursue
- Your role: Help prioritize WHICH incoming bids to respond to based on engagement data
- DO NOT suggest "creating bids" or "developing bid proposals" - they respond to existing opportunities

**WEBINARS:**
- 49 North runs training webinars to engage potential clients
- Survey data shows engagement levels and contact requests
- High engagement = warmer leads for sales follow-up

**WHAT 49 NORTH CAN DO:**
1. Prioritize which incoming bids to respond to
2. Follow up with webinar attendees who requested contact
3. Reach out to engaged organizations proactively
4. Create webinar content that resonates with target audiences

Focus on:
1. Bid prioritization - which INCOMING bids should they respond to, based on engagement
2. Sales lead prioritization - who from webinars should they contact (already handled in contactLeads)
3. Content strategy - what webinar topics drive engagement
4. Risk identification - declining engagement, missed follow-ups
5. Cross-operation connections - organizations in both bids AND webinars

Provide insights in this JSON structure:
{
  "executiveSummary": "2-3 sentence overview focusing on incoming bid opportunities and sales leads",
  "topPriorities": [
    {"title": "Priority name", "description": "Why this matters", "action": "Specific next step", "urgency": "high/medium/low"}
  ],
  "bidRecommendations": [
    {"solicitation": "Bid number", "agency": "Agency name", "reason": "Why prioritize responding to this INCOMING bid", "action": "Next step to respond", "dueDate": "date"}
  ],
  "contentInsights": {
    "topPerforming": "What webinar content drives engagement",
    "suggestions": "Topics to try based on survey feedback and bid patterns"
  },
  "riskAlerts": [
    {"issue": "What's concerning", "impact": "Business impact", "mitigation": "How to address"}
  ],
  "opportunityMapping": [
    {"type": "bid-response/content/partnership", "description": "The opportunity", "potential": "high/medium/low", "nextStep": "What to do"}
  ]
}

DO NOT include contact leads in your response - they are handled separately.`
        },
        {
          role: "user",
          content: `Analyze this operational data and provide strategic insights:

${JSON.stringify(aggregatedData, null, 2)}

Current date: ${new Date().toISOString().split('T')[0]}

Focus on:
1. Which INCOMING bids (from Active_Bids) should be prioritized for response
2. Content strategy for webinars
3. Operational risks
4. Cross-operation patterns (organizations appearing in both bids and webinars)

DO NOT suggest actions about contacting individuals - that's handled in the separate Contact Leads section.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const insights = JSON.parse(completion.choices[0].message.content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        insights,
        contactLeads: contactLeads.slice(0, 15), // Top 15 contact leads
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

// NEW: Extract contact leads with priority scoring
function extractContactLeads(surveys, registrations, bids) {
  const leads = new Map();
  
  // Surveys with contact requests or meaningful comments
  surveys.forEach(survey => {
    const email = survey.email?.toLowerCase().trim();
    if (!email) return;
    
    const wantsContact = survey.contactRequest?.toLowerCase().includes('yes');
    const hasComments = survey.comments && survey.comments.trim().length > 10;
    
    if (wantsContact || hasComments) {
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
          contactRequest: wantsContact,
          comments: survey.comments || '',
          lastActivity: survey.timestamp
        });
      }
      
      const lead = leads.get(email);
      
      if (wantsContact) {
        lead.score += 50;
        lead.factors.push('Requested Contact');
      }
      
      if (hasComments) {
        lead.score += 20;
        lead.factors.push('Left Comments');
      }
    }
  });
  
  // Boost score if their organization has active bids
  bids.forEach(bid => {
    leads.forEach(lead => {
      const org = lead.organization.toLowerCase();
      const agency = bid.agency?.toLowerCase();
      if (org.length > 3 && agency && (agency.includes(org) || org.includes(agency))) {
        lead.score += 100;
        lead.factors.push('Active Bid Match');
        lead.matchingBid = {
          solicitation: bid.solicitation,
          agency: bid.agency,
          dueDate: bid.dueDate
        };
      }
    });
  });
  
  // Count multiple webinar attendance
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