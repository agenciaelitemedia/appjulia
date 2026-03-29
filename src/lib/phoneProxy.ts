import type { ProviderType } from '@/pages/admin/telefonia/types';

/**
 * Returns the Supabase edge function name for the given telephony provider.
 * All providers expose the same action vocabulary (dial, hangup, get_sip_credentials, etc.)
 * so call sites only need to switch the function name, not the payload.
 */
export function getPhoneProxy(provider: ProviderType | string | null | undefined): string {
  return provider === '3cplus' ? 'threecplus-proxy' : 'api4com-proxy';
}
