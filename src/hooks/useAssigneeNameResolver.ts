import { useMemo } from 'react';
import { useTeamByClient, type TeamMemberByClient } from './useTeamByClient';

export type AssigneeNameIndex = Map<string, string>;

/**
 * Resolve um valor cru de `chat_conversations.assigned_to` para nome exibível.
 * - Vazio/null  → null
 * - Numérico e presente no índice → nome do membro
 * - Caso contrário (já é nome / legado) → valor original
 */
export function resolveAssigneeName(
  value: string | null | undefined,
  index: AssigneeNameIndex,
): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const name = index.get(v);
    if (name) return name;
  }
  return v;
}

export function buildAssigneeIndex(members: TeamMemberByClient[] | undefined): AssigneeNameIndex {
  const map: AssigneeNameIndex = new Map();
  (members || []).forEach((m) => {
    if (m?.id != null && m.name) map.set(String(m.id), m.name);
  });
  return map;
}

export function useAssigneeNameResolver() {
  const { data, isLoading } = useTeamByClient();
  const index = useMemo(() => buildAssigneeIndex(data), [data]);
  const resolve = useMemo(
    () => (value: string | null | undefined) => resolveAssigneeName(value, index),
    [index],
  );
  return { resolve, index, isLoading };
}