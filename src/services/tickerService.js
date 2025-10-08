// services/tickerService.js

/**
 * Ticker Service
 * Handles fetching and auto-generating ticker feed items
 */

/**
 * Fetch active ticker items from Google Sheets
 */
export async function fetchTickerItems() {
  try {
    const response = await fetch('/.netlify/functions/getTickerFeed');
    
    if (!response.ok) {
      throw new Error('Failed to fetch ticker items');
    }
    
    const data = await response.json();
    
    // Filter active items and sort by priority and timestamp
    const activeItems = data
      .filter(item => item.active === true || item.active === 'TRUE')
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        
        if (priorityDiff !== 0) return priorityDiff;
        
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    
    return activeItems;
  } catch (error) {
    console.error('Error fetching ticker items:', error);
    return getFallbackTickerItems();
  }
}

/**
 * Generate ticker items from bid activity
 */
export const generateTickerItemsFromBids = (bids) => {
  const items = [];
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // High-priority bids (Respond)
  const respondBids = bids.filter(b => b.recommendation === 'Respond');
  if (respondBids.length > 0) {
    items.push({
      message: `🔥 ${respondBids.length} HIGH PRIORITY bid${respondBids.length > 1 ? 's' : ''} requiring immediate response`,
      priority: 'high'
    });
  }
  
  // Process each bid for deadline alerts
  bids.forEach(bid => {
    // Deadline approaching (within 7 days)
    if (bid.dueDate && bid.dueDate !== 'Not specified') {
      const dueDate = new Date(bid.dueDate);
      if (dueDate > now && dueDate < sevenDaysFromNow) {
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        items.push({
          message: `⏰ Deadline approaching: ${bid.emailSubject.substring(0, 50)}... due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
          priority: daysUntil <= 3 ? 'high' : 'medium'
        });
      }
    }
  });
  
  return items;
};

/**
 * Generate ticker items from submitted bids
 */
export function generateSubmittedBidItems(submittedBids) {
  const items = [];
  
  submittedBids.forEach(bid => {
    if (bid.dueDate && bid.dueDate !== 'Not specified') {
      items.push({
        message: `📤 Submitted: ${bid.emailSubject.substring(0, 50)}... - Due: ${bid.dueDate}`,
        priority: 'medium'
      });
    }
  });
  
  return items;
}

/**
 * Add ticker item to Google Sheet
 */
export async function addTickerItem(item) {
  try {
    const response = await fetch('/.netlify/functions/addTickerItem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    
    if (!response.ok) {
      throw new Error('Failed to add ticker item');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding ticker item:', error);
    throw error;
  }
}

function getFallbackTickerItems() {
  return [
    {
      message: '🔔 Welcome to 49 North Command Center!',
      priority: 'high'
    },
    {
      message: '📊 Loading latest updates...',
      priority: 'medium'
    }
  ];
}

/**
 * Generate ticker items from AI insights
 */
export function generateAIInsightsTickerItems(aiInsights) {
  const items = [];
  
  if (!aiInsights) return items;

  // Hot contact leads
  if (aiInsights.contactLeads && aiInsights.contactLeads.length > 0) {
    const highPriorityLeads = aiInsights.contactLeads.filter(lead => lead.score >= 70);
    if (highPriorityLeads.length > 0) {
      items.push({
        message: `🔥 ${highPriorityLeads.length} HOT lead${highPriorityLeads.length > 1 ? 's' : ''} requesting contact - Review Dashboard`,
        priority: 'high',
        target: 'dashboard'
      });
    }
  }

  // Top AI priorities
  if (aiInsights.insights?.topPriorities) {
    aiInsights.insights.topPriorities.slice(0, 2).forEach(priority => {
      if (priority.urgency === 'high') {
        items.push({
          message: `⚡ AI Priority: ${priority.title}`,
          priority: 'high',
          target: 'dashboard'
        });
      }
    });
  }

  // Priority bids from AI
  if (aiInsights.priorityBids && aiInsights.priorityBids.length > 0) {
    items.push({
      message: `📋 ${aiInsights.priorityBids.length} bid${aiInsights.priorityBids.length > 1 ? 's' : ''} marked "Respond" - Action required`,
      priority: 'high',
      target: 'bids'
    });
  }

  // News articles - CREATE INDIVIDUAL ITEMS FOR EACH ARTICLE
  if (aiInsights.newsArticles && aiInsights.newsArticles.length > 0) {
    aiInsights.newsArticles.forEach(article => {
      items.push({
        message: `📰 Latest News: ${article.title}`,
        priority: 'medium',
        target: 'dashboard'
      });
    });
  }

  return items;
}

/**
 * Generate ticker items from webinar operations
 */
export function generateWebinarTickerItems(webinarData) {
  const items = [];
  
  if (!webinarData) return items;

  const { webinars = [], surveys = [] } = webinarData;
  
  // Upcoming webinars (within 7 days)
  const upcomingWebinars = webinars.filter(w => {
    if (w.status !== 'Upcoming') return false;
    const webinarDate = new Date(w.date);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return webinarDate > now && webinarDate < sevenDaysFromNow;
  });

  upcomingWebinars.forEach(webinar => {
    const webinarDate = new Date(webinar.date);
    const daysUntil = Math.ceil((webinarDate - new Date()) / (1000 * 60 * 60 * 24));
    items.push({
      message: `📅 Webinar "${webinar.title}" in ${daysUntil} day${daysUntil > 1 ? 's' : ''} - ${webinar.registrationCount} registered`,
      priority: daysUntil <= 2 ? 'high' : 'medium',
      target: 'webinars'
    });
  });

  // Recent contact requests from surveys
  const recentContactRequests = surveys.filter(s => 
    s.contactRequest && String(s.contactRequest).toLowerCase().includes('yes')
  );

  if (recentContactRequests.length > 0) {
    // Get last 7 days of contact requests
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRequests = recentContactRequests.filter(s => 
      new Date(s.timestamp) > sevenDaysAgo
    );

    if (recentRequests.length > 0) {
      items.push({
        message: `📞 ${recentRequests.length} new contact request${recentRequests.length > 1 ? 's' : ''} from webinar attendees`,
        priority: 'high',
        target: 'dashboard'
      });
    }
  }

  // High attendance webinar completed
  const recentCompleted = webinars
    .filter(w => w.status === 'Completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 1);

  if (recentCompleted.length > 0 && recentCompleted[0].attendanceCount > 20) {
    const webinar = recentCompleted[0];
    items.push({
      message: `✨ Latest webinar had ${webinar.attendanceCount} attendees - Strong engagement!`,
      priority: 'medium',
      target: 'webinars'
    });
  }

  return items;
}

/**
 * Send all auto-generated items to the ticker
 */
export async function refreshAllTickerItems(bids, webinarData, aiInsights) {
  try {
    const allItems = [
      ...generateTickerItemsFromBids(bids.activeBids || []),
      ...generateSubmittedBidItems(bids.submittedBids || []),
      ...generateWebinarTickerItems(webinarData),
      ...generateAIInsightsTickerItems(aiInsights)
    ];

    if (allItems.length === 0) return;

    await fetch('/.netlify/functions/refreshAutoTickerItems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: allItems })
    });

    console.log(`Refreshed ${allItems.length} ticker items`);
  } catch (error) {
    console.error('Error refreshing ticker items:', error);
  }
}