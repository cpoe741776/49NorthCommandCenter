// netlify/functions/createContact.js
// Creates a new contact in Brevo

const { corsHeaders, methodGuard, ok } = require('./_utils/http');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = 108; // DATABASE MASTER list

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email || !email.includes('@')) {
      return ok(headers, { success: false, error: 'Valid email required' });
    }

    if (!BREVO_API_KEY) {
      return ok(headers, { success: false, error: 'BREVO_API_KEY not configured' });
    }

    // Build attributes from all provided fields
    const attributes = {
      FIRSTNAME: body.firstName || '',
      LASTNAME: body.lastName || '',
      JOB_TITLE: body.jobTitle || '',
      CREDENTIALS: body.credentials || '',
      ORGANIZATION_NAME: body.organization || '',
      ORGANIZATION_TYPE: body.organizationType || '',
      ORGANIZATION_SIZE: body.organizationSize || '',
      ORGANIZATION_STREET_ADDRESS: body.organizationAddress || '',
      CITY: body.city || '',
      STATE_PROVINCE: body.state || '',
      COUNTY: body.county || '',
      ZIP_OR_POSTAL_CODE: body.zipCode || '',
      COUNTRY_REGION: body.country || '',
      PHONE_MOBILE: body.phone || '',
      PHONE_OFFICE: body.phoneOffice || '',
      PHONE_EXTENSION: body.phoneExtension || '',
      CUSTOM_TAG: body.customTag || '',
      SOURCED_FROM: body.sourcedFrom || 'Manual Entry - CRM',
      AREAS_OF_INTEREST: body.areasOfInterest || '',
      INITIAL_CONTACT_TIME: new Date().toISOString(),
      LAST_CHANGED: new Date().toISOString()
    };

    console.log('[CreateContact] Creating:', email);

    // Create contact
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [BREVO_LIST_ID], // Add to DATABASE MASTER list
        updateEnabled: false // Don't update if exists
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      
      // Check if contact already exists
      if (res.status === 400 && errorText.includes('Contact already exist')) {
        return ok(headers, {
          success: false,
          error: 'Contact already exists. Use the email lookup to find and edit this contact.',
          contactExists: true
        });
      }
      
      throw new Error(`Brevo create failed (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    console.log('[CreateContact] Success:', email, 'ID:', data.id);

    return ok(headers, {
      success: true,
      message: 'Contact created successfully',
      email,
      contactId: data.id
    });

  } catch (err) {
    console.error('[CreateContact] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

