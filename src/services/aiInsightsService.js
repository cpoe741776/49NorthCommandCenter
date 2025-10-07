export const fetchAIInsights = async () => {
  try {
    const response = await fetch('/.netlify/functions/getAIInsights');
    if (!response.ok) {
      throw new Error('Failed to fetch AI insights');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    throw error;
  }
};