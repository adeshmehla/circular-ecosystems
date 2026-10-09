import type { APIRoute } from 'astro';
import { contacts } from '@wix/crm';
import { submissions } from '@wix/forms';
import { auth } from '@wix/essentials';
import { WIX_Contact_FORM_ID } from '../../utils/constants';

// Elevate SDK functions to run with app (owner) credentials
const elevatedCreateContact = auth.elevate(contacts.createContact);
const elevatedCreateSubmission = auth.elevate(submissions.createSubmission);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, organisation, email, the_decision_you_are_facing, paper_name, service_interest } = body;

    // Resolve first & last names from single Name field
    let finalName = '';

    if (name) {
      const trimmedName = name.trim();
      const nameParts = trimmedName.split(/\s+/);
      finalName = nameParts[0] || '';
    }

    // Server-side validation
    if (!name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Full name is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email address is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email address format.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!the_decision_you_are_facing || !the_decision_you_are_facing.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message content is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare Wix Contact Payload
    const contactPayload: any = {
      name: {
        first: finalName
      },
      emails: {
        items: [
          {
            email: email,
            tag: 'MAIN' as any
          }
        ]
      }
    };

    if (organisation) {
      contactPayload.company = organisation;
    }

    try {
      const submissionResult = await elevatedCreateSubmission({
        formId: WIX_Contact_FORM_ID,
        submissions: {
          "name": name,
          "email_7950": email,
          "organisation": organisation || '',
          "the_decision_you_are_facing": the_decision_you_are_facing,
          // Only included when a Working Paper was requested
          ...(paper_name ? { "paper_name": paper_name } : {}),
          // Only included when a Service of interest was selected
          ...(service_interest ? { "service_interest": service_interest } : {})
        }
      });
      console.log('Wix Form Submission response:', JSON.stringify(submissionResult, null, 2));
    } catch (subError) {
      console.error('Wix Form Submission failed (non-blocking for CRM Contact creation):', subError);
    }

    // 2. Create contact in Wix CRM — skip silently if email already exists
    console.log('[contact API] Attempting CRM contact create for:', email);
    let contactId = 'existing';
    try {
      const response = await elevatedCreateContact(contactPayload, { allowDuplicates: false });
      contactId = response.contact?._id || 'created';
      console.log('[contact API] New contact created:', contactId);
    } catch (crmError: any) {
      // Wix throws when a contact with this email already exists.
      // This is expected — form is submitted, we just skip creating a duplicate.
      const errMsg: string = crmError?.message || JSON.stringify(crmError) || '';
      if (
        errMsg.toLowerCase().includes('duplicate') ||
        errMsg.toLowerCase().includes('already exist') ||
        crmError?.details?.applicationError?.code === 'CONTACT_EXISTS'
      ) {
        console.log('[contact API] Contact already exists for', email, '— skipping duplicate creation.');
      } else {
        console.error('[contact API] Unexpected CRM error (non-blocking):', errMsg);
      }
    }

    return new Response(
      JSON.stringify({ success: true, contactId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in Wix CRM Contact submission API:', error);
    const errorMessage = error?.message || 'Failed to submit contact details to Wix CRM.';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
