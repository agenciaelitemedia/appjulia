import { useState, useCallback } from 'react';
import { useDaily, useDailyEvent } from '@daily-co/daily-react';

export type NetworkQuality = 'good' | 'low' | 'very-low' | 'unknown';

interface VideoSettings {
  noiseCancellation: boolean;
  networkQuality: NetworkQuality;
  backgroundBlur: boolean;
  backgroundBlurStrength: number;
}

export function useVideoSettings() {
  const daily = useDaily();
  const [settings, setSettings] = useState<VideoSettings>({
    noiseCancellation: false,
    networkQuality: 'unknown',
    backgroundBlur: false,
    backgroundBlurStrength: 0.5,
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

  // Toggle background blur
  const toggleBackgroundBlur = useCallback(async () => {
    if (!daily) return;

    const newValue = !settings.backgroundBlur;
    
    try {
      if (newValue) {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'background-blur',
              config: { strength: settings.backgroundBlurStrength },
            },
          },
        });
      } else {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'none',
            },
          },
        });
      }
      
      setSettings(prev => ({
        ...prev,
        backgroundBlur: newValue,
      }));
      
      console.log('[useVideoSettings] Background blur:', newValue ? 'ON' : 'OFF');
    } catch (err) {
      console.error('[useVideoSettings] Error toggling background blur:', err);
    }
  }, [daily, settings.backgroundBlur, settings.backgroundBlurStrength]);

  // Set background blur strength
  const setBackgroundBlurStrength = useCallback(async (strength: number) => {
    if (!daily) return;

    setSettings(prev => ({
      ...prev,
      backgroundBlurStrength: strength,
    }));
    
    // Only update if blur is currently active
    if (settings.backgroundBlur) {
      try {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'background-blur',
              config: { strength },
            },
          },
        });
        console.log('[useVideoSettings] Background blur strength:', strength);
      } catch (err) {
        console.error('[useVideoSettings] Error setting blur strength:', err);
      }
    }
  }, [daily, settings.backgroundBlur]);

  return {
    noiseCancellation: settings.noiseCancellation,
    networkQuality: settings.networkQuality,
    backgroundBlur: settings.backgroundBlur,
    backgroundBlurStrength: settings.backgroundBlurStrength,
    toggleNoiseCancellation,
    toggleBackgroundBlur,
    setBackgroundBlurStrength,
  };
}
