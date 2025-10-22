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
    
    // Basic Info
    if (updates.firstName !== undefined) attributes.FIRSTNAME = updates.firstName;
    if (updates.lastName !== undefined) attributes.LASTNAME = updates.lastName;
    if (updates.jobTitle !== undefined) attributes.JOB_TITLE = updates.jobTitle;
    if (updates.credentials !== undefined) attributes.CREDENTIALS = updates.credentials;
    
    // Organization
    if (updates.organization !== undefined) attributes.ORGANIZATION_NAME = updates.organization;
    if (updates.organizationType !== undefined) attributes.ORGANIZATION_TYPE = updates.organizationType;
    if (updates.organizationSize !== undefined) attributes.ORGANIZATION_SIZE = updates.organizationSize;
    if (updates.organizationAddress !== undefined) attributes.ORGANIZATION_STREET_ADDRESS = updates.organizationAddress;
    
    // Location
    if (updates.city !== undefined) attributes.CITY = updates.city;
    if (updates.state !== undefined) attributes.STATE_PROVINCE = updates.state;
    if (updates.county !== undefined) attributes.COUNTY = updates.county;
    if (updates.zipCode !== undefined) attributes.ZIP_OR_POSTAL_CODE = updates.zipCode;
    if (updates.country !== undefined) attributes.COUNTRY_REGION = updates.country;
    
    // Contact Methods
    if (updates.phoneOffice !== undefined) attributes.PHONE_OFFICE = updates.phoneOffice;
    if (updates.phoneMobile !== undefined) attributes.PHONE_MOBILE = updates.phoneMobile;
    if (updates.phoneExtension !== undefined) attributes.PHONE_EXTENSION = updates.phoneExtension;
    if (updates.whatsapp !== undefined) attributes.WHATSAPP = updates.whatsapp;
    if (updates.linkedin !== undefined) attributes.LINKEDIN = updates.linkedin;
    
      // Additional Info
      if (updates.areasOfInterest !== undefined) attributes.AREAS_OF_INTEREST = updates.areasOfInterest;
      if (updates.customTag !== undefined) attributes.CUSTOM_TAG = updates.customTag;
      if (updates.sourcedFrom !== undefined) attributes.SOURCED_FROM = updates.sourcedFrom;
      if (updates.notes !== undefined) attributes.NOTES = updates.notes;
      
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

