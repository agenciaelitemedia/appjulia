import { useQuery } from "@tanstack/react-query";
import { blitzSupabase, BLITZ_TABLES } from "@/blitzleads/lib/blitzClient";
import { DEFAULT_BLITZ_ROUTE_MAP, type BlitzRouteMap } from "@/blitzleads/lib/subdomain";

export interface BlitzRouteConfigRow {
  id: string;
  domain: string;
  mappings: BlitzRouteMap;
}

export function useBlitzRouteMap() {
  return useQuery({
    queryKey: ["blitzleads", "route-config"],
    queryFn: async (): Promise<BlitzRouteConfigRow> => {
      const { data, error } = await (blitzSupabase as any)
        .from(BLITZ_TABLES.routeConfig)
        .select("id, domain, mappings")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          id: "default",
          domain: "blitzleads.atendejulia.com.br",
          mappings: DEFAULT_BLITZ_ROUTE_MAP,
        };
      }
      return {
        id: data.id,
        domain: data.domain,
        mappings: (data.mappings ?? DEFAULT_BLITZ_ROUTE_MAP) as BlitzRouteMap,
      };
    },
    staleTime: 60_000,
  });
}