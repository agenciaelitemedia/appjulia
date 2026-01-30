import { useState, useCallback } from 'react';
import { useDaily, useDailyEvent } from '@daily-co/daily-react';

export type NetworkQuality = 'good' | 'low' | 'very-low' | 'unknown';

interface VideoSettings {
  noiseCancellation: boolean;
  networkQuality: NetworkQuality;
}

export function useVideoSettings() {
  const daily = useDaily();
  const [settings, setSettings] = useState<VideoSettings>({
    noiseCancellation: false,
    networkQuality: 'unknown',
  });

  // Listen for network quality changes
  useDailyEvent('network-quality-change', useCallback((event: any) => {
    console.log('[useVideoSettings] network-quality-change:', event);
    setSettings(prev => ({
      ...prev,
      networkQuality: event?.threshold || 'unknown',
    }));
  }, []));

  // Toggle noise cancellation
  const toggleNoiseCancellation = useCallback(async () => {
    if (!daily) return;

    const newValue = !settings.noiseCancellation;
    
    try {
      if (newValue) {
        await daily.updateInputSettings({
          audio: {
            processor: {
              type: 'noise-cancellation',
            },
          },
        });
      } else {
        await daily.updateInputSettings({
          audio: {
            processor: {
              type: 'none',
            },
          },
        });
      }
      
      setSettings(prev => ({
        ...prev,
        noiseCancellation: newValue,
      }));
      
      console.log('[useVideoSettings] Noise cancellation:', newValue ? 'ON' : 'OFF');
    } catch (err) {
      console.error('[useVideoSettings] Error toggling noise cancellation:', err);
    }
  }, [daily, settings.noiseCancellation]);

  return {
    noiseCancellation: settings.noiseCancellation,
    networkQuality: settings.networkQuality,
    toggleNoiseCancellation,
  };
}
