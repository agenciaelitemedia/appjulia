import { supabase } from '@/integrations/supabase/client';
import { getPhoneProxy } from '@/lib/phoneProxy';
import type { ProviderType } from '@/pages/admin/telefonia/types';

interface QueueItem {
  callId: string;
  scheduledAt: number;
  retries: number;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY = 15000;
const RETRY_DELAY = 10000;
const POLL_INTERVAL = 5000;

class SyncQueueManager {
  private queue: QueueItem[] = [];
  private processing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private codAgent: string | null = null;
  private provider: ProviderType = 'api4com';

  init(codAgent: string, provider: ProviderType = 'api4com') {
    if (this.codAgent === codAgent && this.provider === provider && this.intervalId) return;
    this.destroy();
    this.codAgent = codAgent;
    this.provider = provider;
    this.intervalId = setInterval(() => this.processNext(), POLL_INTERVAL);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.queue = [];
    this.processing = false;
    this.codAgent = null;
    this.provider = 'api4com';
  }

  enqueue(callId: string) {
    if (this.queue.some(item => item.callId === callId)) return;
    this.queue.push({ callId, scheduledAt: Date.now() + INITIAL_DELAY, retries: 0 });
  }

  private async processNext() {
    if (this.processing || !this.codAgent) return;

    const now = Date.now();
    const readyIndex = this.queue.findIndex(item => item.scheduledAt <= now);
    if (readyIndex === -1) return;

    this.processing = true;
    const item = this.queue.splice(readyIndex, 1)[0];

    try {
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(this.provider), {
        body: { action: 'sync_call_history', codAgent: this.codAgent, callId: item.callId },
      });

      if (error || data?.error) {
        console.warn(`Sync failed for ${item.callId}:`, error?.message || data?.error);
        if (item.retries < MAX_RETRIES) {
          this.queue.push({ callId: item.callId, scheduledAt: Date.now() + RETRY_DELAY, retries: item.retries + 1 });
        }
      } else if (data?.data?.synced === 0 && data?.data?.notFound) {
        if (item.retries < MAX_RETRIES) {
          this.queue.push({ callId: item.callId, scheduledAt: Date.now() + RETRY_DELAY, retries: item.retries + 1 });
        }
      } else {
        // Success — notify React
        window.dispatchEvent(new Event('sync-queue-done'));
      }
    } catch (err) {
      console.error(`Sync error for ${item.callId}:`, err);
      if (item.retries < MAX_RETRIES) {
        this.queue.push({ callId: item.callId, scheduledAt: Date.now() + RETRY_DELAY, retries: item.retries + 1 });
      }
    } finally {
      this.processing = false;
    }
  }
}

export const syncQueueManager = new SyncQueueManager();
