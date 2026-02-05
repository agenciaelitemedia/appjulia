import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetaAdsAuth } from './components/MetaAdsAuth';
import { AdAccountSelector } from './components/AdAccountSelector';
import { CampaignsList } from './components/CampaignsList';
import { ConversionsTest } from './components/ConversionsTest';
import { useMetaAds } from './hooks/useMetaAds';

const META_APP_ID = '1182041896682498';

export default function MetaAdsTestPage() {
  const {
    accessToken,
    adAccounts,
    selectedAccountId,
    campaigns,
    pixels,
    selectedPixelId,
    isLoading,
    setAccessToken,
    setSelectedPixelId,
    fetchAdAccounts,
    selectAccount,
    fetchCampaignInsights,
    sendConversionEvent,
  } = useMetaAds();

  // Load Facebook SDK
  useEffect(() => {
    if (window.FB) return;

    window.fbAsyncInit = function() {
      window.FB.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
    };

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fetch ad accounts when token is received
  useEffect(() => {
    if (accessToken && adAccounts.length === 0) {
      fetchAdAccounts();
    }
  }, [accessToken, adAccounts.length, fetchAdAccounts]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Integração Meta Marketing API</h1>
        <p className="text-muted-foreground">
          Conecte-se ao Facebook Ads para visualizar campanhas, métricas e enviar conversões para o Pixel
        </p>
      </div>

      <Tabs defaultValue="auth" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auth">Autenticação</TabsTrigger>
          <TabsTrigger value="campaigns" disabled={!accessToken}>Campanhas</TabsTrigger>
          <TabsTrigger value="conversions" disabled={!accessToken}>Conversions API</TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="space-y-6">
          <MetaAdsAuth
            onTokenReceived={setAccessToken}
            accessToken={accessToken}
          />

          {accessToken && (
            <AdAccountSelector
              accounts={adAccounts}
              selectedAccountId={selectedAccountId}
              onSelect={selectAccount}
              onRefresh={fetchAdAccounts}
              isLoading={isLoading}
              disabled={!accessToken}
            />
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <AdAccountSelector
            accounts={adAccounts}
            selectedAccountId={selectedAccountId}
            onSelect={selectAccount}
            onRefresh={fetchAdAccounts}
            isLoading={isLoading}
            disabled={!accessToken}
          />

          {selectedAccountId && (
            <CampaignsList
              campaigns={campaigns}
              isLoading={isLoading}
              onViewInsights={fetchCampaignInsights}
            />
          )}
        </TabsContent>

        <TabsContent value="conversions" className="space-y-6">
          <AdAccountSelector
            accounts={adAccounts}
            selectedAccountId={selectedAccountId}
            onSelect={selectAccount}
            onRefresh={fetchAdAccounts}
            isLoading={isLoading}
            disabled={!accessToken}
          />

          <ConversionsTest
            pixels={pixels}
            selectedPixelId={selectedPixelId}
            onSelectPixel={setSelectedPixelId}
            onSendEvent={sendConversionEvent}
            disabled={!selectedAccountId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
