// netlify/functions/bulkUpdateContacts.js
// Bulk update multiple contacts with the same attribute changes

const { corsHeaders, methodGuard, ok } = require('./_utils/http');

const BREVO_API_KEY = process.env.BREVO_API_KEY;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  try {
    const { emails, updates } = JSON.parse(event.body || '{}');

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return ok(headers, { success: false, error: 'Email array required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return ok(headers, { success: false, error: 'Updates object required' });
    }

    if (!BREVO_API_KEY) {
      return ok(headers, { success: false, error: 'BREVO_API_KEY not configured' });
    }

    console.log('[BulkUpdate] Updating', emails.length, 'contacts with fields:', Object.keys(updates));

    // Map updates to Brevo attribute names
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
    
    // Always update last changed
    attributes.LAST_CHANGED = new Date().toISOString();

    // Update each contact
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const email of emails) {
      try {
        const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY
          },
          body: JSON.stringify({ attributes })
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
          const errorText = await res.text();
          errors.push({ email, error: errorText });
        }
      } catch (err) {
        failCount++;
        errors.push({ email, error: err.message });
      }
    }

    console.log('[BulkUpdate] Complete. Success:', successCount, 'Failed:', failCount);

    return ok(headers, {
      success: true,
      message: `Bulk update complete`,
      successCount,
      failCount,
      totalContacts: emails.length,
      updatedFields: Object.keys(attributes),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('[BulkUpdate] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

