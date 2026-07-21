/**
 * BlitzLeads subdomain detection + route mapping helpers.
 * The module runs at /BlitzLead/* internally. When the user is on the
 * `blitzleads.*` subdomain we transparently prefix routes so it feels like
 * a standalone product.
 */

export const BLITZ_ROUTE_PREFIX = "/BlitzLead";
export const BLITZ_SUBDOMAIN_PATTERN = /^blitzleads\./i;

export type BlitzRouteMap = Record<string, string>;

export const DEFAULT_BLITZ_ROUTE_MAP: BlitzRouteMap = {
  "/": "/BlitzLead/",
  "/blitz_auth": "/BlitzLead/blitz_auth",
  "/atendimentos": "/BlitzLead/atendimentos",
};

export function isBlitzHost(hostname: string = window.location.hostname): boolean {
  return BLITZ_SUBDOMAIN_PATTERN.test(hostname);
}

export function resolveBlitzTarget(pathname: string, map: BlitzRouteMap = DEFAULT_BLITZ_ROUTE_MAP): string | null {
  if (pathname.startsWith(BLITZ_ROUTE_PREFIX)) return null;
  if (map[pathname]) return map[pathname];
  // Fallback: prefix any path with /BlitzLead
  const normalized = pathname === "/" ? "/" : pathname;
  return `${BLITZ_ROUTE_PREFIX}${normalized === "/" ? "/" : normalized}`;
}

/**
 * Synchronous, DB-independent resolution used at the very first render on the
 * BlitzLeads subdomain. Ensures we never fall through to Julia routes like
 * `/login` before the DB-backed mapping is available.
 */
export function resolveInitialBlitzTarget(pathname: string): string | null {
  if (pathname.startsWith(BLITZ_ROUTE_PREFIX)) return null;
  if (pathname === "/" || pathname === "") return `${BLITZ_ROUTE_PREFIX}/`;
  if (pathname === "/login" || pathname === "/blitz_auth") {
    return `${BLITZ_ROUTE_PREFIX}/blitz_auth`;
  }
  return `${BLITZ_ROUTE_PREFIX}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}