// src/services/bidService.js

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/.netlify/functions'
  : 'http://localhost:8888/.netlify/functions';

/**
 * Fetch all bids from the API
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