import { NavLink } from "react-router-dom";
import { LayoutGrid, Phone, Ticket, PhoneCall, Bot, MessageSquare, FolderKanban, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import blitzLogo from "@/blitzleads/assets/blitzleads-sidebar-dark.png.asset.json";

const SECTIONS: { title: string; items: { to: string; label: string; icon: any; color: string; badge?: string; disabled?: boolean }[] }[] = [
  {
    title: "Principal",
    items: [
      { to: "/BlitzLead/dashboard", label: "Dashboard", icon: LayoutGrid,    color: "#60a5fa", disabled: true },
      { to: "/BlitzLead/chat",      label: "Chat",      icon: MessageSquare, color: "#22c55e", disabled: true },
      { to: "/BlitzLead/crm",       label: "CRM",       icon: FolderKanban,  color: "#f59e0b", disabled: true },
    ],
  },
  {
    title: "Operação",
    items: [
      { to: "/BlitzLead/call-center", label: "Call Center", icon: Phone,     color: "#ef4444", badge: "6" },
      { to: "/BlitzLead/tickets",     label: "Tickets",     icon: Ticket,    color: "#8b5cf6", disabled: true },
      { to: "/BlitzLead/telefonia",   label: "Telefonia",   icon: PhoneCall, color: "#3b82f6", disabled: true },
      { to: "/BlitzLead/agentes",     label: "Agentes",     icon: Bot,       color: "#06b6d4", disabled: true },
    ],
  },
];

export function BlitzSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name ?? "US").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside
      className="w-[216px] shrink-0 flex flex-col min-h-screen sticky top-0 gap-[3px] px-3 py-3.5"
      style={{ background: "#0f172a", color: "#cbd5e1" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5">
        <img
          src={blitzLogo.url}
          alt="BlitzLeads"
          className="h-11 w-auto max-w-full object-contain"
          style={{ mixBlendMode: "screen" }}
        />
      </div>

      <nav className="flex-1 flex flex-col gap-[3px]">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="flex flex-col gap-[3px]">
            <div
              className="px-2.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "#64748b" }}
            >
              {sec.title}
            </div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              if (item.disabled) {
                return (
                  <div
                    key={item.to}
                    className="flex items-center gap-[11px] px-[11px] py-[9px] rounded-[10px] text-[13.5px] font-semibold cursor-not-allowed"
                    style={{ color: "#64748b" }}
                  >
                    <Icon className="w-[18px] h-[18px] opacity-70" style={{ color: item.color }} />
                    <span className="flex-1">{item.label}</span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-[11px] px-[11px] py-[9px] rounded-[10px] text-[13.5px] font-semibold transition-colors ${
                      isActive ? "text-white" : "hover:bg-[#1e293b] hover:text-white"
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? { background: "linear-gradient(135deg,#2563eb,#4338ca)", color: "#fff" }
                      : { color: "#cbd5e1" }
                  }
                >
                  {({ isActive }: { isActive: boolean }) => null}
                  <Icon
                    className="w-[18px] h-[18px]"
                    style={{ color: item.color }}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className="text-[10px] font-extrabold px-[7px] py-px rounded-full"
                      style={{ background: "#ef4444", color: "#fff" }}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        className="mt-auto flex items-center gap-[9px] px-2.5 py-2.5 border-t"
        style={{ borderColor: "#1e293b" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white"
          style={{ background: "#1e293b" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-white truncate">{user?.name ?? "Usuário"}</div>
          <div className="text-[10px] truncate" style={{ color: "#64748b" }}>Atendente</div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/BlitzLead/blitz_auth");
          }}
          className="p-1.5 rounded-md hover:bg-[#1e293b]"
          style={{ color: "#94a3b8" }}
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}