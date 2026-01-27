import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Bot,
  CreditCard,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Image,
  FolderOpen,
  MessageSquare,
  BarChart3,
  FileCheck,
  UserPlus,
  Package,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
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
}

const menuGroups: MenuGroup[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    ],
  },
  {
    label: 'SEU AGENTE',
    items: [
      { label: 'Meus Agentes', icon: Bot, href: '/agente/meus-agentes' },
      { label: 'FollowUP', icon: MessageSquare, href: '/agente/followup' },
      { label: 'Desempenho Julia', icon: BarChart3, href: '/estrategico/desempenho' },
      { label: 'Contratos Julia', icon: FileCheck, href: '/estrategico/contratos' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Leads', icon: Users, href: '/crm/leads' },
      { label: 'Monitoramento', icon: BarChart3, href: '/crm/lead-monitoramento' },
      { label: 'Estatísticas', icon: BarChart3, href: '/crm/lead-estatisticas' },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      { label: 'Criativos', icon: Image, href: '/criativos' },
    ],
  },
  {
    label: 'ADMINISTRATIVO',
    adminOnly: true,
    items: [
      { label: 'Lista de Agentes', icon: Bot, href: '/admin/agentes' },
      { label: 'Novo Agente', icon: UserPlus, href: '/admin/agentes-novo' },
      { label: 'Produtos', icon: Package, href: '/admin/produtos' },
      { label: 'Arquivos Clientes', icon: FileText, href: '/admin/arquivos-clientes' },
    ],
  },
  {
    label: 'FINANCEIRO',
    adminOnly: true,
    items: [
      { label: 'Cobranças', icon: CreditCard, href: '/financeiro/cobrancas' },
      { label: 'Clientes', icon: Users, href: '/financeiro/clientes' },
      { label: 'Relatórios', icon: BarChart3, href: '/financeiro/relatorios' },
    ],
  },
  {
    label: 'CONFIGURAÇÕES',
    adminOnly: true,
    items: [
      { label: 'Sistema', icon: Settings, href: '/configuracoes' },
    ],
  },
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  
  const isAdmin = user?.role === 'admin';
  const filteredGroups = menuGroups.filter(group => !group.adminOnly || isAdmin);

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.href) {
      // Apenas match exato para evitar múltiplos itens ativos
      return location.pathname === item.href;
    }
    if (item.children) {
      return item.children.some(child => 
        location.pathname === child.href
      );
    }
    return false;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-sidebar transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "w-64 border-r border-sidebar-border"
        )}
      >
        {/* Logo Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">
              <span className="text-sidebar-foreground">Jul</span>
              <span className="text-amber-500">IA</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="lg:hidden text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Menu */}
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                  {group.label}
                </h3>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.label}>
                      {item.children ? (
                        <div>
                          <button
                            onClick={() => toggleMenu(item.label)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                              isMenuActive(item)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
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
                                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                                      )
                                    }
                                  >
                                    {child.label}
                                  </NavLink>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <NavLink
                          to={item.href!}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                              isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                            )
                          }
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}
