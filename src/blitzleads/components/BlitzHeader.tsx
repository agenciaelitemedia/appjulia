import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import headerLogo from "@/blitzleads/assets/blitzleads-header.png";

export function BlitzHeader() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/BlitzLead/atendimentos" className="flex items-center">
          <img src={headerLogo} alt="BlitzLeads" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <>
              <span className="text-sm text-slate-600 hidden sm:block">{user?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate("/BlitzLead/blitz_auth");
                }}
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}