import { Menu, Search, LogOut, User, Settings, PanelLeftClose, PanelLeft, Volume2, VolumeX } from 'lucide-react';
import { HeaderDialer } from './HeaderDialer';
import { HeaderZapCallBadge } from './HeaderZapCallBadge';
import { PushNotificationOptIn } from '@/components/notifications/PushNotificationOptIn';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundAlertSettings } from '@/hooks/useSoundAlertSettings';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

declare const __APP_VERSION__: string;

const APP_VERSION_LABEL = (() => {
  try {
    const raw = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
    const n = Number(raw);
    if (Number.isFinite(n) && n > 1_000_000_000_000) {
      const d = new Date(n);
      const pad = (v: number) => String(v).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return raw || 'dev';
  } catch {
    return 'dev';
  }
})();

interface HeaderProps {
  onMenuToggle: () => void;
  isCollapsed?: boolean;
  onCollapse?: () => void;
}

export function Header({ onMenuToggle, isCollapsed, onCollapse }: HeaderProps) {
  const { user, logout } = useAuth();
  const { settings: soundSettings, isUserMuted, toggleUserMute } = useSoundAlertSettings();

  const myId = String(user?.id ?? '');
  const muted = isUserMuted(myId);
  const soundOn = soundSettings.enabled && !muted;
  const canToggleSound = soundSettings.enabled && soundSettings.userCanDisable;

  const soundTooltip = !soundSettings.enabled
    ? 'Alerta de som desativado pelo administrador'
    : !soundSettings.userCanDisable
      ? 'Seu administrador não permite desativar o alerta'
      : soundOn
        ? 'Som de novas mensagens ativo — clique para desativar'
        : 'Som de novas mensagens desativado — clique para ativar';

  const handleToggleSound = () => {
    if (!canToggleSound || toggleUserMute.isPending || !myId) return;
    const willMute = !muted;
    toggleUserMute.mutate(
      { userId: myId, mute: willMute },
      {
        onSuccess: () =>
          toast.success(willMute ? 'Alerta de som desativado' : 'Alerta de som ativado'),
        onError: (e: any) =>
          toast.error(`Erro ao alterar o alerta de som: ${e?.message ?? e}`),
      },
    );
  };

  // Avatar (clients.photo) is hydrated by AuthContext into `user.avatar`,
  // cached per client_id in localStorage. No fetch needed here.
  const avatarSrc = user?.avatar || undefined;
  const displayName = user?.client_name || user?.name || 'Usuário';
  const initialsName = user?.name || user?.client_name || 'Usuário';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
        {/* Menu Toggle (Mobile) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Collapse Toggle (Desktop) */}
        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCollapse}
                className="hidden lg:flex"
              >
                {isCollapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isCollapsed ? "Expandir menu" : "Recolher menu"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="pl-10 bg-muted/50"
            />
          </div>
        </div>

        <div className="flex-1 md:hidden" />

        {/* Right side */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Alerta de som de novas mensagens */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleSound}
                  disabled={!canToggleSound || toggleUserMute.isPending}
                  className="relative disabled:opacity-100"
                >
                  {soundOn ? (
                    <Volume2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="sr-only">Alerta de som</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{soundTooltip}</TooltipContent>
          </Tooltip>

          {/* Softphone / SIP discador */}
          <HeaderDialer />
          <HeaderZapCallBadge />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {getInitials(initialsName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(initialsName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/perfil" className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/perfil" className="flex items-center cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground text-center select-none">
                Versão {APP_VERSION_LABEL}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
