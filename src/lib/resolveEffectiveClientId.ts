import { externalDb } from '@/lib/externalDb';

interface UserLike {
  client_id?: number | string | null;
  id?: number | string | null;
}

export async function resolveEffectiveClientId(
  user: UserLike | null | undefined,
  logPrefix = 'resolveEffectiveClientId',
): Promise<string | null> {
  if (user?.client_id) return String(user.client_id);
  if (!user?.id) return null;

  try {
    const inherited = await externalDb.getEffectiveClientId(Number(user.id));
    if (inherited) return inherited;
  } catch (error) {
    console.warn(`[${logPrefix}] getEffectiveClientId failed`, error);
  }

  try {
    const userAgents = await externalDb.getUserAgents<{ client_id?: string | number | null }>(Number(user.id));
    const found = userAgents?.find((agent) => agent?.client_id != null);
    return found?.client_id ? String(found.client_id) : null;
  } catch (error) {
    console.warn(`[${logPrefix}] Failed to resolve client_id from user_agents`, error);
    return null;
  }
}