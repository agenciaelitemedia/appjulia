import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Users, UserCheck, UserX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamHeartbeat } from '@/hooks/useTeamHeartbeat';

export interface TeamMemberOption {
  id: number | string;
  name: string;
  email?: string | null;
  role?: string | null;
  photo?: string | null;
}

export interface TeamSelectExtraOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  iconClassName?: string;
  badgeLabel?: string;
  badgeClassName?: string;
}

interface TeamMemberSelectProps {
  members: TeamMemberOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  /** Field used to compare/store the selection. Default 'name'. */
  valueKey?: 'id' | 'name';
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Show "Sem responsável" entry. Default true. */
  allowUnassigned?: boolean;
  unassignedLabel?: string;
  /** Extra shortcut entries (e.g. "Todos", "Julia IA"). */
  extraOptions?: TeamSelectExtraOption[];
  /** Inject "Eu" shortcut using current logged user. */
  showCurrentUserShortcut?: boolean;
  /** Hide the role badge in items. */
  hideRoleBadge?: boolean;
  /** Width / size variants */
  size?: 'sm' | 'md';
  /** Map nome → contagem, exibida como "(N)" ao lado do nome. */
  memberCounts?: Record<string, number>;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  user: 'Proprietário',
  colaborador: 'Colaborador',
  time: 'Time',
  advogado: 'Advogado',
  comercial: 'Comercial',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  user: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  admin: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  advogado: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  comercial: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  colaborador: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  time: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
};

const AVATAR_PALETTE = [
  'bg-rose-500/20 text-rose-700 dark:text-rose-300',
  'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
  'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
];

