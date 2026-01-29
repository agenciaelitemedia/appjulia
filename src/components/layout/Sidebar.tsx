import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Bot,
  CreditCard,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  BarChart3,
  FileCheck,
  UserPlus,
  Package,
  Library,
  UsersRound,
  Shield,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import juliaLogo from "@/assets/julia-logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
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

interface MenuGroup {
  label: string;
  items: MenuItem[];
  adminOnly?: boolean;
}

interface MenuItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
  hideForTime?: boolean;
}

const menuGroups: MenuGroup[] = [
  {
    label: "PRINCIPAL",
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "AGENTES DA JULIA",
    items: [
      { label: "Meus Agentes", icon: Bot, href: "/agente/meus-agentes" },
      { label: "FollowUP", icon: MessageSquare, href: "/agente/followup" },
      { label: "Desempenho Julia", icon: BarChart3, href: "/estrategico/desempenho" },
      { label: "Contratos Julia", icon: FileCheck, href: "/estrategico/contratos" },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Leads", icon: Users, href: "/crm/leads" },
      { label: "Monitoramento", icon: BarChart3, href: "/crm/lead-monitoramento" },
      { label: "Estatísticas", icon: BarChart3, href: "/crm/lead-estatisticas" },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { label: "Biblioteca", icon: Library, href: "/biblioteca" },
      { label: "Equipe", icon: UsersRound, href: "/equipe", hideForTime: true },
    ],
  },
  {
    label: "ADMINISTRATIVO",
    adminOnly: true,
    items: [
      { label: "Lista de Agentes", icon: Bot, href: "/admin/agentes" },
      { label: "Novo Agente", icon: UserPlus, href: "/admin/agentes-novo" },
      { label: "Permissões", icon: Shield, href: "/admin/permissoes" },
      { label: "Produtos", icon: Package, href: "/admin/produtos" },
      { label: "Arquivos Clientes", icon: FileText, href: "/admin/arquivos-clientes" },
    ],
  },
  {
    label: "FINANCEIRO",
    adminOnly: true,
    items: [
      { label: "Cobranças", icon: CreditCard, href: "/financeiro/cobrancas" },
      { label: "Clientes", icon: Users, href: "/financeiro/clientes" },
      { label: "Relatórios", icon: BarChart3, href: "/financeiro/relatorios" },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    adminOnly: true,
    items: [{ label: "Sistema", icon: Settings, href: "/configuracoes" }],
  },
];

export function Sidebar({ isOpen, onToggle, isCollapsed, onCollapse }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const isAdmin = user?.role === "admin";
  const isTimeUser = user?.role === "time";
  const filteredGroups = menuGroups
    .filter((group) => !group.adminOnly || isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.hideForTime || !isTimeUser),
    }))
    .filter((group) => group.items.length > 0);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.href) {
      return location.pathname === item.href;
    }
    if (item.children) {
      return item.children.some((child) => location.pathname === child.href);
    }
    return false;
  };

  const sidebarWidth = isCollapsed ? "w-16" : "w-64";
  const sidebarWidthClass = isCollapsed ? "lg:ml-16" : "lg:ml-64";

  return (
    <TooltipProvider delayDuration={0}>
      <>
        {/* Mobile overlay */}
        {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 z-50 h-full bg-sidebar transition-all duration-300 ease-in-out lg:translate-x-0",
            isOpen ? "translate-x-0" : "-translate-x-full",
            sidebarWidth,
            "border-r border-sidebar-border",
          )}
        >
          {/* Logo Header */}
          <div className={cn(
            "flex items-center h-16 border-b border-sidebar-border",
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
          <ScrollArea className="h-[calc(100vh-4rem-3rem)]">
            <nav className={cn("p-4 space-y-6", isCollapsed && "p-2 space-y-4")}>
              {filteredGroups.map((group) => (
                <div key={group.label}>
                  {!isCollapsed && (
                    <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                      {group.label}
                    </h3>
                  )}
                  <ul className={cn("space-y-1", isCollapsed && "space-y-2")}>
                    {group.items.map((item) => (
                      <li key={item.label}>
                        {item.children ? (
                          // Items with children (submenu)
                          <div>
                            {isCollapsed ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => toggleMenu(item.label)}
                                    className={cn(
                                      "w-full flex items-center justify-center p-2 rounded-lg transition-colors",
                                      isMenuActive(item)
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                    )}
                                  >
                                    <item.icon className="w-5 h-5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="font-medium">
                                  {item.label}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <>
                                <button
                                  onClick={() => toggleMenu(item.label)}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    isMenuActive(item)
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                  </div>
                                  {expandedMenus.includes(item.label) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                {expandedMenus.includes(item.label) && (
                                  <ul className="mt-1 ml-7 space-y-1">
                                    {item.children.map((child) => (
                                      <li key={child.href}>
                                        <NavLink
                                          to={child.href}
                                          className={({ isActive }) =>
                                            cn(
                                              "block px-3 py-2 rounded-lg text-sm transition-colors",
                                              isActive
                                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                                : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                            )
                                          }
                                        >
                                          {child.label}
                                        </NavLink>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          // Regular menu items
                          isCollapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <NavLink
                                  to={item.href!}
                                  className={({ isActive }) =>
                                    cn(
                                      "flex items-center justify-center p-2 rounded-lg transition-colors",
                                      isActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                    )
                                  }
                                >
                                  <item.icon className="w-5 h-5" />
                                </NavLink>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="font-medium">
                                {item.label}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <NavLink
                              to={item.href!}
                              className={({ isActive }) =>
                                cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                  isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                                )
                              }
                            >
                              <item.icon className="w-4 h-4" />
                              <span>{item.label}</span>
                            </NavLink>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Collapse Toggle Button */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-12 border-t border-sidebar-border flex items-center",
            isCollapsed ? "justify-center" : "justify-end px-4"
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCollapse}
                  className="text-sidebar-foreground hover:bg-sidebar-accent/50 hidden lg:flex"
                >
                  {isCollapsed ? (
                    <PanelLeft className="w-5 h-5" />
                  ) : (
                    <PanelLeftClose className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? "Expandir menu" : "Recolher menu"}
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>
      </>
    </TooltipProvider>
  );
}

export { sidebarWidthClass };

function sidebarWidthClass(isCollapsed: boolean) {
  return isCollapsed ? "lg:ml-16" : "lg:ml-64";
}
