import { useState, useCallback } from 'react';
import { useDaily, useDailyEvent } from '@daily-co/daily-react';

export type NetworkQuality = 'good' | 'low' | 'very-low' | 'unknown';
export type BackgroundType = 'none' | 'blur' | 'image';

// Default virtual background images
export const DEFAULT_BACKGROUNDS = [
  {
    id: 'office',
    name: 'Escritório',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
  },
  {
    id: 'nature',
    name: 'Natureza',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    url: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1920&q=80',
  },
  {
    id: 'city',
    name: 'Cidade',
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80',
  },
];

interface VideoSettings {
  noiseCancellation: boolean;
  networkQuality: NetworkQuality;
  backgroundType: BackgroundType;
  backgroundBlurStrength: number;
  backgroundImageUrl: string | null;
}

export function useVideoSettings() {
  const daily = useDaily();
  const [settings, setSettings] = useState<VideoSettings>({
    noiseCancellation: false,
    networkQuality: 'unknown',
    backgroundType: 'none',
    backgroundBlurStrength: 0.5,
    backgroundImageUrl: null,
  });

  // Listen for network quality changes
  useDailyEvent('network-quality-change', useCallback((event: any) => {
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
      
    } catch (err) {
      console.error('[useVideoSettings] Error toggling noise cancellation:', err);
    }
  }, [daily, settings.noiseCancellation]);

  // Set background type (none, blur, or image)
  const setBackgroundType = useCallback(async (type: BackgroundType, imageUrl?: string) => {
    if (!daily) return;

    try {
      if (type === 'none') {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'none',
            },
          },
        });
        setSettings(prev => ({
          ...prev,
          backgroundType: 'none',
          backgroundImageUrl: null,
        }));
      } else if (type === 'blur') {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'background-blur',
              config: { strength: settings.backgroundBlurStrength },
            },
          },
        });
        setSettings(prev => ({
          ...prev,
          backgroundType: 'blur',
          backgroundImageUrl: null,
        }));
      } else if (type === 'image' && imageUrl) {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'background-image',
              config: { source: imageUrl },
            },
          },
        });
        setSettings(prev => ({
          ...prev,
          backgroundType: 'image',
          backgroundImageUrl: imageUrl,
        }));
      }
      
    } catch (err) {
      console.error('[useVideoSettings] Error setting background:', err);
    }
  }, [daily, settings.backgroundBlurStrength]);

  // Toggle background blur (for backwards compatibility)
  const toggleBackgroundBlur = useCallback(async () => {
    if (settings.backgroundType === 'blur') {
      await setBackgroundType('none');
    } else {
      await setBackgroundType('blur');
    }
  }, [settings.backgroundType, setBackgroundType]);

  // Set background blur strength
  const setBackgroundBlurStrength = useCallback(async (strength: number) => {
    if (!daily) return;

    setSettings(prev => ({
      ...prev,
      backgroundBlurStrength: strength,
    }));
    
    // Only update if blur is currently active
    if (settings.backgroundType === 'blur') {
      try {
        await daily.updateInputSettings({
          video: {
            processor: {
              type: 'background-blur',
              config: { strength },
            },
          },
        });
      } catch (err) {
        console.error('[useVideoSettings] Error setting blur strength:', err);
      }
    }
  }, [daily, settings.backgroundType]);

  // Set virtual background image
  const setBackgroundImage = useCallback(async (imageUrl: string) => {
    await setBackgroundType('image', imageUrl);
  }, [setBackgroundType]);

  // Remove background (set to none)
  const removeBackground = useCallback(async () => {
    await setBackgroundType('none');
  }, [setBackgroundType]);

  return {
    noiseCancellation: settings.noiseCancellation,
    networkQuality: settings.networkQuality,
    backgroundType: settings.backgroundType,
    backgroundBlur: settings.backgroundType === 'blur',
    backgroundBlurStrength: settings.backgroundBlurStrength,
    backgroundImageUrl: settings.backgroundImageUrl,
    toggleNoiseCancellation,
    toggleBackgroundBlur,
    setBackgroundBlurStrength,
    setBackgroundType,
    setBackgroundImage,
    removeBackground,
  };
}
