// src/services/bidService.js

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/.netlify/functions'
  : 'http://localhost:8888/.netlify/functions';

/**
 * Fetches FAST, analog dashboard data (counts and KPIs) from the dedicated Netlify function.
 * This should be the primary data source for the top cards.
 *
 * @param {boolean} [bypassCache=false] Forces the backend to ignore its cache via a query param.
 * @returns {Promise<{success: boolean, summary: Object}>}
 */
export const fetchDashboardData = async (bypassCache = false) => {
  try {
    let url = `${API_BASE_URL}/getDashboardData`;
    
    if (bypassCache) {
      // Append a unique timestamp to the URL to force the backend to bypass its cache
      url += `?t=${Date.now()}`;
      console.log('Fetching new dashboard stats:', url);
    } else {
      console.log('Fetching cached dashboard stats:', url);
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};


/**
 * Fetch all bids from the API (retained for BidOperations.jsx compatibility)
 */
export const fetchBids = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/getBids`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch bids');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching bids:', error);
    throw error;
  }
};

/**
 * Refresh bid data (for manual refresh button)
 */
export const refreshBids = async () => {
  return await fetchBids();
};
