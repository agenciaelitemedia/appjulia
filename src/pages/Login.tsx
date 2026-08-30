import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import logoAsset from '@/assets/atende-julia-logo.png.asset.json';
import mascoteAsset from '@/assets/julia-mascote-acenando.png.asset.json';
import mascotePose2 from '@/assets/julia-mascote-pose2.png.asset.json';
import mascotePose3 from '@/assets/julia-mascote-pose3.png.asset.json';
import metaTechProviderAsset from '@/assets/meta-tech-provider.png.asset.json';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { markJustLoggedIn } from '@/components/layout/DisconnectedAgentsAlert';
import { checkVersionAndReloadIfNeeded } from '@/lib/appVersion';
import { APP_VERSION_LABEL } from '@/lib/appVersionLabel';
import { toast as sonnerToast } from 'sonner';
import { isOwnerUser } from '@/lib/auth/isOwner';


const WHATSAPP_TIME =
  'https://wa.me/5534988860163?text=Quero%20informa%C3%A7%C3%B5es%20sobre%20a%20Julia%20IA';
const WHATSAPP_SUPORTE =
  'https://wa.me/5534988860163?text=Preciso%20recuperar%20o%20acesso%20da%20minha%20conta%20Atende%20Julia';

const HIGHLIGHTS = [
  {
    title: 'Novo contato recebido',
    subtitle: 'Mariana A. • WhatsApp • agora',
    dot: 'hsl(var(--aj-magenta))',
    delay: '0s',
  },
  {
    title: 'Lead qualificado',
    subtitle: 'Trabalhista • pronto para a equipe',
    dot: 'hsl(var(--aj-violet))',
    delay: '1.4s',
  },
  {
    title: 'Contrato em andamento',
    subtitle: 'Proposta enviada • aguardando assinatura',
    dot: 'hsl(var(--aj-success))',
    delay: '2.6s',
  },
];

const MASCOTE_POSES = [mascoteAsset.url, mascotePose2.url, mascotePose3.url];

/** Mascote trocando de pose com cross-fade contínuo. */
function MascoteAnimado({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((prev) => (prev + 1) % MASCOTE_POSES.length),
      3200,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`relative shrink-0 ${className ?? ''}`} style={style}>
      {MASCOTE_POSES.map((url, i) => (
        <img
          key={url}
          src={url}
          alt="Julia, assistente de atendimento com IA"
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-out"
          style={{ opacity: i === index ? 1 : 0 }}
          loading="eager"
          decoding="async"
        />
      ))}
    </div>
  );
}

