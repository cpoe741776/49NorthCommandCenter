// netlify/functions/updateContact.js
// Updates contact information in Brevo

const { corsHeaders, methodGuard, ok } = require('./_utils/http');

const BREVO_API_KEY = process.env.BREVO_API_KEY;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'PUT', 'OPTIONS');
  if (guard) return guard;

  try {
    const { email, ...updates } = JSON.parse(event.body || '{}');

    if (!email) {
      return ok(headers, { success: false, error: 'Email required' });
    }

    if (!BREVO_API_KEY) {
      return ok(headers, { success: false, error: 'BREVO_API_KEY not configured' });
    }

    // Map to Brevo attribute names
    const attributes = {};
    if (updates.firstName) attributes.FIRSTNAME = updates.firstName;
    if (updates.lastName) attributes.LASTNAME = updates.lastName;
    if (updates.organization) attributes.ORGANIZATION_NAME = updates.organization;
    if (updates.jobTitle) attributes.JOB_TITLE = updates.jobTitle;
    if (updates.phoneMobile) attributes.PHONE_MOBILE = updates.phoneMobile;
    if (updates.phoneOffice) attributes.PHONE_OFFICE = updates.phoneOffice;
    if (updates.phoneExtension) attributes.PHONE_EXTENSION = updates.phoneExtension;
    if (updates.linkedin) attributes.LINKEDIN = updates.linkedin;
    if (updates.city) attributes.CITY = updates.city;
    if (updates.state) attributes.STATE_PROVINCE = updates.state;
    if (updates.country) attributes.COUNTRY_REGION = updates.country;
    if (updates.zipCode) attributes.ZIP_OR_POSTAL_CODE = updates.zipCode;
    if (updates.organizationType) attributes.ORGANIZATION_TYPE = updates.organizationType;
    if (updates.organizationSize) attributes.ORGANIZATION_SIZE = updates.organizationSize;
    if (updates.areasOfInterest) attributes.AREAS_OF_INTEREST = updates.areasOfInterest;
    if (updates.customTag) attributes.CUSTOM_TAG = updates.customTag;
    
    // Always update last changed
    attributes.LAST_CHANGED = new Date().toISOString();

    console.log('[UpdateContact] Updating:', email, 'Fields:', Object.keys(attributes));

    const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({ attributes })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Brevo update failed: ${error}`);
    }

    console.log('[UpdateContact] Success:', email);

    return ok(headers, {
      success: true,
      message: 'Contact updated successfully',
      email,
      updatedFields: Object.keys(attributes)
    });

  } catch (err) {
    console.error('[UpdateContact] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

