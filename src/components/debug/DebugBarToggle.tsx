import { useDebug, isDevEnvironment } from '@/contexts/DebugContext';
import { Switch } from '@/components/ui/switch';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { Bug, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface DebugBarToggleProps {
  isCollapsed?: boolean;
}

export function DebugBarToggle({ isCollapsed = false }: DebugBarToggleProps) {
  const { enabled, setEnabled } = useDebug();
  const [isOpen, setIsOpen] = useState(false);

  // Only show in dev environment
  if (!isDevEnvironment) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="px-2 py-2">
        <button
          className={cn(
            "flex items-center justify-center w-full p-2 rounded-lg transition-colors",
            enabled 
              ? "bg-primary/20 text-primary" 
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50"
          )}
          onClick={() => setEnabled(!enabled)}
          title={enabled ? "Desativar DebugBar" : "Ativar DebugBar"}
        >
          <Bug className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 border-t border-sidebar-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
          <div className="flex items-center gap-2">
            <Bug className="h-3.5 w-3.5" />
            <span className="font-medium">Developer Tools</span>
          </div>
          <ChevronDown 
            className={cn(
              "h-3 w-3 transition-transform",
              isOpen && "rotate-180"
            )} 
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="flex items-center justify-between py-1.5 px-1">
            <span className="text-xs text-sidebar-foreground">DebugBar</span>
            <Switch 
              checked={enabled} 
              onCheckedChange={setEnabled}
              className="scale-75"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
