//webinarService.js//

export const fetchWebinars = async () => {
  try {
    const response = await fetch('/.netlify/functions/fetchWebinars');
    if (!response.ok) {
      throw new Error('Failed to fetch webinar data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching webinars:', error);
    throw error;
  }
};