import { NavLink, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { X_JULIA_ROUTES } from '../module';
import { XJScopeBar } from './XJScopeBar';

const TABS = [
  { label: 'Painel', to: X_JULIA_ROUTES.dashboard },
  { label: 'Atendimentos', to: X_JULIA_ROUTES.sessions },
  { label: 'CRM', to: X_JULIA_ROUTES.crm },
  { label: 'Agentes', to: X_JULIA_ROUTES.agents },
  { label: 'Casos jurídicos', to: X_JULIA_ROUTES.cases },
  { label: 'Contratos', to: X_JULIA_ROUTES.contracts },
  { label: 'Agenda', to: X_JULIA_ROUTES.agenda },
];

interface XJLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function XJLayout({ title, description, actions, children }: XJLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-1">
        {TABS.map((tab) => {
          const active = tab.to === X_JULIA_ROUTES.dashboard ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                'rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <XJScopeBar />

      {children}
    </div>
  );
}