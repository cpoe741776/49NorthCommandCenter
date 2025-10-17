// netlify/functions/inspectLinkedInToken.js
// Check what scopes your LinkedIn token actually has
// Visit: /.netlify/functions/inspectLinkedInToken

const { corsHeaders } = require('./_utils/http');

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const LI_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!LI_TOKEN) {
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: '<h1>Error</h1><p>LINKEDIN_ACCESS_TOKEN not configured</p>'
    };
  }

  try {
    // Use LinkedIn's introspection endpoint
    const res = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${LI_TOKEN}&client_id=${process.env.LINKEDIN_CLIENT_ID || ''}&client_secret=${process.env.LINKEDIN_CLIENT_SECRET || ''}`
    });

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'text/html' },
        body: `
          <html>
          <body style="font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px;">
            <h1>❌ Token Introspection Failed</h1>
            <p>Status: ${res.status}</p>
            <pre>${await res.text()}</pre>
            <hr>
            <h3>Current Token (first 50 chars):</h3>
            <code>${LI_TOKEN.substring(0, 50)}...</code>
            <hr>
            <p>The token exists but introspection failed. Try generating a new token with the OAuth helper.</p>
          </body>
          </html>
        `
      };
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>LinkedIn Token Inspector</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 900px; margin: 50px auto; padding: 20px; }
            .box { background: #f0f7ff; border: 2px solid #0073b1; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .scope { background: #e8f4f8; padding: 8px 12px; margin: 5px; display: inline-block; border-radius: 5px; font-family: monospace; font-size: 14px; }
            .valid { color: #28a745; }
            .expired { color: #dc3545; }
            .warning { background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 8px; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>🔍 LinkedIn Token Inspector</h1>
          
          <div class="box">
            <h2>Token Status: <span class="${data.active ? 'valid' : 'expired'}">${data.active ? '✅ ACTIVE' : '❌ EXPIRED'}</span></h2>
            <p><strong>Client ID:</strong> ${data.client_id || 'N/A'}</p>
            <p><strong>Expires in:</strong> ${data.expires_in ? Math.floor(data.expires_in / 86400) + ' days' : 'Unknown'}</p>
            <p><strong>Issued at:</strong> ${data.iat ? new Date(data.iat * 1000).toLocaleString() : 'Unknown'}</p>
            <p><strong>Expires at:</strong> ${data.exp ? new Date(data.exp * 1000).toLocaleString() : 'Unknown'}</p>
          </div>

          <div class="box">
            <h2>📜 Granted Scopes:</h2>
            ${data.scope ? data.scope.split(' ').map(s => `<span class="scope">${s}</span>`).join('') : '<p>No scopes found</p>'}
          </div>

          ${data.scope && !data.scope.includes('w_organization_social') ? `
            <div class="warning">
              <h3>⚠️ WARNING: Missing Required Scope</h3>
              <p>Your token does NOT have <code>w_organization_social</code> scope!</p>
              <p>This is required to post on behalf of your organization.</p>
              <p><strong>Fix:</strong></p>
              <ol>
                <li>Ensure "Community Management API" or "Share on LinkedIn" product is approved in your LinkedIn app</li>
                <li>Generate a new token with scope=w_organization_social</li>
                <li>Update LINKEDIN_ACCESS_TOKEN in Netlify</li>
              </ol>
            </div>
          ` : ''}

          <div class="box">
            <h3>🔧 Raw Token Data:</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        </body>
        </html>
      `
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `<h1>Error</h1><p>${e.message}</p>`
    };
  }
};

