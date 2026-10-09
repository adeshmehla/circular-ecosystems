import type { APIRoute } from 'astro';
import { contacts } from '@wix/crm';
import { submissions } from '@wix/forms';
import { auth } from '@wix/essentials';
import { WIX_SERVICES_FORM_ID } from '../../utils/constants';

// Elevate SDK functions to run with app (owner) credentials
const elevatedCreateContact = auth.elevate(contacts.createContact);
const elevatedCreateSubmission = auth.elevate(submissions.createSubmission);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, organisation, email, service, decision } = body;

    // Resolve first & last names from single Name field
    let firstName = '';
    let lastName = '';

    if (name) {
      const trimmedName = name.trim();
      const nameParts = trimmedName.split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Server-side validation
    if (!name || !name.trim()) {
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

    // Prepare Wix Contact Payload
    const contactPayload: any = {
      name: {
        first: firstName,
        ...(lastName ? { last: lastName } : {})
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

    // 1. Submit form submission data to the Wix Forms database
    // Field targets confirmed from /api/services-debug:
    //   name_1      → Name (CONTACTS_FIRST_NAME)
    //   organisation → Organisation
    //   email        → Email
    //   service      → Service of interest
    //   decision     → Decision
    console.log('[services API] Submitting to Wix Forms, formId:', WIX_SERVICES_FORM_ID);
    try {
      const submissionResult = await elevatedCreateSubmission({
        formId: WIX_SERVICES_FORM_ID,
        submissions: {
          "name_1": name,
          "organisation": organisation || '',
          "email": email,
          "service": service || '',
          "decision": decision || ''
        }
      });
      console.log('[services API] Wix Form Submission SUCCESS:', JSON.stringify(submissionResult, null, 2));
    } catch (subError: any) {
      console.error('[services API] Wix Form Submission FAILED:', subError?.message || subError);
      console.error('[services API] Full error:', JSON.stringify(subError, null, 2));
    }

    // 2. Create contact in Wix CRM — skip silently if email already exists
    console.log('[services API] Attempting CRM contact create for:', email);
    let contactId = 'existing';
    try {
      const response = await elevatedCreateContact(contactPayload, { allowDuplicates: false });
      contactId = response.contact?._id || 'created';
      console.log('[services API] New contact created:', contactId);
    } catch (crmError: any) {
      // Wix throws when a contact with this email already exists.
      // This is expected — form is submitted, we just skip creating a duplicate.
      const errMsg: string = crmError?.message || JSON.stringify(crmError) || '';
      if (
        errMsg.toLowerCase().includes('duplicate') ||
        errMsg.toLowerCase().includes('already exist') ||
        crmError?.details?.applicationError?.code === 'CONTACT_EXISTS'
      ) {
        console.log('[services API] Contact already exists for', email, '— skipping duplicate creation.');
      } else {
        // Unexpected CRM error — log but don't fail the whole request (form was saved)
        console.error('[services API] Unexpected CRM error (non-blocking):', errMsg);
      }
    }

    return new Response(
      JSON.stringify({ success: true, contactId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in Wix CRM Services submission API:', error);
    const errorMessage = error?.message || 'Failed to submit services form details to Wix CRM.';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
