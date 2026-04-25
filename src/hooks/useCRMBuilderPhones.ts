import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Normalize phone to digits-only for matching. */
function normalizePhone(p?: string | null): string {
  return (p || '').replace(/\D/g, '');
}

/**
 * Returns a Set of normalized phone numbers that have at least one
 * non-archived deal in the CRM Builder for the current client.
 */
export function useCRMBuilderPhones() {
  const { user } = useAuth();
  const clientId = String(user?.cod_agent || user?.id || '');

  return useQuery({
    queryKey: ['crm-builder-phones', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('contact_phone')
        .eq('client_id', clientId)
        .neq('status', 'archived')
        .not('contact_phone', 'is', null);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data || []) {
        const norm = normalizePhone((row as { contact_phone?: string }).contact_phone);
        if (norm) set.add(norm);
      }
      return set;
    },
  });
}
