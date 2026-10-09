import type { APIRoute } from 'astro';
import { forms } from '@wix/forms';
import { auth } from '@wix/essentials';
import { WIX_SERVICES_FORM_ID } from '../../utils/constants';

const elevatedGetForm = auth.elevate(forms.getForm);

export const GET: APIRoute = async () => {
  try {
    console.log('[services-debug] Fetching form schema for ID:', WIX_SERVICES_FORM_ID);
    const form = await elevatedGetForm(WIX_SERVICES_FORM_ID);
    console.log('[services-debug] Full form response:', JSON.stringify(form, null, 2));

    // Extract all field IDs and labels for easy reading
    const fields: any[] = [];
    if (form?.fields) {
      for (const field of form.fields) {
        fields.push({
          id: field._id,
          fieldType: field.fieldType,
          target: (field as any).target,
          renderInfo: (field as any).renderInfo,
          raw: field
        });
      }
    }

    return new Response(
      JSON.stringify({ formId: WIX_SERVICES_FORM_ID, fields, rawForm: form }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[services-debug] Error fetching form:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error', details: String(error) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
