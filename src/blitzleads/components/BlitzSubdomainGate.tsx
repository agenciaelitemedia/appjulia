import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isBlitzHost, resolveBlitzTarget } from "@/blitzleads/lib/subdomain";
import { useBlitzRouteMap } from "@/blitzleads/hooks/useBlitzRouteMap";

/**
 * When the app loads on a BlitzLeads subdomain, force navigation into
 * /BlitzLead/* using the DB-backed route mapping.
 */
export function BlitzSubdomainGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useBlitzRouteMap();

  useEffect(() => {
    if (!isBlitzHost()) return;
    const target = resolveBlitzTarget(location.pathname, data?.mappings);
    if (target && target !== location.pathname) {
      navigate(target, { replace: true });
    }
  }, [location.pathname, data?.mappings, navigate]);

  return null;
}