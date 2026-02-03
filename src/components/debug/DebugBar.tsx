import { useDebug, canUseDebugTools, DebugTab } from '@/contexts/DebugContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  Globe, 
  Layers, 
  Terminal, 
  MapPin, 
  X, 
  ChevronUp, 
  ChevronDown,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { QueriesPanel } from './panels/QueriesPanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { ConsolePanel } from './panels/ConsolePanel';
import { StatePanel } from './panels/StatePanel';
import { RoutePanel } from './panels/RoutePanel';
import { useState, useCallback } from 'react';

interface TabConfig {
  id: DebugTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  getCount: (state: ReturnType<typeof useDebug>) => number;
  getErrorCount?: (state: ReturnType<typeof useDebug>) => number;
}

const tabs: TabConfig[] = [
  { 
    id: 'queries', 
    label: 'Queries', 
    icon: Database,
    getCount: (s) => s.queries.length,
    getErrorCount: (s) => s.queries.filter(q => q.error).length
  },
  { 
    id: 'network', 
    label: 'Network', 
    icon: Globe,
    getCount: (s) => s.networkRequests.length,
    getErrorCount: (s) => s.networkRequests.filter(r => r.error || r.status >= 400).length
  },
  { 
    id: 'state', 
    label: 'State', 
    icon: Layers,
    getCount: (s) => 0 // Calculated differently
  },
  { 
    id: 'console', 
    label: 'Console', 
    icon: Terminal,
    getCount: (s) => s.consoleLogs.length,
    getErrorCount: (s) => s.consoleLogs.filter(l => l.level === 'error').length
  },
  { 
    id: 'route', 
    label: 'Route', 
    icon: MapPin,
    getCount: (s) => s.routeHistory.length
  },
];

export function DebugBar() {
  const state = useDebug();
  const { user } = useAuth();
  const { enabled, expanded, activeTab, setExpanded, setActiveTab, setEnabled } = state;
  const [height, setHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, 100), 500);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  // Don't render if user doesn't have access or it's disabled
  if (!canUseDebugTools(user?.role) || !enabled) {
    return null;
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 'queries': return <QueriesPanel />;
      case 'network': return <NetworkPanel />;
      case 'state': return <StatePanel />;
      case 'console': return <ConsolePanel />;
      case 'route': return <RoutePanel />;
    }
  };

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-[100] transition-all duration-200",
        isResizing && "select-none"
      )}
      style={{ height: expanded ? height : 28 }}
    >
      {/* Resize handle */}
      {expanded && (
        <div 
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/50 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Tab bar */}
      <div className="flex items-center h-7 bg-muted/50 border-b border-border px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 mr-1"
          onClick={() => setEnabled(false)}
          title="Fechar DebugBar"
        >
          <X className="h-3 w-3" />
        </Button>

        <div className="flex items-center gap-0.5 flex-1">
          {tabs.map((tab) => {
            const count = tab.getCount(state);
            const errorCount = tab.getErrorCount?.(state) ?? 0;
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (!expanded) setExpanded(true);
                }}
              >
                <Icon className="h-3 w-3" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "px-1 py-0 text-[10px] rounded-full min-w-[16px] text-center",
                    isActive 
                      ? "bg-primary-foreground/20" 
                      : "bg-muted-foreground/20"
                  )}>
                    {count}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="px-1 py-0 text-[10px] rounded-full bg-destructive text-destructive-foreground min-w-[16px] text-center">
                    {errorCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Minimizar" : "Expandir"}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Panel content */}
      {expanded && (
        <div className="h-[calc(100%-28px)]">
          {renderPanel()}
        </div>
      )}
    </div>
  );
}
