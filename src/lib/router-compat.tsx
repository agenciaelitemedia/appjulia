/**
 * react-router-dom compatibility shim backed by TanStack Router.
 *
 * The app was migrated from React Router to TanStack Start. Instead of
 * rewriting ~120 call sites at once, every former `react-router-dom` import
 * now resolves here. Semantics match the small React Router surface the app
 * actually used.
 */
import * as React from "react";
import {
  Link as TanStackLink,
  Outlet,
  useNavigate as useTanStackNavigate,
  useParams as useTanStackParams,
  useRouterState,
} from "@tanstack/react-router";

export { Outlet };

type To = string | number | { pathname?: string; search?: string; hash?: string };

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
  preventScrollReset?: boolean;
}

function splitTo(to: string): { pathname: string; search: string; hash: string } {
  const [beforeHash = "", hash = ""] = to.split("#");
  const [pathname = "", search = ""] = beforeHash.split("?");
  return {
    pathname: pathname || "/",
    search: search ? `?${search}` : "",
    hash: hash ? `#${hash}` : "",
  };
}

function toHref(to: To): string {
  if (typeof to === "string") return to;
  if (typeof to === "number") return "";
  const pathname = to.pathname ?? "";
  const search = to.search ? (to.search.startsWith("?") ? to.search : `?${to.search}`) : "";
  const hash = to.hash ? (to.hash.startsWith("#") ? to.hash : `#${to.hash}`) : "";
  return `${pathname}${search}${hash}`;
}

export function useNavigate() {
  const navigate = useTanStackNavigate();
  return React.useCallback(
    (to: To, options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      const href = toHref(to);
      if (!href) return;
      const { pathname, search, hash } = splitTo(href);
      void navigate({
        to: pathname,
        search: search ? Object.fromEntries(new URLSearchParams(search)) : undefined,
        hash: hash ? hash.slice(1) : undefined,
        replace: options?.replace ?? false,
        state: (options?.state ?? undefined) as never,
      } as never);
    },
    [navigate],
  );
}

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

export function useLocation(): Location {
  return useRouterState({
    select: ((s: { location: { pathname: string; searchStr?: string; hash?: string; state?: unknown } }) => {
      const loc = s.location;
      return {
        pathname: loc.pathname,
        search: loc.searchStr ?? "",
        hash: loc.hash ? (loc.hash.startsWith("#") ? loc.hash : `#${loc.hash}`) : "",
        state: loc.state,
        key: (loc.state as { key?: string } | undefined)?.key ?? "default",
      };
    }) as never,
  }) as unknown as Location;
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return useTanStackParams({ strict: false } as never) as T;
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams), options?: NavigateOptions) => void,
] {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  const navigate = useTanStackNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const params = React.useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const setSearchParams = React.useCallback(
    (
      next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams),
      options?: NavigateOptions,
    ) => {
      const resolved =
        typeof next === "function"
          ? next(new URLSearchParams(searchStr))
          : next instanceof URLSearchParams
            ? next
            : new URLSearchParams(next);
      void navigate({
        to: pathname,
        search: Object.fromEntries(resolved.entries()),
        replace: options?.replace ?? false,
      } as never);
    },
    [navigate, pathname, searchStr],
  );

  return [params, setSearchParams];
}

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: To;
  replace?: boolean;
  state?: unknown;
  preventScrollReset?: boolean;
  end?: boolean;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, preventScrollReset: _preventScrollReset, end: _end, ...rest },
  ref,
) {
  const href = toHref(to);
  const { pathname, search, hash } = splitTo(href || "/");
  const isExternal = /^(https?:|mailto:|tel:)/.test(href);

  if (isExternal) {
    return <a ref={ref} href={href} {...rest} />;
  }

  return (
    <TanStackLink
      ref={ref}
      to={pathname}
      search={search ? (Object.fromEntries(new URLSearchParams(search)) as never) : undefined}
      hash={hash ? hash.slice(1) : undefined}
      replace={replace ?? false}
      state={(state ?? undefined) as never}
      {...(rest as Record<string, unknown>)}
    />
  );
});

export interface NavLinkProps extends Omit<LinkProps, "className" | "style" | "children"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  style?: React.CSSProperties | ((props: { isActive: boolean; isPending: boolean }) => React.CSSProperties);
  children?: React.ReactNode | ((props: { isActive: boolean; isPending: boolean }) => React.ReactNode);
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, style, children, to, end, ...rest },
  ref,
) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const href = toHref(to);
  const { pathname } = splitTo(href || "/");
  const isActive = end ? currentPath === pathname : currentPath === pathname || currentPath.startsWith(`${pathname}/`);
  const renderProps = { isActive, isPending: false };

  return (
    <Link
      ref={ref}
      to={to}
      className={typeof className === "function" ? className(renderProps) : className}
      style={typeof style === "function" ? style(renderProps) : style}
      {...rest}
    >
      {typeof children === "function" ? children(renderProps) : children}
    </Link>
  );
});

export function Navigate({ to, replace, state }: { to: To; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to, { replace: replace ?? true, state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
