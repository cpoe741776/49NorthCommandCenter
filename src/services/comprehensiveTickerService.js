// src/services/comprehensiveTickerService.js
// Comprehensive ticker service that aggregates real-time data from all sources
// Provides clickable items with proper navigation and links

function withAuthHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined' && window.__APP_TOKEN) {
    headers.set('X-App-Token', window.__APP_TOKEN);
  }
  return { ...init, headers };
}

/**
 * Fetch comprehensive ticker data from all sources
 */
export async function fetchComprehensiveTicker() {
  try {
    const res = await fetch('/.netlify/functions/getComprehensiveTicker', withAuthHeaders());
    if (!res.ok) {
      console.error('Comprehensive ticker failed:', res.status, res.statusText);
      return getFallbackTickerData();
    }
    const data = await res.json();
    console.log('Comprehensive ticker data:', data);
    return data?.data || getFallbackTickerData();
  } catch (err) {
    console.error('Error fetching comprehensive ticker:', err);
    return getFallbackTickerData();
  }
}

function getFallbackTickerData() {
  return {
    activeBidsCount: 0,
    recentDisregardedCount: 0,
    upcomingWebinars: [],
    recentSocialPosts: [],
    scheduledSocialCount: 0,
    socialThisWeek: 0,
    socialThisMonth: 0,
    activeBidSystemsCount: 0,
    recentBidSystemChanges: [],
    newsArticles: [],
    priorityBids: [],
    upcomingWebinarRegistrations: 0,
    recentWebinarRegistrations: 0,
    surveyContactsToContact: []
  };
}

/**
 * Generate ticker items from comprehensive data
 */