export function getMemberInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarBgFromName(name?: string | null): string {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function MemberAvatar({ name, photo, size = 'md' }: { name?: string | null; photo?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-xs';
  return (
    <Avatar className={cn(dim, 'flex-shrink-0')}>
      {photo && <AvatarImage src={photo} alt={name || ''} />}
      <AvatarFallback className={cn('font-semibold', getAvatarBgFromName(name))}>
        {getMemberInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function TeamMemberSelect({
  members,
  value,
  onValueChange,
  valueKey = 'name',
  disabled,
  placeholder = 'Selecionar responsável',
  className,
  allowUnassigned = true,
  unassignedLabel = 'Sem responsável',
  extraOptions = [],
  showCurrentUserShortcut = false,
  hideRoleBadge = false,
  size = 'md',
  memberCounts,
}: TeamMemberSelectProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { isOnline, isAway } = useTeamHeartbeat();

  const meName = user?.name || null;
  const sortedMembers = useMemo(() => {
    const statusRank = (m: TeamMemberOption): 0 | 1 | 2 => {
      const id = Number(m.id);
      if (Number.isFinite(id) && isOnline(id)) return 0;
      if (Number.isFinite(id) && isAway(id)) return 1;
      return 2;
    };
    return [...members]
      .map((m) => ({ m, rank: statusRank(m) }))
      .sort((a, b) => a.rank - b.rank || (a.m.name || '').localeCompare(b.m.name || '', 'pt-BR'))
      .map((x) => x.m);
  }, [members, isOnline, isAway]);

  // Find selected entry across all sources
  const selectedExtra = extraOptions.find((o) => o.value === value);
  const selectedMember = !selectedExtra
    ? sortedMembers.find((m) => String(valueKey === 'id' ? m.id : m.name) === value)
    : undefined;
  const isMeShortcut = showCurrentUserShortcut && value === '__me__';
  const isUnassigned = allowUnassigned && (value === null || value === '' || value === '__none__');

  const triggerH = size === 'sm' ? 'h-8' : 'h-9';
  const labelText = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(triggerH, 'justify-between font-normal gap-2 px-2.5', className)}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selectedExtra ? (
              <>
                {selectedExtra.icon ? (
                  <selectedExtra.icon className={cn('h-4 w-4 flex-shrink-0', selectedExtra.iconClassName)} />
                ) : (
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className={cn('truncate', labelText)}>{selectedExtra.label}</span>
              </>
            ) : isMeShortcut ? (
              <>
                <MemberAvatar name={meName} size="sm" />
                <span className={cn('truncate', labelText)}>{meName || 'Eu'}</span>
              </>
            ) : selectedMember ? (
              <>
                <MemberAvatar name={selectedMember.name} photo={selectedMember.photo} size="sm" />
                <span className={cn('truncate', labelText)}>{selectedMember.name}</span>
              </>
            ) : isUnassigned ? (
              <>
                <UserX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className={cn('truncate text-muted-foreground', labelText)}>{unassignedLabel}</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className={cn('truncate text-muted-foreground', labelText)}>{placeholder}</span>
              </>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-0 bg-popover border border-border shadow-lg z-[60]" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar membro…" className="h-10" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>

            {(extraOptions.length > 0 || showCurrentUserShortcut || allowUnassigned) && (
              <>
                <CommandGroup heading="Atalhos">
                  {extraOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSel = value === opt.value;
                    return (
                      <CommandItem
                        key={opt.value}
                        value={`__extra_${opt.value}_${opt.label}`}
                        onSelect={() => {
                          onValueChange(opt.value);
                          setOpen(false);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <Check className={cn('h-4 w-4', isSel ? 'opacity-100' : 'opacity-0')} />
                        {Icon ? (
                          <Icon className={cn('h-4 w-4', opt.iconClassName)} />
                        ) : (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{opt.label}</span>
                        {opt.badgeLabel && (
                          <Badge variant="secondary" className={cn('text-[10px] h-5', opt.badgeClassName)}>
                            {opt.badgeLabel}
                          </Badge>
                        )}
                      </CommandItem>
                    );
                  })}

                  {showCurrentUserShortcut && meName && (
                    <CommandItem
                      value={`__extra_me_${meName}`}
                      onSelect={() => {
                        onValueChange(meName);
                        setOpen(false);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <Check className={cn('h-4 w-4', value === meName ? 'opacity-100' : 'opacity-0')} />
                      <UserCheck className="h-4 w-4 text-primary" />
                      <span className="flex-1 truncate">Atribuir a mim</span>
                      {memberCounts && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ({memberCounts[meName.trim()] ?? 0})
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px] h-5">EU</Badge>
                    </CommandItem>
                  )}

                  {allowUnassigned && (
                    <CommandItem
                      value="__extra_none_unassigned"
                      onSelect={() => {
                        onValueChange(null);
                        setOpen(false);
                      }}
                      className="cursor-pointer gap-2 text-muted-foreground"
                    >
                      <Check className={cn('h-4 w-4', isUnassigned ? 'opacity-100' : 'opacity-0')} />
                      <UserX className="h-4 w-4" />
                      <span className="flex-1 truncate italic">{unassignedLabel}</span>
                    </CommandItem>
                  )}
                </CommandGroup>
                {sortedMembers.length > 0 && <CommandSeparator />}
              </>
            )}

            {sortedMembers.length > 0 && (
              <CommandGroup heading="Equipe">
                {sortedMembers.map((m) => {
                  const v = String(valueKey === 'id' ? m.id : m.name);
                  const isSel = value === v;
                  const role = (m.role || '').toLowerCase();
                  const roleLabel = ROLE_LABEL[role];
                  const roleClass = ROLE_BADGE_CLASS[role] || 'bg-muted text-muted-foreground';
                  const mid = Number(m.id);
                  const online = Number.isFinite(mid) && isOnline(mid);
                  const away = !online && Number.isFinite(mid) && isAway(mid);
                  const statusLabel = online ? 'Online' : away ? 'Ausente' : 'Offline';
                  const dotClass = online
                    ? 'bg-emerald-500'
                    : away
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground/40';
                  const statusBadgeClass = online
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : away
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    : 'bg-muted text-muted-foreground border-border';
                  return (
                    <CommandItem
                      key={m.id}
                      value={`${m.name} ${m.email || ''} ${roleLabel || role} ${statusLabel}`}
                      onSelect={() => {
                        onValueChange(v);
                        setOpen(false);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <Check className={cn('h-4 w-4 flex-shrink-0', isSel ? 'opacity-100' : 'opacity-0')} />
                      <div className="relative flex-shrink-0">
                        <MemberAvatar name={m.name} photo={m.photo} size="sm" />
                        <span
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-popover',
                            dotClass,
                          )}
                        />
                      </div>
                      <div className="flex flex-col gap-0 min-w-0 flex-1">
                        <span className="font-medium text-sm truncate">{m.name}</span>
                        {m.email && (
                          <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
                        )}
                      </div>
                      {memberCounts && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 px-1.5 flex-shrink-0 tabular-nums bg-white text-black border-gray-200"
                          title="Conversas atribuídas"
                        >
                          {memberCounts[(m.name || '').trim()] ?? 0}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 flex-shrink-0', statusBadgeClass)}>
                        {statusLabel}
                      </Badge>
                      {!hideRoleBadge && roleLabel && (
                        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', roleClass)}>
                          {roleLabel}
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}