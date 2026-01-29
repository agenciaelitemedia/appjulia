import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import juliaLogo from '@/assets/julia-logo.png';
import loginBackground from '@/assets/login-background.webp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('mario@atendejulia.com.br');
  const [password, setPassword] = useState('Julia@0028');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Preencha todos os campos',
      });
      return;
    }

    setIsSubmitting(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });
      navigate('/dashboard');
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro no login',
        description: result.error,
      });
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Login Form (30%) */}
      <div className="w-full lg:w-[30%] min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <img src={juliaLogo} alt="Julia IA Logo" className="w-20 h-20 rounded-2xl" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Bem-vindo!</h1>
            <p className="text-muted-foreground mt-2">
              Informe seus dados para entrar:
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                className="h-12"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className="h-12 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Right side - Image & Text (70%) */}
      <div 
        className="hidden lg:flex w-[70%] min-h-screen relative bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginBackground})` }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-slate-900/80" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight max-w-2xl">
            A IA que atende, qualifica e fecha contratos sozinha
          </h2>
          <p className="mt-6 text-lg text-slate-300 max-w-xl leading-relaxed">
            Julia é a inteligência artificial especializada em advocacia que trabalha 24/7 no WhatsApp do seu escritório, convertendo leads em clientes enquanto você foca no que realmente importa.
          </p>
        </div>

        {/* Decorative dots pattern */}
        <div className="absolute top-8 right-8 grid grid-cols-6 gap-2 opacity-30">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
          ))}
        </div>
        <div className="absolute bottom-8 right-8 grid grid-cols-6 gap-2 opacity-30">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
