import { useEffect, useState } from 'react';
import { useAuth, resolveEffectiveClientId } from '../extend/auth';

/** client_id efetivo do usuário logado (herdado quando for membro de equipe). */
export function useDspClientId() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(
    user?.client_id ? String(user.client_id) : null,
  );
  const [loading, setLoading] = useState(!user?.client_id);

  useEffect(() => {
    let cancelled = false;
    if (user?.client_id) {
      setClientId(String(user.client_id));
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setClientId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    resolveEffectiveClientId(user as any, 'disparos')
      .then((id) => { if (!cancelled) setClientId(id); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, user?.client_id]);

  return { clientId, loading };
}
