import { useAuth } from "@/contexts/AuthContext";

/**
 * BlitzLeads-scoped wrapper over the app's AuthContext.
 * Exposes just the client info the BlitzLeads UI needs, so pages
 * inside `src/blitzleads/` don't import AuthContext directly.
 */
export function useBlitzClient() {
  const { user, isLoading } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;
  const clientName = user?.client_name?.trim() || null;
  return {
    clientId,
    clientName,
    displayName: clientName ?? (isLoading ? "Carregando..." : "Escritório"),
    isLoading,
  };
}