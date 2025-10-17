// netlify/functions/getLinkedInOrgId.js
// Helper to find your LinkedIn organization ID
// Visit: /.netlify/functions/getLinkedInOrgId

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
    // Get organizations the user has admin access to
    const res = await fetch('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(localizedName,id)))', {
      headers: {
        'Authorization': `Bearer ${LI_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'text/html' },
        body: `<h1>Error</h1><pre>${errorText}</pre>`
      };
    }

    const data = await res.json();

    const organizations = data.elements?.map(el => ({
      name: el['organizationalTarget~']?.localizedName,
      id: el.organizationalTarget,
      urn: el.organizationalTarget
    })) || [];

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>LinkedIn Organizations</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .org { background: #f0f7ff; border: 2px solid #0073b1; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .urn { background: #e8f4f8; padding: 10px; margin: 10px 0; border-radius: 5px; font-family: monospace; word-break: break-all; }
            .copy-btn { background: #0073b1; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <h1>🏢 Your LinkedIn Organizations</h1>
          ${organizations.length === 0 ? '<p>No organizations found. Make sure you have admin access to a company page.</p>' : ''}
          ${organizations.map((org, i) => `
            <div class="org">
              <h3>${org.name || 'Organization ' + (i+1)}</h3>
              <p><strong>URN for Netlify:</strong></p>
              <div class="urn">${org.urn}</div>
              <button class="copy-btn" onclick="navigator.clipboard.writeText('${org.urn}'); alert('Copied!')">
                Copy URN
              </button>
              <p style="margin-top: 15px; font-size: 14px; color: #666;">
                Add this to Netlify as <code>LINKEDIN_ORG_URN</code>
              </p>
            </div>
          `).join('')}
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

