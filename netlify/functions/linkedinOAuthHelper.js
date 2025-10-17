// netlify/functions/linkedinOAuthHelper.js
// Helper function to generate LinkedIn access tokens
// Visit: /.netlify/functions/linkedinOAuthHelper?step=1 to start

const { corsHeaders } = require('./_utils/http');

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://49northcommandcenter.netlify.app/.netlify/functions/linkedinOAuthHelper';

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const url = new URL(event.rawUrl || `http://local${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
  const step = url.searchParams.get('step');
  const code = url.searchParams.get('code');

  try {
    // Step 1: Provide authorization URL
    if (step === '1') {
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=w_organization_social`;
      
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>LinkedIn OAuth - Step 1</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .box { background: #f0f7ff; border: 2px solid #0073b1; padding: 20px; border-radius: 8px; }
              a.button { display: inline-block; background: #0073b1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
              code { background: #eee; padding: 2px 6px; border-radius: 3px; }
              .instructions { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
            </style>
          </head>
          <body>
            <h1>🔐 LinkedIn Access Token Generator</h1>
            <div class="box">
              <h2>Step 1: Authorize Your App</h2>
              <p>Click the button below to authorize 49 North to post to LinkedIn:</p>
              <a href="${authUrl}" class="button">Authorize LinkedIn →</a>
            </div>
            
            <div class="instructions">
              <h3>What happens next:</h3>
              <ol>
                <li>You'll be redirected to LinkedIn</li>
                <li>Log in and authorize the app</li>
                <li>LinkedIn will redirect you back with a code</li>
                <li>Copy the <code>code</code> parameter from the URL</li>
                <li>Come back here and visit: <code>/.netlify/functions/linkedinOAuthHelper?step=2&code=YOUR_CODE</code></li>
              </ol>
            </div>
          </body>
          </html>
        `
      };
    }

    // Step 2: Exchange code for access token
    if (step === '2' && code) {
      if (!CLIENT_SECRET) {
        return {
          statusCode: 500,
          headers: { ...headers, 'Content-Type': 'text/html' },
          body: '<h1>Error</h1><p>LINKEDIN_CLIENT_SECRET not configured in Netlify</p>'
        };
      }

      const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          statusCode: 500,
          headers: { ...headers, 'Content-Type': 'text/html' },
          body: `<h1>Error</h1><pre>${errorText}</pre>`
        };
      }

      const data = await response.json();

      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>LinkedIn OAuth - Success!</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .success { background: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 8px; }
              .token { background: #f8f9fa; padding: 15px; border: 1px solid #ddd; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
              .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✅ Success! Access Token Generated</h1>
              <p><strong>Your LinkedIn Access Token:</strong></p>
              <div class="token">${data.access_token}</div>
              <p><strong>Expires in:</strong> ${Math.floor(data.expires_in / 86400)} days (${data.expires_in} seconds)</p>
            </div>
            
            <div class="warning">
              <h3>⚠️ Next Steps:</h3>
              <ol>
                <li>Copy the token above</li>
                <li>Go to Netlify → Environment Variables</li>
                <li>Update <code>LINKEDIN_ACCESS_TOKEN</code> with this value</li>
                <li>Redeploy your site</li>
                <li><strong>Mark your calendar:</strong> Token expires in 60 days - regenerate before then!</li>
              </ol>
            </div>
          </body>
          </html>
        `
      };
    }

    // Default: Show instructions
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>LinkedIn OAuth Helper</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .box { background: #f0f7ff; border: 2px solid #0073b1; padding: 20px; border-radius: 8px; }
            a { color: #0073b1; }
          </style>
        </head>
        <body>
          <h1>🔐 LinkedIn Access Token Generator</h1>
          <div class="box">
            <p>To generate a new LinkedIn access token:</p>
            <ol>
              <li>Visit: <a href="/.netlify/functions/linkedinOAuthHelper?step=1">Step 1 - Start OAuth Flow</a></li>
              <li>Authorize the app on LinkedIn</li>
              <li>Copy the code from the redirect URL</li>
              <li>Come back to Step 2 with the code</li>
            </ol>
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

