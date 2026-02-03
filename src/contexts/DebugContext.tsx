import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// Environment detection
export const isDevEnvironment = 
  typeof window !== 'undefined' && 
  (
    window.location.hostname.includes('lovable.app') || 
    window.location.hostname.includes('lovableproject.com') || 
    window.location.hostname === 'localhost'
  );

// Helper function to check if user can use debug tools
export function canUseDebugTools(userRole?: string): boolean {
  const isPrivilegedUser = userRole === 'admin' || userRole === 'colaborador';
  return isDevEnvironment || isPrivilegedUser;
}

// Types
export interface QueryLog {
  id: string;
  action: string;
  query?: string;
  params?: any[];
  duration: number;
  timestamp: Date;
  result?: any;
  error?: string;
}

export interface NetworkLog {
  id: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: Date;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}

export interface ConsoleLog {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  timestamp: Date;
}

export interface RouteLog {
  id: string;
  pathname: string;
  search: string;
  timestamp: Date;
}

export type DebugTab = 'queries' | 'network' | 'state' | 'console' | 'route';

interface DebugState {
  enabled: boolean;
  expanded: boolean;
  activeTab: DebugTab;
  queries: QueryLog[];
  networkRequests: NetworkLog[];
  consoleLogs: ConsoleLog[];
  routeHistory: RouteLog[];
}

interface DebugContextValue extends DebugState {
  setEnabled: (enabled: boolean) => void;
  setExpanded: (expanded: boolean) => void;
  setActiveTab: (tab: DebugTab) => void;
  addQuery: (query: Omit<QueryLog, 'id' | 'timestamp'>) => void;
  addNetworkRequest: (request: Omit<NetworkLog, 'id' | 'timestamp'>) => void;
  addConsoleLog: (log: Omit<ConsoleLog, 'id' | 'timestamp'>) => void;
  addRouteLog: (route: Omit<RouteLog, 'id' | 'timestamp'>) => void;
  clearLogs: (type?: 'queries' | 'network' | 'console' | 'route' | 'all') => void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

// Unique ID generator
let idCounter = 0;
const generateId = () => `debug-${Date.now()}-${++idCounter}`;

// Max logs to keep
const MAX_LOGS = 100;

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(() => {
    if (!isDevEnvironment) return false;
    return localStorage.getItem('debugbar-enabled') === 'true';
  });
  
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>('queries');
  const [queries, setQueries] = useState<QueryLog[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkLog[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteLog[]>([]);

  // Persist enabled state
  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem('debugbar-enabled', String(value));
    // Set global flag for externalDb
    (window as any).__DEBUG_ENABLED__ = value;
  }, []);

  // Set global flag on mount
  useEffect(() => {
    (window as any).__DEBUG_ENABLED__ = enabled;
  }, [enabled]);

  const addQuery = useCallback((query: Omit<QueryLog, 'id' | 'timestamp'>) => {
    setQueries(prev => {
      const newLog: QueryLog = { ...query, id: generateId(), timestamp: new Date() };
      return [newLog, ...prev].slice(0, MAX_LOGS);
    });
  }, []);

  const addNetworkRequest = useCallback((request: Omit<NetworkLog, 'id' | 'timestamp'>) => {
    setNetworkRequests(prev => {
      const newLog: NetworkLog = { ...request, id: generateId(), timestamp: new Date() };
      return [newLog, ...prev].slice(0, MAX_LOGS);
    });
  }, []);

  const addConsoleLog = useCallback((log: Omit<ConsoleLog, 'id' | 'timestamp'>) => {
    setConsoleLogs(prev => {
      const newLog: ConsoleLog = { ...log, id: generateId(), timestamp: new Date() };
      return [newLog, ...prev].slice(0, MAX_LOGS);
    });
  }, []);

  const addRouteLog = useCallback((route: Omit<RouteLog, 'id' | 'timestamp'>) => {
    setRouteHistory(prev => {
      const newLog: RouteLog = { ...route, id: generateId(), timestamp: new Date() };
      return [newLog, ...prev].slice(0, MAX_LOGS);
    });
  }, []);

