import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Eye, Plus, X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';
import { toast } from 'sonner';

interface Participant {
  id: string;
  user_identifier: string;
  user_name: string | null;
  role: string;
}

interface TeamMember {
  id: number;
  name: string;
  email?: string;
}

interface ConversationParticipantsProps {
  conversationId: string;
}

export function ConversationParticipants({ conversationId }: ConversationParticipantsProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('chat_conversation_participants')
      .select('*')
      .eq('conversation_id', conversationId);
    setParticipants((data || []) as Participant[]);
  };

  useEffect(() => { load(); }, [conversationId]);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const members = await externalDb.getTeamMembers<TeamMember>(Number(user.id), user.role === 'admin');
        setTeam(members || []);
      } catch (e) {
        console.warn('[Participants] failed to load team', e);
      }
    })();
  }, [user?.id, user?.role]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`participants_${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_conversation_participants',
        filter: `conversation_id=eq.${conversationId}`,
      }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  const addParticipant = async (member: TeamMember) => {
    const exists = participants.some((p) => p.user_identifier === String(member.id));
    if (exists) {
      toast.info('Esse usuário já é observador');
      return;
    }
    const { error } = await supabase.from('chat_conversation_participants').insert({
      conversation_id: conversationId,
      user_identifier: String(member.id),
      user_name: member.name,
      role: 'observer',
      added_by: user?.name || null,
    });
    if (error) {
      toast.error('Erro ao adicionar observador');
      return;
    }
    toast.success(`${member.name} adicionado como observador`);
    setOpen(false);
  };

  const removeParticipant = async (id: string) => {
    await supabase.from('chat_conversation_participants').delete().eq('id', id);
    toast.success('Observador removido');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Eye className="h-3 w-3" /> Observadores
        </h5>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Buscar membro..." className="h-9" />
              <CommandList>
                <CommandEmpty>Ninguém encontrado</CommandEmpty>
                <CommandGroup>
                  {team.map((m) => (
                    <CommandItem
                      key={m.id}
                      onSelect={() => addParticipant(m)}
                      className="cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-2" />
                      {m.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {participants.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem observadores</p>
      ) : (
        <div className="space-y-1.5">
          {participants.map((p) => {
            const initials = (p.user_name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
            return (
              <div key={p.id} className="flex items-center gap-2 group">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs flex-1 truncate">{p.user_name || p.user_identifier}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={() => removeParticipant(p.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
