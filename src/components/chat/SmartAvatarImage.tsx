import { useEffect, useRef, useState } from 'react';
import { AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

// Module-level guards to avoid hammering the edge function for the
// same contact across multiple mounts (lists + header + detail panel).
const inFlight = new Set<string>();
const recentlyTried = new Map<string, number>(); // contactId -> ts
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 min

interface SmartAvatarImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /** chat_contacts.id — when provided, enables on-demand refresh on 403/404. */
  contactId?: string | null;
}

/**
 * AvatarImage that:
 *  - Silences expired pps.whatsapp.net URLs (403/404) by clearing the src on first error
 *    so Radix shows the AvatarFallback and stops re-requesting.
 *  - When contactId is provided, fires a one-shot background refresh via the
 *    `refresh-contact-avatar` edge function so the next render shows a fresh URL.
 */
export function SmartAvatarImage({ src, alt, className, contactId }: SmartAvatarImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src || undefined);
  const triedRefresh = useRef(false);

  useEffect(() => {
    setCurrentSrc(src || undefined);
    triedRefresh.current = false;
  }, [src]);

  if (!currentSrc) return null;

  return (
    <AvatarImage
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => {
        // Hide broken image immediately (Radix will show fallback).
        setCurrentSrc(undefined);

        if (!contactId || triedRefresh.current) return;
        triedRefresh.current = true;

        const last = recentlyTried.get(contactId) || 0;
        if (Date.now() - last < REFRESH_COOLDOWN_MS) return;
        if (inFlight.has(contactId)) return;

        inFlight.add(contactId);
        recentlyTried.set(contactId, Date.now());
        supabase.functions
          .invoke('refresh-contact-avatar', { body: { contact_id: contactId } })
          .catch(() => {})
          .finally(() => inFlight.delete(contactId));
      }}
    />
  );
}