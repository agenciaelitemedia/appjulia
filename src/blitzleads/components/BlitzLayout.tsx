import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BlitzSidebar } from "./BlitzSidebar";
import { BlitzTopbar } from "./BlitzTopbar";

export default function BlitzLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (location.pathname.endsWith("/blitz_auth")) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/BlitzLead/blitz_auth" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <BlitzSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <BlitzTopbar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}