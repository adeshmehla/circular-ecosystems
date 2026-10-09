import { createClient, OAuthStrategy } from '@wix/sdk';
import { posts } from '@wix/blog';

export const wixClient = createClient({
  modules: { posts },
  auth: OAuthStrategy({
    clientId: import.meta.env.PUBLIC_WIX_CLIENT_ID,
  }),
});
