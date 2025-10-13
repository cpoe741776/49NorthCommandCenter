export const fetchAIInsights = async (bypassCache = false) => {
  try {
    let url = '/.netlify/functions/getAIInsights';
    
    if (bypassCache) {
      
      url += `?t=${Date.now()}`;
      console.log('Fetching new insights:', url);
    } else {
      console.log('Fetching cached insights:', url);
    }
    
    const response = await fetch(url); 
    
    if (!response.ok) {
      throw new Error('Failed to fetch AI insights');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    throw error;
  }
};