  const clearLogs = useCallback((type?: 'queries' | 'network' | 'console' | 'route' | 'all') => {
    if (!type || type === 'all') {
      setQueries([]);
      setNetworkRequests([]);
      setConsoleLogs([]);
      setRouteHistory([]);
    } else if (type === 'queries') {
      setQueries([]);
    } else if (type === 'network') {
      setNetworkRequests([]);
    } else if (type === 'console') {
      setConsoleLogs([]);
    } else if (type === 'route') {
      setRouteHistory([]);
    }
  }, []);

  // Listen for query events from externalDb
  useEffect(() => {
    if (!enabled) return;

    const handleQueryEvent = (e: CustomEvent<Omit<QueryLog, 'id' | 'timestamp'>>) => {
      addQuery(e.detail);
    };

    window.addEventListener('debug:query', handleQueryEvent as EventListener);
    return () => {
      window.removeEventListener('debug:query', handleQueryEvent as EventListener);
    };
  }, [enabled, addQuery]);

  // Intercept fetch
  const originalFetchRef = useRef<typeof fetch | null>(null);
  
  useEffect(() => {
    if (!enabled) {
      // Restore original fetch if we had intercepted it
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
        originalFetchRef.current = null;
      }
      return;
    }

    // Store original fetch
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch;
    }
    const originalFetch = originalFetchRef.current;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const startTime = performance.now();
      const [input, init] = args;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;

        // Clone response to read body
        const clonedResponse = response.clone();
        let responseBody: any;
        try {
          responseBody = await clonedResponse.json();
        } catch {
          try {
            responseBody = await clonedResponse.text();
          } catch {
            responseBody = '[Unable to read body]';
          }
        }

        addNetworkRequest({
          url,
          method,
          status: response.status,
          duration,
          requestBody: init?.body ? JSON.parse(init.body as string) : undefined,
          responseBody,
        });

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        addNetworkRequest({
          url,
          method,
          status: 0,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, [enabled, addNetworkRequest]);

  // Intercept console
  const originalConsoleRef = useRef<{
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Restore original console
      if (originalConsoleRef.current) {
        console.log = originalConsoleRef.current.log;
        console.warn = originalConsoleRef.current.warn;
        console.error = originalConsoleRef.current.error;
        console.info = originalConsoleRef.current.info;
        console.debug = originalConsoleRef.current.debug;
        originalConsoleRef.current = null;
      }
      return;
    }

    // Store original console methods
    if (!originalConsoleRef.current) {
      originalConsoleRef.current = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug,
      };
    }
    const original = originalConsoleRef.current;

    console.log = (...args: any[]) => {
      addConsoleLog({ level: 'log', args });
      original.log(...args);
    };

    console.warn = (...args: any[]) => {
      addConsoleLog({ level: 'warn', args });
      original.warn(...args);
    };

    console.error = (...args: any[]) => {
      addConsoleLog({ level: 'error', args });
      original.error(...args);
    };

    console.info = (...args: any[]) => {
      addConsoleLog({ level: 'info', args });
      original.info(...args);
    };

    console.debug = (...args: any[]) => {
      addConsoleLog({ level: 'debug', args });
      original.debug(...args);
    };

    return () => {
      if (originalConsoleRef.current) {
        console.log = originalConsoleRef.current.log;
        console.warn = originalConsoleRef.current.warn;
        console.error = originalConsoleRef.current.error;
        console.info = originalConsoleRef.current.info;
        console.debug = originalConsoleRef.current.debug;
      }
    };
  }, [enabled, addConsoleLog]);

  const value: DebugContextValue = {
    enabled,
    expanded,
    activeTab,
    queries,
    networkRequests,
    consoleLogs,
    routeHistory,
    setEnabled,
    setExpanded,
    setActiveTab,
    addQuery,
    addNetworkRequest,
    addConsoleLog,
    addRouteLog,
    clearLogs,
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}

// Hook for route tracking
export function useDebugRoute() {
  const context = useContext(DebugContext);
  
  const addRouteLog = useCallback((pathname: string, search: string) => {
    if (context?.enabled) {
      context.addRouteLog({ pathname, search });
    }
  }, [context]);

  return { addRouteLog };
}
