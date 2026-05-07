// ============================================
// Queue Management
// CRUD for queues with soft delete, migration,
// orphan protection and auto-sync to agents
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function triggerSync(queueId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync-queue-to-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ queue_id: queueId }),
    });
    return await res.json();
  } catch (err) {
    console.error('[queue-management] Sync failed:', err);
    return { error: (err as Error).message };
  }
}

async function getAgentQueueSettings(clientId: string): Promise<{ queue_limit: number; allow_groups: boolean }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chat_client_settings')
      .select('settings')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) return { queue_limit: 1, allow_groups: false };
    const s = (data.settings ?? {}) as Record<string, unknown>;
    return {
      queue_limit: typeof s?.QUEUE_LIMIT === 'number' && (s.QUEUE_LIMIT as number) > 0 ? (s.QUEUE_LIMIT as number) : 1,
      allow_groups: !!s?.ALLOW_GROUPS,
    };
  } catch (err) {
    console.error('[queue-management] settings lookup failed:', err);
    return { queue_limit: 1, allow_groups: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const supabase = getSupabase();

    switch (action) {
      // ==========================================
      // LIST queues for a client
      // ==========================================
      case 'list': {
        const { client_id, include_deleted } = data;
        if (!client_id) throw new Error('client_id is required');

        let query = supabase
          .from('queues')
          .select('*, queue_agent_links(cod_agent, is_primary)')
          .eq('client_id', client_id)
          .order('created_at', { ascending: false });

        if (!include_deleted) {
          query = query.eq('is_deleted', false);
        }

        const { data: queues, error } = await query;
        if (error) throw error;

        return respond({ queues });
      }

      // ==========================================
      // GET single queue with links
      // ==========================================
      case 'get': {
        const { queue_id } = data;
        if (!queue_id) throw new Error('queue_id is required');

        const { data: queue, error } = await supabase
          .from('queues')
          .select('*, queue_agent_links(cod_agent, is_primary)')
          .eq('id', queue_id)
          .single();

        if (error) throw error;
        return respond({ queue });
      }

      // ==========================================
      // CREATE a new queue
      // ==========================================
      case 'create': {
        const { client_id, name, channel_type, hub, evo_url, evo_apikey, evo_instance, waba_id, waba_token, waba_number_id, link_agents } = data;
        if (!client_id || !name || !channel_type) throw new Error('client_id, name, channel_type are required');

        // Enforce queue limit from agent settings
        const { queue_limit } = await getAgentQueueSettings(String(client_id));
        const { count: activeCount, error: countErr } = await supabase
          .from('queues')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client_id)
          .eq('is_deleted', false);
        if (countErr) throw countErr;
        if ((activeCount ?? 0) >= queue_limit) {
          return respond({
            error: `Limite de ${queue_limit} fila(s) atingido para este agente. Contate seu administrador para aumentar.`,
            code: 'queue_limit_reached',
            limit: queue_limit,
            current: activeCount ?? 0,
          }, 409);
        }

        const { data: queue, error } = await supabase
          .from('queues')
          .insert({
            client_id,
            name,
            channel_type,
            hub: hub || channel_type,
            evo_url: evo_url || null,
            evo_apikey: evo_apikey || null,
            evo_instance: evo_instance || null,
            waba_id: waba_id || null,
            waba_token: waba_token || null,
            waba_number_id: waba_number_id || null,
          })
          .select()
          .single();

        if (error) throw error;

        // For UaZapi queues, create the real instance on the UaZapi server
        if (channel_type === 'uazapi' && queue.evo_instance) {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const createRes = await fetch(`${supabaseUrl}/functions/v1/uazapi-instance-manager`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ action: 'create', instance_name: queue.evo_instance, queue_id: queue.id }),
            });
            const createData = await createRes.json();
            console.log('[queue-management] Instance create result:', JSON.stringify(createData));

            // Update queue with the real instance token
            if (createData.instance_token) {
              await supabase
                .from('queues')
                .update({ evo_apikey: createData.instance_token })
                .eq('id', queue.id);
            }
          } catch (err) {
            console.error('[queue-management] Failed to create UaZapi instance:', err);
            // Queue was created in DB, report warning
            return respond({ queue, instance_warning: 'Failed to create instance on UaZapi server' });
          }
        }

        // Link agents if provided
        if (link_agents && Array.isArray(link_agents) && link_agents.length > 0) {
          const links = link_agents.map((la: { cod_agent: string; is_primary?: boolean }) => ({
            queue_id: queue.id,
            cod_agent: la.cod_agent,
            is_primary: la.is_primary ?? false,
          }));

          const { error: linkError } = await supabase
            .from('queue_agent_links')
            .insert(links);

          if (linkError) {
            console.error('[queue-management] Link error:', linkError);
            // Queue was created, just report link failure
            return respond({ queue, link_warning: linkError.message });
          }

          // Trigger sync to external DB
          const syncResult = await triggerSync(queue.id);
          return respond({ queue, sync: syncResult });
        }

        return respond({ queue });
      }

      // ==========================================
      // UPDATE queue credentials/settings
      // ==========================================
      case 'update': {
        const { queue_id, ...updateFields } = data;
        if (!queue_id) throw new Error('queue_id is required');

        // Remove action-specific fields
        delete updateFields.action;

        const { data: queue, error } = await supabase
          .from('queues')
          .update(updateFields)
          .eq('id', queue_id)
          .eq('is_deleted', false)
          .select()
          .single();

        if (error) throw error;

        // Auto-sync if credential fields changed
        const credFields = ['hub', 'evo_url', 'evo_apikey', 'evo_instance', 'waba_id', 'waba_token', 'waba_number_id'];
        const hasCredChange = credFields.some(f => f in updateFields);

        let syncResult = null;
        if (hasCredChange) {
          syncResult = await triggerSync(queue_id);
        }

        return respond({ queue, sync: syncResult });
      }

      // ==========================================
      // LINK an agent to a queue
      // ==========================================
      case 'link_agent': {
        const { queue_id, cod_agent, is_primary } = data;
        if (!queue_id || !cod_agent) throw new Error('queue_id and cod_agent are required');

        // If setting as primary, first unset any existing primary for this agent
        if (is_primary) {
          await supabase
            .from('queue_agent_links')
            .update({ is_primary: false })
            .eq('cod_agent', cod_agent)
            .eq('is_primary', true);
        }

        const { data: link, error } = await supabase
          .from('queue_agent_links')
          .upsert(
            { queue_id, cod_agent, is_primary: is_primary ?? false },
            { onConflict: 'queue_id,cod_agent' }
          )
          .select()
          .single();

        if (error) throw error;

        // Sync credentials to the newly linked agent
        const syncResult = await triggerSync(queue_id);
        return respond({ link, sync: syncResult });
      }

      // ==========================================
      // UNLINK an agent from a queue
      // ==========================================
      case 'unlink_agent': {
        const { queue_id, cod_agent } = data;
        if (!queue_id || !cod_agent) throw new Error('queue_id and cod_agent are required');

        const { error } = await supabase
          .from('queue_agent_links')
          .delete()
          .eq('queue_id', queue_id)
          .eq('cod_agent', cod_agent);

        if (error) throw error;
        return respond({ success: true });
      }

      // ==========================================
      // SOFT DELETE a queue (with orphan protection)
      // ==========================================
      case 'delete': {
        const { queue_id, migrate_to_queue_id, force } = data;
        if (!queue_id) throw new Error('queue_id is required');

        // Load queue to check channel_type and credentials before any destructive op
        const { data: queueRow } = await supabase
          .from('queues')
          .select('channel_type, evo_url, evo_apikey, evo_instance')
          .eq('id', queue_id)
          .maybeSingle();

        // Auto-unlink agents (confirmação dupla já foi feita no front)
        const { data: links } = await supabase
          .from('queue_agent_links')
          .select('cod_agent')
          .eq('queue_id', queue_id);

        if (links && links.length > 0) {
          const { error: unlinkError } = await supabase
            .from('queue_agent_links')
            .delete()
            .eq('queue_id', queue_id);
          if (unlinkError) {
            return respond({
              error: 'Failed to unlink agents from queue',
              details: unlinkError.message,
              linked_agents: links.map(l => l.cod_agent),
            }, 500);
          }
          console.log('[queue-management] auto-unlinked agents on delete:', links.map(l => l.cod_agent));
        }

        // Check for active conversations
        const { data: activeConvos } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('queue_id', queue_id)
          .in('status', ['pending', 'open']);

        if (activeConvos && activeConvos.length > 0) {
          if (!migrate_to_queue_id && !force) {
            return respond({
              error: 'Queue has active conversations. Provide migrate_to_queue_id, set force=true, or resolve conversations first.',
              active_conversations: activeConvos.length,
            }, 409);
          }

          if (migrate_to_queue_id) {
            // Migrate conversations to new queue
            const { error: migrateError } = await supabase
              .from('chat_conversations')
              .update({ queue_id: migrate_to_queue_id })
              .eq('queue_id', queue_id)
              .in('status', ['pending', 'open']);

            if (migrateError) throw migrateError;

            // Migrate queue_members from old queue to new queue (best-effort)
            try {
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const membersRes = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                  action: 'raw',
                  data: {
                    query: `INSERT INTO queue_members (queue_id, user_id, role)
                      SELECT $1, user_id, role FROM queue_members WHERE queue_id = $2
                      ON CONFLICT (queue_id, user_id) DO NOTHING`,
                    params: [migrate_to_queue_id, queue_id],
                  },
                }),
              });
              const membersData = await membersRes.json();
              console.log('[queue-management] queue_members migrated:', JSON.stringify(membersData));
            } catch (err) {
              console.warn('[queue-management] failed to migrate queue_members:', err);
            }
          }
          // else: force=true → keep conversations attached to the (soft-deleted) queue
          // for later recovery via restore-with-migration.
        }

        // For UaZapi queues, delete the instance on the UaZapi server BEFORE soft delete.
        // Failure here must NOT block the soft delete (queue must disappear from panel).
        let instanceWarning: string | null = null;
        if (queueRow?.channel_type === 'uazapi' && queueRow?.evo_instance && queueRow?.evo_apikey) {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const delRes = await fetch(`${supabaseUrl}/functions/v1/uazapi-instance-manager`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ action: 'delete', queue_id }),
            });
            const delData = await delRes.json();
            console.log('[queue-management] UaZapi instance delete result:', JSON.stringify(delData));
            if (!delData?.success) {
              instanceWarning = `UaZapi instance delete returned status ${delData?.status ?? delRes.status}`;
            }
          } catch (err) {
            console.error('[queue-management] UaZapi instance delete failed:', err);
            instanceWarning = `Failed to delete instance on UaZapi server: ${(err as Error).message}`;
          }
        }

        // Soft delete
        const { error } = await supabase
          .from('queues')
          .update({ is_deleted: true, deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', queue_id);

        if (error) throw error;

        // Limpa queue_members no DB externo (sem FK cross-DB)
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          await fetch(`${supabaseUrl}/functions/v1/db-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              action: 'set_queue_members',
              data: { queue_id, members: [] },
            }),
          });
        } catch (err) {
          console.warn('[queue-management] failed to clear queue_members:', err);
        }

        return respond({
          success: true,
          migrated: migrate_to_queue_id ? (activeConvos?.length || 0) : 0,
          forced: !!force && !migrate_to_queue_id,
          ...(instanceWarning ? { instance_warning: instanceWarning } : {}),
        });
      }

      // ==========================================
      // RESTORE a soft-deleted queue
      // ==========================================
      case 'restore': {
        const { queue_id, migrate_to_queue_id } = data;
        if (!queue_id) throw new Error('queue_id is required');

        // Mode A: migrate data from a soft-deleted queue into another active queue.
        if (migrate_to_queue_id) {
          if (migrate_to_queue_id === queue_id) {
            return respond({ error: 'migrate_to_queue_id must be different from queue_id' }, 400);
          }

          const { data: src, error: srcErr } = await supabase
            .from('queues')
            .select('id, client_id, is_deleted')
            .eq('id', queue_id)
            .maybeSingle();
          if (srcErr) throw srcErr;
          if (!src) return respond({ error: 'Source queue not found' }, 404);

          const { data: dst, error: dstErr } = await supabase
            .from('queues')
            .select('id, client_id, is_deleted')
            .eq('id', migrate_to_queue_id)
            .maybeSingle();
          if (dstErr) throw dstErr;
          if (!dst) return respond({ error: 'Destination queue not found' }, 404);
          if (dst.is_deleted) return respond({ error: 'Destination queue is deleted' }, 400);
          if (dst.client_id !== src.client_id) {
            return respond({ error: 'Destination queue belongs to a different client' }, 400);
          }

          // Move conversations
          const { count: convMoved, error: cErr } = await supabase
            .from('chat_conversations')
            .update({ queue_id: migrate_to_queue_id }, { count: 'exact' })
            .eq('queue_id', queue_id);
          if (cErr) throw cErr;

          // Move messages
          const { count: msgMoved, error: mErr } = await supabase
            .from('chat_messages')
            .update({ queue_id: migrate_to_queue_id }, { count: 'exact' })
            .eq('queue_id', queue_id);
          if (mErr) throw mErr;

          // Migrate queue_members from old queue to new queue (best-effort)
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            await fetch(`${supabaseUrl}/functions/v1/db-query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({
                action: 'raw',
                data: {
                  query: `INSERT INTO queue_members (queue_id, user_id, role)
                    SELECT $1, user_id, role FROM queue_members WHERE queue_id = $2
                    ON CONFLICT (queue_id, user_id) DO NOTHING`,
                  params: [migrate_to_queue_id, queue_id],
                },
              }),
            });
          } catch (err) {
            console.warn('[queue-management] failed to migrate queue_members on restore:', err);
          }

          return respond({
            success: true,
            migrated_to: migrate_to_queue_id,
            conversations_moved: convMoved ?? 0,
            messages_moved: msgMoved ?? 0,
          });
        }

        // Mode B (default): reactivate the original queue.
        const { error } = await supabase
          .from('queues')
          .update({ is_deleted: false, deleted_at: null, is_active: true })
          .eq('id', queue_id);

        if (error) throw error;
        return respond({ success: true });
      }

      // ==========================================
      // MIGRATE conversations between queues
      // ==========================================
      case 'migrate_conversations': {
        const { from_queue_id, to_queue_id, status_filter } = data;
        if (!from_queue_id || !to_queue_id) throw new Error('from_queue_id and to_queue_id are required');

        let query = supabase
          .from('chat_conversations')
          .update({ queue_id: to_queue_id })
          .eq('queue_id', from_queue_id);

        if (status_filter && Array.isArray(status_filter)) {
          query = query.in('status', status_filter);
        }

        const { data: migrated, error, count } = await query.select('id');
        if (error) throw error;

        return respond({ success: true, migrated_count: migrated?.length || 0 });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[queue-management] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
