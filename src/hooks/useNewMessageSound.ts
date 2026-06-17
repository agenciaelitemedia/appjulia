import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundAlertSettings } from '@/hooks/useSoundAlertSettings';
import { isAudioActive } from '@/lib/chat/audioActivity';

const SOUND_URL = '/som/nova-mensagem.mp3';
const THROTTLE_MS = 2000;
const MAX_KNOWN_IDS = 500;

/**
 * Alerta sonoro global de novas mensagens do Chat.
 *
 * Montado no MainLayout — toca o som em QUALQUER página da plataforma
 * sempre que chega uma mensagem recebida (from_me=false, não nota interna)
 * do client_id efetivo do usuário.
 *
 * Totalmente independente do WhatsAppDataContext:
 * - Canal Realtime exclusivo (`chat_messages_sound_alert`)
 * - Falha silenciosa se o navegador bloquear autoplay
 * - Throttle para evitar rajadas de som
 */
export function useNewMessageSound() {
  const { user } = useAuth();
  const { clientId, settings } = useSoundAlertSettings();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const lastPlayedAtRef = useRef(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const allowedRef = useRef(true);
  const userIdRef = useRef<string>('');

  useEffect(() => {
    userIdRef.current = String(user?.id ?? '');
  }, [user?.id]);

  // Gate: só toca se o alerta do cliente estiver ativo e o usuário não estiver silenciado.
  // Mantido em ref para não reassinar o canal Realtime a cada mudança.
  useEffect(() => {
    const myId = String(user?.id ?? '');
    allowedRef.current = settings.enabled && !settings.mutedUsers[myId];
  }, [settings, user?.id]);

  // Pré-carrega o áudio e destrava na primeira interação do usuário
  useEffect(() => {
    const audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
    audio.volume = 0.8;
    audioRef.current = audio;

    const unlock = () => {
      if (unlockedRef.current || !audioRef.current) return;
      const a = audioRef.current;
      const prevMuted = a.muted;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = prevMuted;
          unlockedRef.current = true;
        })
        .catch(() => {
          a.muted = prevMuted;
        });
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audioRef.current = null;
    };
  }, []);

  // Assinatura Realtime exclusiva para o alerta sonoro
  useEffect(() => {
    if (!clientId) return;

    const playAlert = () => {
      if (!allowedRef.current) return;
      // Não alerta enquanto o usuário estiver gravando/enviando áudio
      if (isAudioActive()) return;
      const now = Date.now();
      if (now - lastPlayedAtRef.current < THROTTLE_MS) return;
      lastPlayedAtRef.current = now;

      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {
          /* autoplay bloqueado — silencioso */
        });
      } catch {
        /* nunca interrompe a aplicação */
      }
    };

    const channel = supabase
      .channel(`chat_messages_sound_alert_${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as {
            id?: string;
            from_me?: boolean;
            internal_note?: boolean;
            type?: string;
            conversation_id?: string | null;
          };

          // Apenas mensagens recebidas, não notas internas
          if (!msg || msg.from_me) return;
          if (msg.internal_note) return;
          if (msg.type === 'reaction' || msg.type === 'revoked') return;

          // Dedup por id
          if (msg.id) {
            if (knownIdsRef.current.has(msg.id)) return;
            knownIdsRef.current.add(msg.id);
            if (knownIdsRef.current.size > MAX_KNOWN_IDS) {
              knownIdsRef.current = new Set(
                Array.from(knownIdsRef.current).slice(-MAX_KNOWN_IDS / 2)
              );
            }
          }

          // Só alerta para conversas pendentes ou atribuídas ao usuário logado.
          // Mensagens sem conversation_id mantêm o comportamento atual (toca).
          if (!msg.conversation_id) {
            playAlert();
            return;
          }

          supabase
            .from('chat_conversations')
            .select('status, assigned_to')
            .eq('id', msg.conversation_id)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error || !data) return;
              const myId = userIdRef.current;
              const assignedToMe =
                !!data.assigned_to && !!myId && String(data.assigned_to) === myId;
              if (data.status === 'pending' || assignedToMe) {
                playAlert();
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);
}