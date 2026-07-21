import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BLITZ_ROUTE_PREFIX,
  isBlitzHost,
  resolveBlitzTarget,
  resolveInitialBlitzTarget,
} from "@/blitzleads/lib/subdomain";
import { useBlitzRouteMap } from "@/blitzleads/hooks/useBlitzRouteMap";

/**
 * When the app loads on a BlitzLeads subdomain, force navigation into
 * /BlitzLead/*.
 *
 * The first pass is synchronous (render-time <Navigate>) so it wins the race
 * against Julia's ProtectedRoute -> /login redirect. A second pass then
 * applies any DB-backed override from `blitzleads_route_config`.
 */
export function BlitzSubdomainGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const onBlitzHost = isBlitzHost();
  const { data } = useBlitzRouteMap();

  // Second pass: DB-backed overrides once the route map resolves.
  useEffect(() => {
    if (!onBlitzHost) return;
    if (!data?.mappings) return;
    const override = resolveBlitzTarget(location.pathname, data.mappings);
    if (override && override !== location.pathname) {
      navigate(override, { replace: true });
    }
  }, [onBlitzHost, location.pathname, data?.mappings, navigate]);

  if (!onBlitzHost) return null;
  if (location.pathname.startsWith(BLITZ_ROUTE_PREFIX)) return null;

  const target = resolveInitialBlitzTarget(location.pathname);
  if (target && target !== location.pathname) {
    return <Navigate to={target} replace />;
  }
  return null;
}