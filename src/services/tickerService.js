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
    // This will call your Netlify function
    const response = await fetch('/.netlify/functions/getTickerFeed');
    
    if (!response.ok) {
      throw new Error('Failed to fetch ticker items');
    }
    
    const data = await response.json();
    
    // Filter active items and sort by priority and timestamp
    const activeItems = data
      .filter(item => item.active === true || item.active === 'TRUE')
      .sort((a, b) => {
        // Sort by priority first (high > medium > low)
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by timestamp (newest first)
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    
    return activeItems;
  } catch (error) {
    console.error('Error fetching ticker items:', error);
    // Return fallback items if fetch fails
    return getFallbackTickerItems();
  }
}

/**
 * Generate ticker items from bid activity
 * This function analyzes bids and creates appropriate ticker messages
 */
export function generateTickerItemsFromBids(bids) {
  const items = [];
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  bids.forEach(bid => {
    // New bids received recently (within last 24 hours)
    const receivedDate = new Date(bid.emailDateReceived);
    const hoursSinceReceived = (now - receivedDate) / (1000 * 60 * 60);
    
    if (hoursSinceReceived < 24) {
      items.push({
        timestamp: bid.emailDateReceived,
        message: `🔔 New RFP from ${extractAgency(bid.emailFrom)} - ${bid.emailSubject}`,
        priority: bid.recommendation === 'Respond' ? 'high' : 'medium',
        source: 'auto',
        active: true,
        expiresOn: addDays(now, 3) // Expires in 3 days
      });
    }
    
    // Deadline approaching (within 7 days)
    if (bid.dueDate && bid.dueDate !== 'Not specified') {
      const dueDate = new Date(bid.dueDate);
      if (dueDate > now && dueDate < sevenDaysFromNow) {
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        items.push({
          timestamp: now.toISOString(),
          message: `⏰ Deadline approaching: ${bid.emailSubject} due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
          priority: daysUntil <= 3 ? 'high' : 'medium',
          source: 'auto',
          active: true,
          expiresOn: bid.dueDate
        });
      }
    }
    
    // High-priority "Respond" recommendations
    if (bid.recommendation === 'Respond' && bid.keywordScore > 75) {
      items.push({
        timestamp: now.toISOString(),
        message: `🎯 High-match opportunity: ${bid.emailSubject} (${bid.keywordScore}% match)`,
        priority: 'high',
        source: 'auto',
        active: true,
        expiresOn: addDays(now, 5)
      });
    }
  });
  
  return items;
}

/**
 * Generate ticker items from submitted bids
 */
export function generateSubmittedBidItem(bid) {
  return {
    timestamp: new Date().toISOString(),
    message: `✅ Bid response submitted - ${bid.emailSubject}`,
    priority: 'medium',
    source: 'auto',
    active: true,
    expiresOn: addDays(new Date(), 7)
  };
}

/**
 * Generate ticker items from webinar activity
 */
export function generateWebinarTickerItems(webinars) {
  const items = [];
  const now = new Date();
  
  webinars.forEach(webinar => {
    // Registration milestones
    const registrationThresholds = [25, 50, 75, 100];
    registrationThresholds.forEach(threshold => {
      if (webinar.registrations >= threshold && webinar.registrations < threshold + 5) {
        items.push({
          timestamp: now.toISOString(),
          message: `📊 Webinar "${webinar.title}" - ${webinar.registrations} registrations!`,
          priority: webinar.registrations >= 75 ? 'high' : 'medium',
          source: 'auto',
          active: true,
          expiresOn: webinar.date
        });
      }
    });
    
    // Upcoming webinar reminders (3 days before)
    const webinarDate = new Date(webinar.date);
    const daysUntil = Math.ceil((webinarDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 0 && daysUntil <= 3) {
      items.push({
        timestamp: now.toISOString(),
        message: `📅 Upcoming: "${webinar.title}" in ${daysUntil} day${daysUntil > 1 ? 's' : ''} - ${webinar.registrations} registered`,
        priority: 'high',
        source: 'auto',
        active: true,
        expiresOn: webinar.date
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

/**
 * Archive expired ticker items
 * Call this periodically to clean up old items
 */
export async function archiveExpiredItems() {
  try {
    const response = await fetch('/.netlify/functions/archiveTickerItems', {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to archive ticker items');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error archiving ticker items:', error);
    throw error;
  }
}

// Helper functions

function extractAgency(emailFrom) {
  // Extract organization name from email
  // Examples: "John Doe <john@agency.gov>" -> "agency.gov"
  const match = emailFrom.match(/@([^>]+)/);
  if (match) {
    const domain = match[1].replace(/\.(gov|com|org|net)$/i, '');
    return domain.split('.').pop();
  }
  return 'Unknown Agency';
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

function getFallbackTickerItems() {
  // Return static items if fetch fails
  return [
    {
      message: '🔔 New RFP from County Sheriff - Mental Health Training (Due Oct 15)',
      priority: 'high'
    },
    {
      message: '📊 Webinar "Resilience for First Responders" - 42 registrations',
      priority: 'medium'
    },
    {
      message: '📅 Social post scheduled for Oct 3 - Peer Support Awareness',
      priority: 'low'
    },
    {
      message: '✅ Bid response submitted - State Fire Marshal Trauma Training',
      priority: 'medium'
    }
  ];
}