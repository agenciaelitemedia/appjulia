import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { X, Loader2 } from "lucide-react";
import juliaLogo from "@/assets/julia-logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuModules, getSortedGroups } from "@/hooks/useMenuModules";
import { getIcon } from "@/lib/iconMap";
import { DebugBarToggle } from "@/components/debug/DebugBarToggle";
import { useEnsureDataJudModule } from "@/pages/datajud/hooks/useEnsureDataJudModule";
import { useEnsureMonitoramentoModule } from "@/pages/admin/monitoramento/hooks/useEnsureMonitoramentoModule";
import { useEnsureCopilotModule } from "@/hooks/useEnsureCopilotModule";
import { useEnsureTelefoniaModule } from "@/hooks/useEnsureTelefoniaModule";
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  onCollapse: () => void;
}

export function Sidebar({ isOpen, onToggle, isCollapsed }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { groupedModules, isLoading } = useMenuModules();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  
  // Ensure DataJud module exists for admins
  useEnsureDataJudModule();
  useEnsureMonitoramentoModule();
  useEnsureCopilotModule();

  const isTimeUser = user?.role === "time";
  
  // Get sorted groups
  const sortedGroups = getSortedGroups(groupedModules);
  
  // Filter groups for time users (hide team)
  const filteredGroups = sortedGroups.map(([groupName, modules]) => {
    const filteredModules = modules.filter(mod => {
      // Hide team module for time users
      if (isTimeUser && mod.code === 'team') return false;
      return true;
    });
    return [groupName, filteredModules] as [string, typeof modules];
  }).filter(([_, modules]) => modules.length > 0);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => 
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const sidebarWidth = isCollapsed ? "w-16" : "w-64";

  return (
    <TooltipProvider delayDuration={0}>
      <>
        {/* Mobile overlay */}
        {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 z-50 h-full bg-sidebar transition-all duration-300 ease-in-out lg:translate-x-0",
            "flex flex-col",
            isOpen ? "translate-x-0" : "-translate-x-full",
            sidebarWidth,
            "border-r border-sidebar-border",
          )}
        >
          {/* Logo Header */}
          <div className={cn(
            "flex items-center h-16 border-b border-sidebar-border shrink-0",
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            <div className="flex items-center gap-2">
              <img src={juliaLogo} alt="Julia IA" className="w-8 h-8 rounded-lg" />
              {!isCollapsed && (
                <span className="text-lg font-semibold">
                  <span className="text-sidebar-foreground">Jul</span>
                  <span className="text-brand">IA</span>
                </span>
              )}
            </div>
            {!isCollapsed && (
              <Button variant="ghost" size="icon" onClick={onToggle} className="lg:hidden text-sidebar-foreground">
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Menu */}
          <ScrollArea className="flex-1 min-h-0">
            <nav className={cn("p-4 space-y-6", isCollapsed && "px-2 py-4 space-y-4")}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground/50" />
                </div>
              ) : (
                filteredGroups.map(([groupName, modules]) => (
                  <div key={groupName}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <h3 className={cn(
                          "text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2",
                          isCollapsed && "px-1"
                        )}>
                          {isCollapsed ? groupName.slice(0, 3) : groupName}
                        </h3>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" className="font-medium">
                          {groupName}
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <ul className="space-y-1">
                      {modules.map((mod) => {
                        const Icon = getIcon(mod.icon);
                        const isActive = location.pathname === mod.route;
                        
                        return (
                          <li key={mod.code}>
                            {isCollapsed ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <NavLink
                                    to={mod.route || '/'}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg transition-colors",
                                      isActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                    )}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </NavLink>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="font-medium">
                                  {mod.name}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <NavLink
                                to={mod.route || '/'}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                  isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                )}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{mod.name}</span>
                              </NavLink>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </nav>
          </ScrollArea>
          
          {/* Developer Tools Toggle - Fixed at bottom */}
          <DebugBarToggle isCollapsed={isCollapsed} />
        </aside>
      </>
    </TooltipProvider>
  );
}

export { sidebarWidthClass };

function sidebarWidthClass(isCollapsed: boolean) {
  return isCollapsed ? "lg:ml-16" : "lg:ml-64";
}
