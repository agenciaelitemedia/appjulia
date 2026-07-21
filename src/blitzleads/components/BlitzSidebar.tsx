import { NavLink } from "react-router-dom";
import { LayoutGrid, Flame, FileText, BarChart3, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import headerLogoAsset from "@/blitzleads/assets/blitzleads-sidebar.png.asset.json";

const NAV = [
  { to: "/BlitzLead/call-center", label: "Call Center", icon: Flame, badge: "6" },
  { to: "/BlitzLead/painel", label: "Painel", icon: LayoutGrid, disabled: true },
  { to: "/BlitzLead/contratos", label: "Contratos", icon: FileText, disabled: true },
  { to: "/BlitzLead/relatorios", label: "Relatórios", icon: BarChart3, disabled: true },
  { to: "/BlitzLead/configuracoes", label: "Configurações", icon: Settings, disabled: true },
];

export function BlitzSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="w-60 shrink-0 bg-slate-950 text-slate-200 flex flex-col min-h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-slate-800/60 flex items-center justify-center">
        <img
          src={headerLogoAsset.url}
          alt="BlitzLeads"
          className="h-16 w-auto object-contain"
          style={{ mixBlendMode: "screen" }}
        />
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 cursor-not-allowed"
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-600/20 text-white ring-1 ring-violet-500/40"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800/60">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-100 truncate">{user?.name ?? "Usuário"}</div>
            <div className="text-[11px] text-slate-500 truncate">Operador</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/BlitzLead/blitz_auth");
            }}
            className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-slate-800"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}