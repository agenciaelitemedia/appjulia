import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AdAccount, Campaign, Pixel, CampaignInsights } from '../types';
import { toast } from 'sonner';

export function useMetaAds() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callMetaAds = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const { data, error } = await supabase.functions.invoke('meta-ads', {
      body: {
        action,
        accessToken,
        ...params,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  }, [accessToken]);

  const fetchAdAccounts = useCallback(async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await callMetaAds('get_ad_accounts');
      setAdAccounts(result.data || []);
      toast.success(`${result.data?.length || 0} contas de anúncios encontradas`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar contas';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, callMetaAds]);

  const fetchCampaigns = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await callMetaAds('get_campaigns', { adAccountId: accountId });
      setCampaigns(result.data || []);
      toast.success(`${result.data?.length || 0} campanhas encontradas`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar campanhas';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [callMetaAds]);

  const fetchPixels = useCallback(async (accountId: string) => {
    try {
      const result = await callMetaAds('get_pixels', { adAccountId: accountId });
      setPixels(result.data || []);
    } catch (err) {
      console.error('Error fetching pixels:', err);
    }
  }, [callMetaAds]);

  const fetchCampaignInsights = useCallback(async (campaignId: string, datePreset = 'last_30d'): Promise<CampaignInsights | null> => {
    try {
      const result = await callMetaAds('get_campaign_insights', { campaignId, datePreset });
      return result.data?.[0] || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar insights';
      toast.error(message);
      return null;
    }
  }, [callMetaAds]);

  const selectAccount = useCallback(async (accountId: string) => {
    setSelectedAccountId(accountId);
    await Promise.all([
      fetchCampaigns(accountId),
      fetchPixels(accountId),
    ]);
  }, [fetchCampaigns, fetchPixels]);

  const sendConversionEvent = useCallback(async (
    pixelId: string,
    events: Array<{
      eventName: string;
      actionSource: string;
      userData: Record<string, unknown>;
      customData?: Record<string, unknown>;
    }>,
    testEventCode?: string
  ) => {
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const { data, error } = await supabase.functions.invoke('meta-conversions', {
      body: {
        action: 'send_events',
        accessToken,
        pixelId,
        events,
        testEventCode,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  }, [accessToken]);

  return {
    // State
    accessToken,
    adAccounts,
    selectedAccountId,
    campaigns,
    pixels,
    selectedPixelId,
    isLoading,
    error,
    
    // Setters
    setAccessToken,
    setSelectedPixelId,
    
    // Actions
    fetchAdAccounts,
    fetchCampaigns,
    fetchPixels,
    fetchCampaignInsights,
    selectAccount,
    sendConversionEvent,
  };
}
