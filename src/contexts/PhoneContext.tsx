import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSipPhone, type SipStatus, type CallEndedInfo } from '@/pages/telefonia/hooks/useSipPhone';
import { syncQueueManager } from '@/lib/syncQueueManager';
import { formatPhoneForDialing } from '@/lib/phoneFormat';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PhoneExtensionInfo {
  id: number;
  extension_number: string;
  label: string | null;
  api4com_ramal: string | null;
  api4com_id: string | null;
  cod_agent: string;
  assigned_member_id: number | null;
}

interface PhoneContextType {
  sip: ReturnType<typeof useSipPhone>;
  myExtension: PhoneExtensionInfo | null;
  codAgent: string | null;
  isAvailable: boolean;
  showSoftphone: boolean;
  setShowSoftphone: (show: boolean) => void;
  softphoneCentered: boolean;
  setSoftphoneCentered: (centered: boolean) => void;
  dialNumber: (phone: string, contactName?: string, origin?: 'CRM' | 'DISCADOR', whatsappNumber?: string) => Promise<void>;
  isDialing: boolean;
  dialContactName: string;
}

const PhoneContext = createContext<PhoneContextType | undefined>(undefined);

export function PhoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [myExtension, setMyExtension] = useState<PhoneExtensionInfo | null>(null);
  const [codAgent, setCodAgent] = useState<string | null>(null);
  const [showSoftphone, setShowSoftphone] = useState(false);
  const [softphoneCentered, setSoftphoneCentered] = useState(false);
  const [isDialing, setIsDialing] = useState(false);
  const [dialContactName, setDialContactName] = useState('');
  const autoConnected = useRef(false);

  // Listen for sync-queue-done events to invalidate queries
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
    };
    window.addEventListener('sync-queue-done', handler);
    return () => window.removeEventListener('sync-queue-done', handler);
  }, [queryClient]);

  const handleCallEnded = useCallback((_info: CallEndedInfo) => {
    // SIP calls don't have call_id — sync by since
    if (!codAgent) return;
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    supabase.functions.invoke('api4com-proxy', {
      body: { action: 'sync_call_history', codAgent, since },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
    }).catch(console.error);
  }, [codAgent, queryClient]);

  const sip = useSipPhone(handleCallEnded);

  // Fetch user's extension
  useEffect(() => {
    if (!user?.id) return;
    const fetchExtension = async () => {
      const { data } = await supabase
        .from('phone_extensions')
        .select('*')
        .eq('assigned_member_id', Number(user.id))
        .eq('is_active', true)
        .limit(1);
      if (data && data.length > 0) {
        const ext = data[0] as unknown as PhoneExtensionInfo;
        setMyExtension(ext);
        setCodAgent(ext.cod_agent);
        syncQueueManager.init(ext.cod_agent);
      }
    };
    fetchExtension();
  }, [user?.id]);

  // Auto-connect SIP when extension is found
  useEffect(() => {
    if (autoConnected.current || !myExtension || !codAgent) return;
    if (!myExtension.api4com_ramal) return;

    autoConnected.current = true;
    const connectSip = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('api4com-proxy', {
          body: { action: 'get_sip_credentials', codAgent, extensionId: myExtension.id },
        });
        if (error || data?.error) return;
        sip.connect(data.data);
      } catch (err) {
        console.error('Auto SIP connect failed:', err);
      }
    };
    connectSip();
  }, [myExtension, codAgent, sip]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      syncQueueManager.destroy();
    };
  }, []);

  const dialNumber = useCallback(async (phone: string, contactName?: string, origin?: 'CRM' | 'DISCADOR', whatsappNumber?: string) => {
    if (!myExtension || !codAgent) {
      toast.error('Nenhum ramal disponível');
      return;
    }
    if (!myExtension.api4com_ramal) {
      toast.error('Ramal sem vínculo Api4Com');
      return;
    }

    const { formatted } = formatPhoneForDialing(phone);
    setDialContactName(contactName || formatted);
    setIsDialing(true);

    const metadata: Record<string, unknown> = {};
    if (origin) metadata.origin = origin;
    if (whatsappNumber) metadata.whatsapp_number = whatsappNumber;

    try {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'dial', codAgent, extensionId: myExtension.id, phone: formatted, metadata },
      });
      if (error) throw new Error(error.message || 'Erro ao discar');
      if (data?.error) throw new Error(data.error);

      const callId = data?.data?.call_id || data?.data?.id;
      if (callId) syncQueueManager.enqueue(String(callId));

      toast.success(`Ligando para ${contactName || formatted}...`);
      setShowSoftphone(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao discar');
    } finally {
      setIsDialing(false);
    }
  }, [myExtension, codAgent]);

  const isAvailable = !!myExtension && !!myExtension.api4com_ramal;

  const value = useMemo(() => ({
    sip,
    myExtension,
    codAgent,
    isAvailable,
    showSoftphone,
    setShowSoftphone,
    softphoneCentered,
    setSoftphoneCentered,
    dialNumber,
    isDialing,
    dialContactName,
  }), [sip, myExtension, codAgent, isAvailable, showSoftphone, softphoneCentered, dialNumber, isDialing, dialContactName]);

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
