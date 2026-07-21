/**
 * Thin re-export of the shared Supabase client, scoped to BlitzLeads usage.
 * Kept here so every DB call in the module goes through this wrapper — makes
 * it trivial to swap for a dedicated project later without touching pages.
 */
export { supabase as blitzSupabase } from "@/integrations/supabase/client";

export const BLITZ_TABLES = {
  routeConfig: "blitzleads_route_config",
  cases: "blitzleads_cases",
  events: "blitzleads_case_events",
  settings: "blitzleads_settings",
} as const;