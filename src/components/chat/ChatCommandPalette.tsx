import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  MessageCircle,
  CheckCircle2,
  Archive,
  UserCog,
  BarChart3,
  Zap,
  Webhook,
  Settings,
  Inbox,
  Tag,
  Timer,
  Key,
  BookOpen,
  Star,
  Bot,
  Send,
  Workflow,
  GitFork,
  Eye,
  Sparkles,
  Plug,
  FileBarChart,
  Phone,
  FlaskConical,
  Shield,
} from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { toast } from 'sonner';

interface ChatCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatCommandPalette({ open, onOpenChange }: ChatCommandPaletteProps) {
  const navigate = useNavigate();
  const {
    contacts,
    selectContact,
    selectedConversation,
    updateConversationStatus,
    setShowDetailPanel,
  } = useWhatsAppData();

  const close = () => onOpenChange(false);

  const recentContacts = useMemo(() => {
    return [...contacts]
      .sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [contacts]);

  const runResolve = async () => {
    if (!selectedConversation) {
      toast.error('Nenhuma conversa selecionada');
      return;
    }
    await updateConversationStatus(selectedConversation.id, 'resolved');
    toast.success('Conversa marcada como resolvida');
    close();
  };

  const runClose = async () => {
    if (!selectedConversation) {
      toast.error('Nenhuma conversa selecionada');
      return;
    }
    await updateConversationStatus(selectedConversation.id, 'closed');
    toast.success('Conversa fechada');
    close();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar conversas, contatos ou comandos..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Ações na conversa atual">
          <CommandItem onSelect={runResolve} disabled={!selectedConversation}>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>Marcar como resolvida</span>
          </CommandItem>
          <CommandItem onSelect={runClose} disabled={!selectedConversation}>
            <Archive className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Fechar conversa</span>
          </CommandItem>
          <CommandItem
            onSelect={() => { setShowDetailPanel(true); close(); }}
            disabled={!selectedConversation}
          >
            <UserCog className="mr-2 h-4 w-4" />
            <span>Abrir painel do contato</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => { navigate('/chat'); close(); }}>
            <Inbox className="mr-2 h-4 w-4" />
            <span>Ir para a Caixa de Entrada</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/metricas'); close(); }}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Métricas de atendimento</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/automacoes'); close(); }}>
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            <span>Automações</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/webhooks'); close(); }}>
            <Webhook className="mr-2 h-4 w-4" />
            <span>Webhooks</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/sla'); close(); }}>
            <Timer className="mr-2 h-4 w-4 text-blue-500" />
            <span>Configurações de SLA</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/csat'); close(); }}>
            <Star className="mr-2 h-4 w-4 text-amber-500" />
            <span>CSAT & NPS</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/kb'); close(); }}>
            <BookOpen className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Base de Conhecimento</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/bots'); close(); }}>
            <Bot className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Chatbots (lista)</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/builder'); close(); }}>
            <Workflow className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Construtor visual de chatbot</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/roteamento'); close(); }}>
            <GitFork className="mr-2 h-4 w-4 text-teal-500" />
            <span>Roteamento inteligente</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/visoes'); close(); }}>
            <Eye className="mr-2 h-4 w-4 text-violet-500" />
            <span>Inbox unificada (visões salvas)</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/relatorios'); close(); }}>
            <FileBarChart className="mr-2 h-4 w-4 text-blue-500" />
            <span>Relatórios & Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/ia-autoresposta'); close(); }}>
            <Sparkles className="mr-2 h-4 w-4 text-fuchsia-500" />
            <span>IA Auto-resposta</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/integracoes'); close(); }}>
            <Plug className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Integrações</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/telefonia'); close(); }}>
            <Phone className="mr-2 h-4 w-4 text-orange-500" />
            <span>Telefonia no chat</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/marketing'); close(); }}>
            <FlaskConical className="mr-2 h-4 w-4 text-pink-500" />
            <span>Marketing avançado (A/B)</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/compliance'); close(); }}>
            <Shield className="mr-2 h-4 w-4 text-red-500" />
            <span>Segurança & Compliance</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/campanhas'); close(); }}>
            <Send className="mr-2 h-4 w-4 text-pink-500" />
            <span>Campanhas em massa</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/api-keys'); close(); }}>
            <Key className="mr-2 h-4 w-4 text-purple-500" />
            <span>API Keys</span>
          </CommandItem>
          <CommandItem onSelect={() => { navigate('/chat/canais'); close(); }}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Canais</span>
          </CommandItem>
        </CommandGroup>

        {recentContacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversas recentes">
              {recentContacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.phone}`}
                  onSelect={() => { selectContact(c.id); close(); }}
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                    {c.phone}
                  </span>
                  {(c.unread_count ?? 0) > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px]">
                      {c.unread_count}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
