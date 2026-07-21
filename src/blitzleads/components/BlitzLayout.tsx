import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BlitzHeader } from "./BlitzHeader";

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <BlitzHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}