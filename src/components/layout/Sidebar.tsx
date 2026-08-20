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
import { useEnsureWavoipModule } from "@/hooks/useEnsureWavoipModule";
import { useEnsurePromptGeneratorModule } from "@/hooks/useEnsurePromptGeneratorModule";
import { useEnsureLegalCasesModule } from "@/hooks/useEnsureLegalCasesModule";

import { useEnsureContractNotificationsModule } from "@/hooks/useEnsureContractNotificationsModule";
import { useEnsureJuliaOrdersModule } from "@/hooks/useEnsureJuliaOrdersModule";
import { useEnsureJuliaPlansModule } from "@/hooks/useEnsureJuliaPlansModule";
import { useEnsureCrmComercialModule } from "@/hooks/useEnsureCrmComercialModule";
import { useEnsureSupportAssistantModule } from "@/hooks/useEnsureSupportAssistantModule";
import { useEnsureQuickMessagesModule } from "@/hooks/useEnsureQuickMessagesModule";
import { useEnsureHumanSupportModule } from "@/hooks/useEnsureHumanSupportModule";
import { useEnsurePushNotificationsModule } from "@/hooks/useEnsurePushNotificationsModule";
import { useEnsureContactsModule } from "@/hooks/useEnsureContactsModule";
import { useEnsureOperacoesModule } from "@/hooks/useEnsureOperacoesModule";
import { useEnsureTasksModule } from "@/hooks/useEnsureTasksModule";
import { useEnsureChatAdminModule } from "@/hooks/useEnsureChatAdminModule";
import { useEnsureVideoModule } from "@/hooks/useEnsureVideoModule";
import { useEnsureNotifyModule } from "@/hooks/useEnsureNotifyModule";
import { useEnsureTicketsModule } from "@/hooks/useEnsureTicketsModule";
import { useEnsureHelpCenterModule } from "@/hooks/useEnsureHelpCenterModule";
import { useEnsureEscritoriosModule } from "@/modules/escritorios/extend/useEnsureEscritoriosModule";
import { useEnsureXJuliaModule } from "@/modules/x-julia/extend/useEnsureXJuliaModule";
import { useEnsureAlertsModule } from "@/modules/notificacoes-alertas/extend/useEnsureAlertsModule";
import {
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

  // Ensure modules exist for admins
  useEnsureDataJudModule();
  useEnsureMonitoramentoModule();
  useEnsureCopilotModule();
  useEnsureTelefoniaModule();
  useEnsureWavoipModule();
  useEnsurePromptGeneratorModule();
  useEnsureLegalCasesModule();
  useEnsureContractNotificationsModule();
  useEnsureJuliaOrdersModule();
  useEnsureJuliaPlansModule();
  useEnsureCrmComercialModule();
  useEnsureSupportAssistantModule();
  useEnsureQuickMessagesModule();
  useEnsureHumanSupportModule();
  useEnsurePushNotificationsModule();
  useEnsureContactsModule();
  useEnsureOperacoesModule();
  useEnsureTasksModule();
  useEnsureChatAdminModule();
  useEnsureVideoModule();
  useEnsureNotifyModule();
  useEnsureTicketsModule();
  useEnsureHelpCenterModule();
  useEnsureEscritoriosModule();
  useEnsureXJuliaModule();
  useEnsureAlertsModule();

  // Get sorted groups — a visibilidade do módulo é decidida pelas
  // permissões carregadas em `useMenuModules`, sem bloqueios por role
  // hardcoded (permite delegar o módulo Equipe a um membro `time`).
  const filteredGroups = getSortedGroups(groupedModules)
    .filter(([_, modules]) => modules.length > 0);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isExpanded = isOpen || !isCollapsed;
  const sidebarWidth = isExpanded ? "w-64" : "w-16";

  return (
    <TooltipProvider delayDuration={0}>
      <>
        {/* Mobile overlay */}
        {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 z-50 h-full bg-sidebar transition-all duration-300 ease-in-out lg:translate-x-0 overflow-hidden",
            "flex flex-col",
            isOpen ? "translate-x-0" : "-translate-x-full",
            sidebarWidth,
            "border-r border-sidebar-border",
          )}
        >
          {/* Logo Header */}
          <div className={cn(
            "flex items-center h-16 border-b border-sidebar-border shrink-0 transition-all duration-300",
            isExpanded ? "justify-between px-4" : "justify-center px-2"
          )}>
            <div className="flex items-center gap-2 overflow-hidden">
              <img src={juliaLogo} alt="Julia IA" className="w-8 h-8 rounded-lg shrink-0" />
              <span
                className={cn(
                  "text-lg font-semibold overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                  isExpanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0"
                )}
              >
                <span className="text-sidebar-foreground">Jul</span>
                <span className="text-brand">IA</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className={cn(
                "lg:hidden text-sidebar-foreground transition-all duration-300 overflow-hidden",
                isExpanded ? "opacity-100 w-10 max-w-10" : "opacity-0 w-0 max-w-0 p-0"
              )}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Menu */}
          <ScrollArea className="flex-1 min-h-0">
            <nav className={cn("p-4 space-y-6 transition-all duration-300", !isExpanded && "px-2 py-4 space-y-4")}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground/50" />
                </div>
              ) : (
                filteredGroups.map(([groupName, modules]) => (
                  <div key={groupName}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 px-1 text-center cursor-default">
                          <span
                            className={cn(
                              "inline-block overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                              isExpanded ? "opacity-100 max-w-[12rem]" : "opacity-0 max-w-0"
                            )}
                          >
                            {groupName}
                          </span>
                          <span
                            className={cn(
                              "inline-block overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                              !isExpanded ? "opacity-100 max-w-10" : "opacity-0 max-w-0"
                            )}
                          >
                            {groupName.slice(0, 3)}
                          </span>
                        </h3>
                      </TooltipTrigger>
                      {!isExpanded && (
                        <TooltipContent side="right" sideOffset={8} className="font-medium z-[100]">
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <NavLink
                                  to={mod.route || '/'}
                                  className={cn(
                                    "flex items-center rounded-lg transition-all duration-300 ease-in-out",
                                    isExpanded ? "justify-start px-3 py-2 gap-3" : "justify-center p-2",
                                    isActive
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                  )}
                                >
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span
                                    className={cn(
                                      "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                                      isExpanded ? "opacity-100 max-w-[12rem]" : "opacity-0 max-w-0"
                                    )}
                                  >
                                    {mod.name}
                                  </span>
                                </NavLink>
                              </TooltipTrigger>
                              {!isExpanded && (
                                <TooltipContent side="right" sideOffset={8} className="font-medium z-[100]">
                                  {mod.name}
                                </TooltipContent>
                              )}
                            </Tooltip>
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
          <DebugBarToggle isCollapsed={!isExpanded} />
        </aside>
      </>
    </TooltipProvider>
  );
}

export { sidebarWidthClass };

function sidebarWidthClass(isCollapsed: boolean) {
  return isCollapsed ? "lg:ml-16" : "lg:ml-64";
}
