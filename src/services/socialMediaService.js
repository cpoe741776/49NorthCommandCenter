// src/services/socialMediaService.js

export const fetchSocialMediaContent = async () => {
  try {
    const response = await fetch('/.netlify/functions/getSocialMediaContent');
    if (!response.ok) {
      throw new Error('Failed to fetch social media content');
    }
    const data = await response.json();
    return {
      posts: data.posts || [],
      summary: {
        totalPosts: data.posts?.length || 0,
        published: data.posts?.filter(p => p.status === 'Published').length || 0,
        scheduled: data.posts?.filter(p => p.status === 'Scheduled').length || 0,
        drafts: data.posts?.filter(p => p.status === 'Draft').length || 0,
      }
    };
  } catch (error) {
    console.error('Error fetching social media content:', error);
    return {
      posts: [],
      summary: {
        totalPosts: 0,
        published: 0,
        scheduled: 0,
        drafts: 0,
      }
    };
  }
};