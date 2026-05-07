import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSipPhone, type SipStatus, type CallEndedInfo } from '@/pages/telefonia/hooks/useSipPhone';
import { syncQueueManager } from '@/lib/syncQueueManager';
import { getPhoneProxy } from '@/lib/phoneProxy';
import { formatPhoneForDialing } from '@/lib/phoneFormat';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { ProviderType } from '@/pages/admin/telefonia/types';

interface PhoneExtensionInfo {
  id: number;
  extension_number: string;
  label: string | null;
  provider: ProviderType;
  // api4com
  api4com_ramal: string | null;
  api4com_id: string | null;
  // 3cplus
  threecplus_agent_id: string | null;
  threecplus_extension: string | null;
  cod_agent: string | null;
  client_id: number | null;
  assigned_member_id: number | null;
}

interface PhoneContextType {
  sip: ReturnType<typeof useSipPhone>;
  myExtension: PhoneExtensionInfo | null;
  codAgent: string | null;
  clientId: number | null;
  provider: ProviderType;
  isAvailable: boolean;
  showSoftphone: boolean;
  setShowSoftphone: (show: boolean) => void;
  softphoneCentered: boolean;
  setSoftphoneCentered: (centered: boolean) => void;
  dialNumber: (phone: string, contactName?: string, origin?: 'CRM' | 'DISCADOR', whatsappNumber?: string) => Promise<void>;
  isDialing: boolean;
  dialContactName: string;
  dialError: string | null;
  clearDialError: () => void;
  retryDial: () => void;
  cancelDial: () => void;
}

const PhoneContext = createContext<PhoneContextType | undefined>(undefined);

function isNonRetryableSipSetupError(message: string): boolean {
  return /Não foi possível obter credenciais SIP válidas da 3C\+|licença\/permissão de Webphone ativa|3C\+ erro 403|Você não tem permissão para acessar esse recurso/i.test(message);
}

