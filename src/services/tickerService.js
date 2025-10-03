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