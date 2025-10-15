// src/services/socialMediaService.js

// GET posts (optionally filtered)
export async function fetchSocialMediaContent(params = {}) {
  const url = new URL('/.netlify/functions/getSocialMediaContent', window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Failed to fetch social posts: ${res.status}`);
  return res.json(); // { success, posts }
}

// CREATE (draft) a new post
export async function createSocialPost(post) {
  const res = await fetch('/.netlify/functions/createSocialPost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error(`Failed to create post: ${res.status}`);
  return res.json();
}

// PUBLISH to platforms (supports { postId } OR { postData })
export async function publishSocialPost(payload) {
  const res = await fetch('/.netlify/functions/publishSocialPost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to publish post: ${res.status}`);
  return res.json();
}