export function PhoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [myExtension, setMyExtension] = useState<PhoneExtensionInfo | null>(null);
  const [codAgent, setCodAgent] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ProviderType>('api4com');
  const [showSoftphone, setShowSoftphone] = useState(false);
  const [softphoneCentered, setSoftphoneCentered] = useState(false);
  const [isDialing, setIsDialing] = useState(false);
  const isDialingRef = useRef(false);
  const [dialContactName, setDialContactName] = useState('');
  const [dialError, setDialError] = useState<string | null>(null);
  const [sipSetupError, setSipSetupError] = useState<string | null>(null);
  const lastDialArgs = useRef<{ phone: string; contactName?: string; origin?: 'CRM' | 'DISCADOR'; whatsappNumber?: string } | null>(null);
  const dialStartedAtRef = useRef<number | null>(null);
  const autoConnected = useRef(false);
  const sipBlockedRef = useRef(false);
  const sipConnectInFlightRef = useRef(false);
  const retryCount = useRef(0);
  const maxRetries = 8; // max ~5min backoff (5*2^7 = 640s capped at 300s)
  const hasTelephonyScope = !!codAgent || !!clientId;
  // Listen for sync-queue-done events to invalidate queries
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
    };
    window.addEventListener('sync-queue-done', handler);
    return () => window.removeEventListener('sync-queue-done', handler);
  }, [queryClient]);

  const handleCallEnded = useCallback((_info: CallEndedInfo) => {
    if (!hasTelephonyScope) return;
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    supabase.functions.invoke(getPhoneProxy(provider), {
      body: { action: 'sync_call_history', clientId, codAgent, since },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
    }).catch(console.error);
  }, [hasTelephonyScope, clientId, codAgent, provider, queryClient]);

  const handleCallFailed = useCallback((cause: string) => {
    const friendlyMsg = cause === 'Canceled'
      ? 'Chamada cancelada ou não atendida'
      : `Falha na chamada: ${cause}`;
    setDialError(friendlyMsg);
    setIsDialing(false);
    isDialingRef.current = false;
  }, []);

  const sip = useSipPhone(handleCallEnded, handleCallFailed, isDialingRef, dialStartedAtRef);

  // Fetch user's extension (only if agent has active plan)
  useEffect(() => {
    if (!user?.id) return;
    const fetchExtension = async () => {
      const { data, error: extError } = await supabase
        .from('phone_extensions')
        .select('*')
        .eq('assigned_member_id', Number(user.id))
        .eq('is_active', true)
        .limit(1);
      if (data && data.length > 0) {
        const ext = data[0] as unknown as PhoneExtensionInfo;
        // Check if the client's telephony plan is active (prefer client_id, fallback cod_agent)
        const planQuery = supabase
          .from('phone_user_plans')
          .select('is_active')
          .eq('is_active', true)
          .limit(1);
        const { data: planData } = ext.client_id
          ? await planQuery.eq('client_id', ext.client_id)
          : await planQuery.eq('cod_agent', ext.cod_agent);
        if (!planData || planData.length === 0) {
          // Agent plan is deactivated — don't enable telephony
          setMyExtension(null);
          setCodAgent(null);
          setClientId(null);
          return;
        }

        // Fetch provider from phone_config (prefer client_id)
        const cfgBase = supabase.from('phone_config').select('*').eq('is_active', true);
        const { data: configData } = ext.client_id
          ? await cfgBase.eq('client_id', ext.client_id).limit(1).maybeSingle()
          : await cfgBase.eq('cod_agent', ext.cod_agent).limit(1).maybeSingle();
        const resolvedProvider: ProviderType = ((configData as any)?.provider as ProviderType) || 'api4com';

        setMyExtension(ext);
        setCodAgent(ext.cod_agent);
        setClientId(ext.client_id ?? null);
        setProvider(resolvedProvider);
        setSipSetupError(null);
        sipBlockedRef.current = false;
        sipConnectInFlightRef.current = false;
        autoConnected.current = false;
        retryCount.current = 0;
        syncQueueManager.init(ext.cod_agent, resolvedProvider);
        syncQueueManager.setClientId(ext.client_id ?? null);
      }
    };
    fetchExtension();
  }, [user?.id]);

  // Auto-connect SIP when extension is found (with retry)
  const connectSip = useCallback(async () => {
    if (!myExtension || !hasTelephonyScope) return;
    if (sipBlockedRef.current || sipConnectInFlightRef.current) return;
    if (sipSetupError) {
      setDialError(sipSetupError);
      return;
    }

    // Provider-aware link check
    const isLinked = provider === '3cplus'
      ? !!(myExtension.threecplus_agent_id || myExtension.threecplus_extension)
      : !!myExtension.api4com_ramal;
    if (!isLinked) return;

    try {
      sipConnectInFlightRef.current = true;
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: { action: 'get_sip_credentials', clientId, codAgent, extensionId: myExtension.id },
      });
      if (error) throw new Error(error.message || 'Erro ao obter credenciais SIP');
      if (data?.error) throw new Error(data.error);
      if (data?.data?.blocked && data?.data?.nonRetryable) {
        throw new Error(data.data.error || 'Webphone 3C+ indisponível para este agente');
      }

      setSipSetupError(null);
      sip.connect(data.data);
    } catch (err) {
      console.error('SIP connect failed:', err);

      const message = err instanceof Error ? err.message : 'Erro ao conectar softphone';
      if (isNonRetryableSipSetupError(message)) {
        sipBlockedRef.current = true;
        setSipSetupError(message);
        setDialError(message);
        retryCount.current = maxRetries;
        toast.error(
          'Webphone 3C+ sem licença automática. Preencha "Credenciais SIP manuais" no ramal (em Telefonia → Meus Ramais) ou habilite a licença Webphone no painel 3C+.',
          { duration: 10000 },
        );
        return;
      }

      setDialError(message);
    } finally {
      sipConnectInFlightRef.current = false;
    }
  }, [myExtension, hasTelephonyScope, codAgent, clientId, provider, sip, sipSetupError]);

  useEffect(() => {
    if (autoConnected.current || sipBlockedRef.current || sipSetupError || !myExtension || !hasTelephonyScope) return;
    const isLinked = provider === '3cplus'
      ? !!(myExtension.threecplus_agent_id || myExtension.threecplus_extension)
      : !!myExtension.api4com_ramal;
    if (!isLinked) return;
    autoConnected.current = true;
    connectSip();
  }, [myExtension, hasTelephonyScope, provider, connectSip]);

  // Auto-retry SIP registration with exponential backoff
  useEffect(() => {
    if (!autoConnected.current || !myExtension) return;
    if (sipBlockedRef.current || sipSetupError) return;
    if (sip.status === 'registered' || sip.status === 'in-call' || sip.status === 'calling' || sip.status === 'ringing') {
      retryCount.current = 0;
      return;
    }
    if (sip.status === 'error' || (sip.status === 'idle' && autoConnected.current)) {
      if (retryCount.current >= maxRetries) {
        return;
      }
      const delay = Math.min(5000 * Math.pow(2, retryCount.current), 300_000);
      const retryTimer = setTimeout(() => {
        retryCount.current += 1;
        connectSip();
      }, delay);
      return () => clearTimeout(retryTimer);
    }
  }, [sip.status, myExtension, provider, connectSip, sipSetupError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      syncQueueManager.destroy();
    };
  }, []);

  const dialNumber = useCallback(async (phone: string, contactName?: string, origin?: 'CRM' | 'DISCADOR', whatsappNumber?: string) => {
    if (!myExtension || !hasTelephonyScope) {
      toast.error('Nenhum ramal disponível');
      return;
    }

    const isLinked = provider === '3cplus'
      ? !!(myExtension.threecplus_agent_id || myExtension.threecplus_extension)
      : !!myExtension.api4com_ramal;
    if (!isLinked) {
      toast.error(`Ramal sem vínculo ${provider === '3cplus' ? '3C+' : 'Api4Com'}`);
      return;
    }

    // Save args for retry
    lastDialArgs.current = { phone, contactName, origin, whatsappNumber };
    dialStartedAtRef.current = Date.now();

    const { formatted } = formatPhoneForDialing(phone);
    setDialContactName(contactName || formatted);
    setDialError(null);
    setIsDialing(true);
    isDialingRef.current = true;
    setShowSoftphone(true);
    setSoftphoneCentered(true);

    // Check SIP registration before dialing
    if (sip.status !== 'registered' && sip.status !== 'in-call' && sip.status !== 'calling' && sip.status !== 'ringing') {
      await connectSip();
      await new Promise(r => setTimeout(r, 3000));
    }

    const metadata: Record<string, unknown> = {};
    if (origin) metadata.origin = origin;
    if (whatsappNumber) metadata.whatsapp_number = whatsappNumber;

    try {
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: { action: 'dial', clientId, codAgent, extensionId: myExtension.id, phone: formatted, metadata },
      });
      if (error) throw new Error(error.message || 'Erro ao discar');
      if (data?.error) throw new Error(data.error);

      const callId = data?.data?.call_id || data?.data?.id;
      if (callId) syncQueueManager.enqueue(String(callId));

      toast.info(`Discando para ${contactName || formatted}...`);
    } catch (err: any) {
      const msg = err.message || 'Erro ao discar';
      setDialError(msg.includes('not registered') ? 'Ramal SIP não registrado. Verifique se o softphone está conectado.' : msg);
    } finally {
      setIsDialing(false);
      isDialingRef.current = false;
    }
  }, [myExtension, hasTelephonyScope, codAgent, clientId, provider, sip.status, connectSip]);

  const isAvailable = !!myExtension && (
    provider === '3cplus'
      ? !!(myExtension.threecplus_agent_id || myExtension.threecplus_extension)
      : !!myExtension.api4com_ramal
  );

  const clearDialError = useCallback(() => {
    setDialError(null);
    setShowSoftphone(false);
    setSoftphoneCentered(false);
  }, []);

  const cancelDial = useCallback(() => {
    sip.hangup();
    setIsDialing(false);
    isDialingRef.current = false;
    dialStartedAtRef.current = null;
    setDialError(null);
    setShowSoftphone(false);
    setSoftphoneCentered(false);
  }, [sip]);

  const retryDial = useCallback(() => {
    if (lastDialArgs.current) {
      const { phone, contactName, origin, whatsappNumber } = lastDialArgs.current;
      dialNumber(phone, contactName, origin, whatsappNumber);
    }
  }, [dialNumber]);

  const value = useMemo(() => ({
    sip,
    myExtension,
    codAgent,
    clientId,
    provider,
    isAvailable,
    showSoftphone,
    setShowSoftphone,
    softphoneCentered,
    setSoftphoneCentered,
    dialNumber,
    isDialing,
    dialContactName,
    dialError,
    clearDialError,
    retryDial,
    cancelDial,
  }), [sip, myExtension, codAgent, clientId, provider, isAvailable, showSoftphone, softphoneCentered, dialNumber, isDialing, dialContactName, dialError, clearDialError, retryDial, cancelDial]);

  return (
    <PhoneContext.Provider value={value}>
      {children}
    </PhoneContext.Provider>
  );
}

export function usePhone() {
  const context = useContext(PhoneContext);
  if (!context) throw new Error('usePhone must be used within PhoneProvider');
  return context;
}