export function generateTickerItems(data) {
  if (!data || typeof data !== 'object') return [];
  
  const items = [];
  const now = new Date().toISOString();

  // 1. ACTIVE BIDS COUNT
  if (data.activeBidsCount > 0) {
    items.push({
      message: `📋 ${data.activeBidsCount} Active Bids`,
      priority: data.activeBidsCount >= 20 ? 'high' : data.activeBidsCount >= 10 ? 'medium' : 'low',
      category: 'Bids',
      source: 'bids-count',
      target: 'bids',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 2. RECENTLY DISREGARDED BIDS COUNT
  if (data.recentDisregardedCount > 0) {
    items.push({
      message: `🗑️ ${data.recentDisregardedCount} Recently Disregarded`,
      priority: 'low',
      category: 'Bids',
      source: 'disregarded-count',
      target: 'bids',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 3. UPCOMING WEBINARS WITH DATES
  if (data.upcomingWebinars && data.upcomingWebinars.length > 0) {
    data.upcomingWebinars.slice(0, 3).forEach(webinar => {
      const date = webinar.startTime ? new Date(webinar.startTime).toLocaleDateString() : 'TBA';
      items.push({
        message: `🎥 Webinar: ${webinar.title} (${date})`,
        priority: webinar.daysUntil ? (webinar.daysUntil <= 3 ? 'high' : webinar.daysUntil <= 7 ? 'medium' : 'low') : 'low',
        category: 'Webinars',
        source: 'webinar-upcoming',
        target: 'webinars',
        link: webinar.registrationUrl || '',
        createdAt: now,
        status: 'active'
      });
    });
  }

  // 4. RECENT SOCIAL MEDIA POSTS PUBLISHED
  if (data.recentSocialPosts && data.recentSocialPosts.length > 0) {
    data.recentSocialPosts.slice(0, 2).forEach(post => {
      const platform = post.platform ? `[${post.platform}] ` : '';
      items.push({
        message: `📱 Social: ${platform}${post.title || post.text || 'New post'}`,
        priority: 'low',
        category: 'Social',
        source: 'social-recent',
        target: 'social',
        link: post.url || post.permalink || '',
        createdAt: now,
        status: 'active'
      });
    });
  }

  // 5. SCHEDULED SOCIAL MEDIA POSTS COUNT
  if (data.scheduledSocialCount > 0) {
    items.push({
      message: `📅 ${data.scheduledSocialCount} Scheduled Social Posts`,
      priority: 'low',
      category: 'Social',
      source: 'social-scheduled',
      target: 'social',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 6. SOCIAL MEDIA POSTS THIS WEEK/MONTH
  if (data.socialThisWeek > 0 || data.socialThisMonth > 0) {
    items.push({
      message: `📊 Social: ${data.socialThisWeek} this week, ${data.socialThisMonth} this month`,
      priority: 'low',
      category: 'Social',
      source: 'social-stats',
      target: 'social',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 7. ACTIVE BID SYSTEMS COUNT
  if (data.activeBidSystemsCount > 0) {
    items.push({
      message: `🏢 ${data.activeBidSystemsCount} Active Bid Systems`,
      priority: 'low',
      category: 'Systems',
      source: 'systems-count',
      target: 'bid-systems',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 8. RECENTLY ADDED/DELETED BID SYSTEMS
  if (data.recentBidSystemChanges && data.recentBidSystemChanges.length > 0) {
    data.recentBidSystemChanges.slice(0, 2).forEach(change => {
      const action = change.action === 'added' ? '➕ Added' : '➖ Removed';
      items.push({
        message: `🏢 ${action}: ${change.name}`,
        priority: 'medium',
        category: 'Systems',
        source: 'systems-changes',
        target: 'bid-systems',
        link: '',
        createdAt: now,
        status: 'active'
      });
    });
  }

  // 9. NEWS ARTICLES FROM AI NEWS
  if (data.newsArticles && data.newsArticles.length > 0) {
    data.newsArticles.slice(0, 2).forEach(article => {
      items.push({
        message: `📰 News: ${article.title}`,
        priority: 'low',
        category: 'News',
        source: 'news-ai',
        target: 'dashboard',
        link: article.link || '',
        createdAt: now,
        status: 'active'
      });
    });
  }

  // 10. TOP PRIORITY BIDS WITH EXPIRING DUE DATES
  if (data.priorityBids && data.priorityBids.length > 0) {
    data.priorityBids.slice(0, 3).forEach(bid => {
      const dueText = bid.dueDate ? ` (Due: ${bid.dueDate})` : '';
      const priority = bid.daysUntilDue <= 3 ? 'high' : bid.daysUntilDue <= 7 ? 'medium' : 'low';
      items.push({
        message: `⚡ Priority: ${bid.entity || bid.bidSystem || 'Opportunity'}${dueText}`,
        priority,
        category: 'Bids',
        source: 'bids-priority',
        target: 'bids',
        link: bid.url || '',
        createdAt: now,
        status: 'active'
      });
    });
  }

  // 11. WEBINAR REGISTRATIONS FOR UPCOMING WEBINARS
  if (data.upcomingWebinarRegistrations > 0) {
    items.push({
      message: `👥 ${data.upcomingWebinarRegistrations} Webinar Registrations`,
      priority: 'low',
      category: 'Webinars',
      source: 'webinar-registrations',
      target: 'webinars',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 12. RECENTLY ADDED WEBINAR REGISTRATIONS
  if (data.recentWebinarRegistrations > 0) {
    items.push({
      message: `🆕 ${data.recentWebinarRegistrations} New Webinar Registrations`,
      priority: 'medium',
      category: 'Webinars',
      source: 'webinar-new-registrations',
      target: 'webinars',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 13. SURVEY CONTACT REMINDERS (Column J = "Yes")
  if (data.surveyContactsToContact && data.surveyContactsToContact.length > 0) {
    data.surveyContactsToContact.slice(0, 2).forEach(contact => {
      items.push({
        message: `📞 Contact: ${contact.name || contact.email || 'Survey respondent'}`,
        priority: 'high',
        category: 'Surveys',
        source: 'survey-contacts',
        target: 'webinars',
        link: '',
        createdAt: now,
        status: 'active'
      });
    });
  }

  // 14. OVERDUE WEBINAR EMAIL REMINDERS
  if (data.overdueWebinarEmails > 0) {
    items.push({
      message: `⚠️ ${data.overdueWebinarEmails} Webinar Email Reminder${data.overdueWebinarEmails > 1 ? 's' : ''} Overdue - Review in Social Media`,
      priority: 'high',
      category: 'Reminders',
      source: 'reminders-webinar',
      target: 'webinars',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 15. MISSING WEEKLY SOCIAL POSTS
  if (data.missingSocialPosts && data.missingSocialPosts.length > 0) {
    items.push({
      message: `📅 Missing Weekly Posts: ${data.missingSocialPosts.join(', ')} - Create Now`,
      priority: 'high',
      category: 'Reminders',
      source: 'reminders-social',
      target: 'social',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 16. OVERDUE WEBINAR SOCIAL POSTS
  if (data.overdueWebinarSocialPosts > 0) {
    items.push({
      message: `🎥 ${data.overdueWebinarSocialPosts} Webinar Social Post${data.overdueWebinarSocialPosts > 1 ? 's' : ''} Overdue - Promote Your Webinars!`,
      priority: 'high',
      category: 'Reminders',
      source: 'reminders-webinar-social',
      target: 'social',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 17. PENDING WEBINAR REMINDERS
  if (data.totalWebinarReminders > 0) {
    items.push({
      message: `📧 ${data.totalWebinarReminders} Webinar Reminder${data.totalWebinarReminders > 1 ? 's' : ''} Pending - Review in Social Media`,
      priority: 'medium',
      category: 'Reminders',
      source: 'reminders-webinar-pending',
      target: 'social',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // 18. UPCOMING WEEKLY SOCIAL POSTS
  if (data.upcomingSocialPosts && data.upcomingSocialPosts.length > 0) {
    items.push({
      message: `📅 Upcoming Weekly Posts: ${data.upcomingSocialPosts.join(', ')} - Plan Your Content`,
      priority: 'medium',
      category: 'Reminders',
      source: 'reminders-weekly-upcoming',
      target: 'social',
      link: '',
      createdAt: now,
      status: 'active'
    });
  }

  // Sort by priority (high > medium > low), then by category
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const categoryOrder = { 'Reminders': 0, 'Bids': 1, 'Webinars': 2, 'Surveys': 3, 'Systems': 4, 'Social': 5, 'News': 6 };
  
  return items.sort((a, b) => {
    const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    const categoryDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
    if (categoryDiff !== 0) return categoryDiff;
    
    return 0;
  });
}

/**
 * Normalize ticker item for UI display
 */
export function normalizeTickerItem(item) {
  return {
    message: String(item.message || '').trim(),
    priority: item.priority || 'low',
    category: item.category || 'General',
    source: item.source || 'unknown',
    createdAt: item.createdAt || new Date().toISOString(),
    link: item.link || '',
    target: item.target || null,
    status: item.status || 'active',
    ...item
  };
}
