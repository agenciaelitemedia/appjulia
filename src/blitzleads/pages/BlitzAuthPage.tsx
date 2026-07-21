import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import loginLogo from "@/blitzleads/assets/blitzleads-login.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function BlitzAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) navigate("/BlitzLead/call-center", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return <Navigate to="/BlitzLead/call-center" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos" });
      return;
    }
    setIsSubmitting(true);
    const result = await login(email, password);
    if (result.success) {
      toast({ title: "Bem-vindo à BlitzLeads!" });
      navigate("/BlitzLead/call-center");
    } else {
      toast({ variant: "destructive", title: "Falha no login", description: result.error });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-black">
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex justify-center">
            <img src={loginLogo} alt="BlitzLeads" className="max-w-[280px] w-full" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Acesse sua conta</h1>
            <p className="text-slate-500 mt-1 text-sm">Recupere. Qualifique. Converta.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSubmitting} autoComplete="email" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isSubmitting} autoComplete="current-password" className="h-12 pr-12" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4 text-slate-500" /> : <Eye className="h-4 w-4 text-slate-500" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>) : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
      <div className="hidden lg:flex w-[55%] min-h-screen items-center justify-center px-16 relative bg-black">
        <div className="text-center max-w-lg">
          <img src={loginLogo} alt="BlitzLeads" className="mx-auto mb-8 max-w-md w-full" />
          <h2 className="text-3xl font-bold text-white leading-tight">Sistema de recuperação de leads para sua equipe de vendas</h2>
          <p className="mt-4 text-slate-400">Priorização automática, SLA em tempo real, e recuperação de oportunidades paradas.</p>
        </div>
      </div>
    </div>
  );
}