/** Selo Meta Tech Provider com resumo e tooltip completo no hover. */
function MetaProviderBadge() {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="aj-glass aj-glass-hover group mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 transition-all duration-300">
            <img
              src={metaTechProviderAsset.url}
              alt="Meta Tech Provider"
              className="h-10 w-auto shrink-0 rounded-md object-contain"
              loading="eager"
              decoding="async"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Somos parceiros oficiais da Meta 💙
              </p>
              <p className="aj-muted truncate text-xs">
                Somos a primeira IA para advogados do Brasil
              </p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-[100] max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[hsl(260_26%_12%)]/95 p-0 text-white shadow-[0_20px_50px_-12px_hsl(215_100%_50%_/0.35)] backdrop-blur-xl"
        >
          <div className="relative p-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl"
              style={{ backgroundColor: 'hsl(215 100% 50%)' }}
            />
            <div className="relative flex items-start gap-3">
              <img
                src={metaTechProviderAsset.url}
                alt="Meta Tech Provider"
                className="mt-0.5 h-9 w-auto shrink-0 rounded-md object-contain"
              />
              <div>
                <p className="text-sm font-bold leading-snug">
                  Somos parceiros oficiais da Meta 💙
                </p>
                <p className="mt-1 text-xs font-medium text-white/70">
                  Parceiros reconhecidos para oferecer soluções oficiais, seguras e escaláveis.
                </p>
              </div>
            </div>
            <div
              className="my-3 h-px w-full"
              style={{ background: 'linear-gradient(90deg, transparent, hsl(215 100% 50% / 0.6), transparent)' }}
            />
            <div className="relative space-y-2 text-xs leading-relaxed text-white/85">
              <p>
                Somos parceiros reconhecidos pela Meta (Facebook, Instagram e WhatsApp) para
                oferecer soluções oficiais, seguras e escaláveis, principalmente no{' '}
                <strong className="text-white">WhatsApp Business Platform</strong>.
              </p>
              <p className="font-semibold text-white">Na prática?</p>
              <p>
                Mais tecnologia, mais performance e mais resultado para empresas que querem
                vender, atender e se comunicar melhor pelo WhatsApp!
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, user, permissions, permissionsLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Ao abrir a tela de login, checa se há nova versão publicada.
  useEffect(() => {
    void checkVersionAndReloadIfNeeded(() => {
      sonnerToast.info('Nova versão detectada. Atualizando…');
    });
  }, []);

  /**
   * `/chat` não é uma rota protegida por módulo (App.tsx) — logo, é liberada por
   * padrão. Só bloqueamos quando existir uma entrada explícita de módulo de chat
   * com `can_view = false` (bloqueio configurado manualmente).
   */
  const hasChatAccess = (() => {
    const entry = permissions?.get('chat' as any) ?? permissions?.get('julia_chat' as any);
    if (entry && entry.can_view === false) return false;
    return true;
  })();

  const postLoginRoute = !isOwnerUser(user) && hasChatAccess ? '/chat' : '/dashboard';
  const canRedirect = isAuthenticated && !permissionsLoading;

  useEffect(() => {
    if (canRedirect) navigate(postLoginRoute, { replace: true });
  }, [canRedirect, postLoginRoute, navigate]);

  if (canRedirect) {
    return <Navigate to={postLoginRoute} replace />;
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
      markJustLoggedIn();
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso' });
      // O redirecionamento acontece no efeito acima, após as permissões carregarem.
    } else {
      toast({ variant: 'destructive', title: 'Erro no login', description: result.error });
    }

    setIsSubmitting(false);
  };


  return (
    <main className="aj-login relative min-h-screen overflow-hidden">
      {/* Auroras */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="aj-aurora -top-40 -left-24 h-[28rem] w-[28rem]"
          style={{ backgroundColor: 'hsl(var(--aj-magenta) / 0.5)' }}
        />
        <div
          className="aj-aurora top-1/3 -right-32 h-[32rem] w-[32rem]"
          style={{ backgroundColor: 'hsl(var(--aj-violet) / 0.5)' }}
        />
      </div>
      <div aria-hidden="true" className="aj-grid-lines pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-10 px-5 py-10 lg:grid-cols-[55fr_45fr] lg:items-center lg:gap-16 lg:px-10">
        {/* Coluna esquerda */}
        <section className="flex min-w-0 flex-col justify-center">
          <div className="mb-8 flex min-w-0 items-center lg:mb-12">
            <img
              src={logoAsset.url}
              alt="ATENDE JULIA"
              className="h-10 w-auto shrink-0 sm:h-11"
              loading="eager"
              decoding="async"
            />
          </div>

          {/* Mobile */}
          <div className="flex items-center gap-5 lg:hidden">
            <MascoteAnimado className="h-24 w-24" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight">
                Somos os parceiros oficiais da Meta. Ajudamos a advogados a fechar contratos todo dia.
              </h1>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:block">
            <div>
              <h1 className="max-w-xl text-4xl font-bold leading-[1.08] xl:text-5xl">
                Somos os parceiros oficiais da Meta. 
                Dispare mensagens sem perder seu número.
              </h1>
              <p className="aj-muted mt-5 max-w-lg text-base leading-relaxed">
                Acesse sua conta para acompanhar, organizar e conduzir seus atendimentos com a Julia.
              </p>
            </div>

            <div className="relative mt-12 flex items-end gap-8">
              <MascoteAnimado
                className="aj-float h-64 w-64 xl:h-72 xl:w-72"
                style={{ filter: 'drop-shadow(0 30px 60px hsl(var(--aj-magenta) / 0.3))' }}
              />
              <ul className="mb-4 flex min-w-0 flex-1 flex-col gap-3">
                {HIGHLIGHTS.map((item) => (
                  <li
                    key={item.title}
                    className="aj-glass aj-glass-hover aj-float rounded-2xl px-4 py-3"
                    style={{ animationDelay: item.delay }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="aj-pulse-soft h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.dot }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="aj-muted truncate text-xs">{item.subtitle}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Coluna direita — card do formulário */}
        <section className="flex min-w-0 items-center">
          <div className="aj-glass aj-glow-ring w-full rounded-[2rem] p-6 sm:p-9">
            <h2 className="text-2xl font-bold sm:text-3xl">Bem-vindo de volta</h2>
            <p className="aj-muted mt-2 text-sm">Entre para acessar sua operação com a Julia.</p>

            <MetaProviderBadge />

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="aj-muted mb-2 block text-xs font-medium uppercase tracking-wide"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="aj-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="voce@escritorio.com.br"
                    className="aj-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="aj-muted mb-2 block text-xs font-medium uppercase tracking-wide"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="aj-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="aj-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    className="aj-muted absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors hover:opacity-80 focus-visible:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                    style={{
                      borderColor: 'hsl(var(--aj-magenta))',
                      backgroundColor: remember ? 'hsl(var(--aj-magenta))' : 'transparent',
                      color: 'hsl(0 0% 100%)',
                    }}
                  />
                  <label htmlFor="remember" className="aj-muted truncate text-sm">
                    Lembrar de mim
                  </label>
                </div>
                <a
                  href={WHATSAPP_SUPORTE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'hsl(var(--aj-magenta))' }}
                >
                  Esqueci minha senha
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="aj-bg-brand aj-glow-ring inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:opacity-70 sm:text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar na Atende Julia
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="my-7 flex items-center gap-4">
              <span className="h-px flex-1" style={{ backgroundColor: 'hsl(0 0% 100% / 0.1)' }} />
              <span className="aj-muted text-[11px] uppercase tracking-[0.18em]">ou</span>
              <span className="h-px flex-1" style={{ backgroundColor: 'hsl(0 0% 100% / 0.1)' }} />
            </div>

            <div className="text-center">
              <p className="aj-muted text-sm">Ainda não conhece a Julia?</p>
              <a
                href={WHATSAPP_TIME}
                target="_blank"
                rel="noopener noreferrer"
                className="aj-glass aj-glass-hover mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300"
              >
                Fale com nosso time
              </a>
            </div>

            <p className="aj-muted mt-7 flex items-center justify-center gap-2 text-center text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Ambiente seguro • Dados protegidos • Acesso exclusivo
            </p>
            <div className="mt-3 flex justify-center">
              <Badge variant="outline" className="aj-glass border-white/10 text-[10px] font-medium text-white/60">
                {APP_VERSION_LABEL}
              </Badge>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
