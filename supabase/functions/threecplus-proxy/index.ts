import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper: makes authenticated request to 3C+ API
async function threecRequest(
  baseUrl: string,
  token: string,
  path: string,
  options: { method?: string; body?: any } = {}
) {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${baseUrl}${path}${separator}api_token=${token}`;
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  };
  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  console.log(`3C+ request: ${fetchOptions.method} ${baseUrl}${path}`);
  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`3C+ erro ${response.status}: ${text}`);
    }
    result = { raw: text };
  }

  if (!response.ok) {
    const message = result?.message || result?.error || JSON.stringify(result);
    throw new Error(`3C+ erro ${response.status}: ${message}`);
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, codAgent, ...params } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get 3C+ config — try agent-specific first, then fallback to global
    let { data: config } = await supabase
      .from('phone_config')
      .select('*')
      .eq('cod_agent', codAgent)
      .eq('is_active', true)
      .eq('provider', '3cplus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config) {
      const { data: globalConfig } = await supabase
        .from('phone_config')
        .select('*')
        .eq('is_active', true)
        .eq('provider', '3cplus')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      config = globalConfig;
    }

    if (!config) {
      throw new Error('Configuração 3C+ não encontrada. Configure o provedor de telefonia.');
    }

    if (!config.threecplus_token) {
      throw new Error('Token da API 3C+ não configurado.');
    }

    const baseUrl = config.threecplus_base_url || 'https://app.3c.fluxoti.com/api/v1';
    const token = config.threecplus_token;

    let result: any;

    switch (action) {

      // ------------------------------------------------------------------
      // get_sip_credentials — login agente no webphone 3C+
      // POST /agent/webphone/login  → { domain, username, password, port }
      // ------------------------------------------------------------------
      case 'get_sip_credentials': {
        const { extensionId } = params;

        // Fetch extension record from DB
        const { data: ext } = await supabase
          .from('phone_extensions')
          .select('threecplus_agent_id, threecplus_sip_username, threecplus_sip_password, threecplus_sip_domain, threecplus_extension')
          .eq('id', extensionId)
          .eq('cod_agent', codAgent)
          .single();

        if (!ext) throw new Error('Ramal não encontrado.');

        // If we already have cached SIP credentials, return them
        if (ext.threecplus_sip_username && ext.threecplus_sip_password && ext.threecplus_sip_domain) {
          result = {
            domain: ext.threecplus_sip_domain,
            username: ext.threecplus_sip_username,
            password: ext.threecplus_sip_password,
            wsUrl: config.threecplus_ws_url || `wss://${ext.threecplus_sip_domain}`,
          };
          break;
        }

        // Otherwise, call 3C+ webphone login to obtain fresh SIP credentials
        if (!ext.threecplus_agent_id) {
          throw new Error('ID do agente 3C+ não configurado neste ramal.');
        }

        const loginResp = await threecRequest(baseUrl, token, '/agent/webphone/login', {
          method: 'POST',
          body: { agent_id: ext.threecplus_agent_id },
        });

        // 3C+ returns: { sip_server, sip_user, sip_password, ... }
        const sipDomain = loginResp.sip_server || loginResp.domain || loginResp.host;
        const sipUsername = loginResp.sip_user || loginResp.username || loginResp.extension;
        const sipPassword = loginResp.sip_password || loginResp.password;

        if (!sipDomain || !sipUsername || !sipPassword) {
          throw new Error('3C+ não retornou credenciais SIP válidas: ' + JSON.stringify(loginResp));
        }

        // Cache credentials in DB
        await supabase.from('phone_extensions').update({
          threecplus_sip_domain: sipDomain,
          threecplus_sip_username: sipUsername,
          threecplus_sip_password: sipPassword,
        }).eq('id', extensionId);

        const wsUrl = config.threecplus_ws_url || `wss://${sipDomain}`;

        result = { domain: sipDomain, username: sipUsername, password: sipPassword, wsUrl };
        break;
      }

      // ------------------------------------------------------------------
      // dial — realiza chamada click-to-call
      // POST /click2call
      // ------------------------------------------------------------------
      case 'dial': {
        const { extensionId, phone, metadata } = params;

        // Resolve extension record
        let agentId: string | null = null;
        let extension: string | null = null;

        if (extensionId) {
          const { data: ext } = await supabase
            .from('phone_extensions')
            .select('threecplus_agent_id, threecplus_extension')
            .eq('id', extensionId)
            .eq('cod_agent', codAgent)
            .single();

          if (!ext?.threecplus_agent_id && !ext?.threecplus_extension) {
            throw new Error('Ramal sem vínculo 3C+. Sincronize ou recrie o ramal.');
          }
          agentId = ext.threecplus_agent_id || null;
          extension = ext.threecplus_extension || null;
        }

        const dialBody: Record<string, any> = {
          phone_number: phone,
          ...(agentId ? { agent_id: agentId } : {}),
          ...(extension ? { extension } : {}),
          metadata: { ...(metadata || {}), gateway: 'atende-julia', cod_agent: codAgent },
        };

        result = await threecRequest(baseUrl, token, '/click2call', {
          method: 'POST',
          body: dialBody,
        });
        break;
      }

      // ------------------------------------------------------------------
      // hangup — desliga chamada ativa
      // POST /agent/call/{callId}/hangup
      // ------------------------------------------------------------------
      case 'hangup': {
        const { callId } = params;
        result = await threecRequest(baseUrl, token, `/agent/call/${callId}/hangup`, {
          method: 'POST',
          body: {},
        });
        break;
      }

      // ------------------------------------------------------------------
      // list_extensions — lista agentes no 3C+
      // GET /agents
      // ------------------------------------------------------------------
      case 'list_extensions': {
        result = await threecRequest(baseUrl, token, '/agents');
        break;
      }

      // ------------------------------------------------------------------
      // create_extension — cria agente no 3C+ e persiste no DB
      // POST /agents
      // ------------------------------------------------------------------
      case 'create_extension': {
        const createPayload = (params?.params && typeof params.params === 'object') ? params.params : params;
        const { firstName, lastName, email, assignedMemberId, label } = createPayload;
        let extensionNumber = String(
          createPayload.extensionNumber
          ?? createPayload.extension_number
          ?? createPayload.extension
          ?? createPayload.number
          ?? createPayload.ramal
          ?? ''
        ).trim();

        // Validate uniqueness
        if (assignedMemberId) {
          const { data: existingMember } = await supabase
            .from('phone_extensions')
            .select('id')
            .eq('cod_agent', codAgent)
            .eq('assigned_member_id', assignedMemberId)
            .maybeSingle();
          if (existingMember) {
            throw new Error('Este membro já possui um ramal vinculado.');
          }
        }

        const fName = firstName || 'Agente';
        const lName = lastName || String(codAgent);
        const emailToUse = email || `agente_${Date.now()}@atendejulia.com.br`;

        // Generate strong random password (12+ chars, uppercase, number, special)
        const upper = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map(b => String.fromCharCode(65 + (b % 26))).join('');
        const lower = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map(b => String.fromCharCode(97 + (b % 26))).join('');
        const nums = Array.from(crypto.getRandomValues(new Uint8Array(2)))
          .map(b => String(b % 10)).join('');
        const specials = ['@', '#', '$', '!', '%'];
        const spec1 = specials[crypto.getRandomValues(new Uint8Array(1))[0] % specials.length];
        const spec2 = specials[crypto.getRandomValues(new Uint8Array(1))[0] % specials.length];
        const randomPass = `${upper}${lower}${nums}${spec1}${spec2}`;

        if (!extensionNumber) {
          const { data: existingExts, error: extError } = await supabase
            .from('phone_extensions')
            .select('extension_number')
            .eq('cod_agent', codAgent)
            .eq('provider', '3cplus');

          if (extError) {
            throw new Error(`Erro ao definir ramal automaticamente: ${extError.message}`);
          }

          const used = new Set<number>(
            (existingExts || [])
              .map((row: any) => Number.parseInt(String(row.extension_number), 10))
              .filter((n: number) => Number.isFinite(n) && n > 0)
          );

          let candidate = 1000;
          while (used.has(candidate)) candidate++;
          extensionNumber = String(candidate);

          console.log(`3C+ create_extension: ramal ausente no payload, usando ${extensionNumber}`);
        }

        // Create user in 3C+ (endpoint is /users, not /agents)
        const userBody: Record<string, any> = {
          name: `${fName} ${lName}`.trim(),
          email: emailToUse,
          password: randomPass,
          role: 'agent',
          timezone: 'America/Sao_Paulo',
          extension_number: String(extensionNumber),
        };

        const apiResult = await threecRequest(baseUrl, token, '/users', {
          method: 'POST',
          body: userBody,
        });

        const agentId = apiResult?.id ? String(apiResult.id) : null;
        const ext = apiResult?.extension || extensionNumber || null;

        if (!agentId) {
          throw new Error('3C+ não retornou ID do agente. Resposta: ' + JSON.stringify(apiResult));
        }

        // Persist in DB
        const { error: dbError } = await supabase.from('phone_extensions').insert({
          cod_agent: codAgent,
          extension_number: ext || agentId,
          label: label || fName || null,
          assigned_member_id: assignedMemberId || null,
          provider: '3cplus',
          threecplus_agent_id: agentId,
          threecplus_extension: ext,
          threecplus_raw: apiResult,
          is_active: true,
        });

        if (dbError) {
          // Best-effort rollback: delete user from 3C+
          try {
            await threecRequest(baseUrl, token, `/users/${agentId}`, { method: 'DELETE' });
          } catch {}
          throw new Error(`Erro ao salvar ramal no banco: ${dbError.message}`);
        }

        result = { agentId, extension: ext, raw: apiResult };
        break;
      }

      // ------------------------------------------------------------------
      // delete_extension — remove agente do 3C+ e do DB
      // DELETE /agents/{id}
      // ------------------------------------------------------------------
      case 'delete_extension': {
        const { extensionId } = params;

        // Fetch DB record
        const { data: extRecord } = await supabase
          .from('phone_extensions')
          .select('id, threecplus_agent_id')
          .eq('threecplus_agent_id', extensionId)
          .eq('cod_agent', codAgent)
          .maybeSingle();

        const deleteResults: Record<string, unknown> = {};

        // Delete from 3C+ (endpoint is /users, not /agents)
        if (extensionId) {
          try {
            await threecRequest(baseUrl, token, `/users/${extensionId}`, { method: 'DELETE' });
            deleteResults.agent = { success: true };
          } catch (e: any) {
            if (!e.message?.includes('404')) throw e;
            deleteResults.agent = { success: true, note: 'already_gone' };
          }
        }

        // Delete from DB
        if (extRecord?.id) {
          const { error: dbError } = await supabase
            .from('phone_extensions').delete().eq('id', extRecord.id);
          if (dbError) throw new Error(`Erro ao deletar do banco: ${dbError.message}`);
        } else {
          await supabase.from('phone_extensions').delete()
            .eq('threecplus_agent_id', extensionId).eq('cod_agent', codAgent);
        }
        deleteResults.database = { success: true };
        result = deleteResults;
        break;
      }

      // ------------------------------------------------------------------
      // sync_extensions — sincroniza agentes do 3C+ com o DB local
      // GET /agents
      // ------------------------------------------------------------------
      case 'sync_extensions': {
        const agentsData = await threecRequest(baseUrl, token, '/agents');
        const agentList: any[] = Array.isArray(agentsData)
          ? agentsData
          : (agentsData?.data || agentsData?.agents || []);

        let synced = 0;
        const errors: string[] = [];

        for (const agent of agentList) {
          const agentId = agent.id ? String(agent.id) : null;
          const ext = agent.extension ? String(agent.extension) : null;
          if (!agentId) continue;

          const { data: existing } = await supabase
            .from('phone_extensions').select('id')
            .eq('cod_agent', codAgent).eq('threecplus_agent_id', agentId)
            .maybeSingle();

          if (existing) {
            await supabase.from('phone_extensions').update({
              threecplus_extension: ext,
              threecplus_raw: agent,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            const { error: insertError } = await supabase.from('phone_extensions').insert({
              cod_agent: codAgent,
              extension_number: ext || agentId,
              provider: '3cplus',
              threecplus_agent_id: agentId,
              threecplus_extension: ext,
              threecplus_raw: agent,
              is_active: true,
            });
            if (insertError) {
              errors.push(`Agente ${agentId}: ${insertError.message}`);
            }
          }
          synced++;
        }

        result = { synced, total: agentList.length, errors };
        break;
      }

      // ------------------------------------------------------------------
      // setup_webhook — registra webhook no 3C+
      // POST /webhooks
      // ------------------------------------------------------------------
      case 'setup_webhook': {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/threecplus-webhook`;
        result = await threecRequest(baseUrl, token, '/webhooks', {
          method: 'POST',
          body: {
            url: webhookUrl,
            events: ['call-was-answered', 'call-was-ended', 'agent-status-changed'],
            active: true,
          },
        });
        break;
      }

      // ------------------------------------------------------------------
      // get_account — retorna informações da conta 3C+
      // GET /account
      // ------------------------------------------------------------------
      case 'get_account': {
        result = await threecRequest(baseUrl, token, '/account');
        break;
      }

      // ------------------------------------------------------------------
      // sync_call_history — sincroniza histórico de chamadas
      // GET /agent/calls (com paginação)
      // ------------------------------------------------------------------
      case 'sync_call_history': {
        const { callId, since } = params;
        let totalSynced = 0;
        let totalRecords = 0;
        const syncErrors: string[] = [];
        let notFound = false;

        const fixTz = (ts: string | null | undefined): string | null => {
          if (!ts) return null;
          const s = String(ts).trim();
          if (/[+-]\d{2}:\d{2}$/.test(s) || s.endsWith('Z')) return s;
          return `${s}-03:00`;
        };

        try {
          if (callId) {
            // MODE 1: Sync specific call
            let page = 1;
            let found = false;
            const maxPages = 3;

            while (!found && page <= maxPages) {
              const data = await threecRequest(baseUrl, token, `/agent/calls?page=${page}`);
              const records: any[] = Array.isArray(data) ? data : (data?.data || []);
              if (records.length === 0) break;
              totalRecords += records.length;

              for (const cdr of records) {
                const cdrId = cdr.id ? String(cdr.id) : null;
                if (cdrId !== String(callId)) continue;
                found = true;

                const logEntry = buildCallLog(cdr, codAgent, fixTz);
                await supabase.from('phone_call_logs')
                  .upsert(logEntry, { onConflict: 'call_id' });
                totalSynced = 1;
                break;
              }

              const meta = data?.meta || data?.pagination;
              if (meta?.current_page < meta?.last_page) page++;
              else break;
            }

            if (!found) notFound = true;
          } else {
            // MODE 2: Incremental sync
            let sinceDate = since;
            if (!sinceDate) {
              const { data: lastLog } = await supabase
                .from('phone_call_logs').select('started_at')
                .eq('cod_agent', codAgent)
                .order('started_at', { ascending: false })
                .limit(1).maybeSingle();
              sinceDate = lastLog?.started_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            }

            let page = 1;
            let hasMore = true;
            const maxPages = 5;

            while (hasMore && page <= maxPages) {
              const data = await threecRequest(baseUrl, token, `/agent/calls?page=${page}`);
              const records: any[] = Array.isArray(data) ? data : (data?.data || []);
              if (records.length === 0) break;
              totalRecords += records.length;

              for (const cdr of records) {
                const cdrStarted = cdr.started_at || cdr.created_at;
                if (sinceDate && cdrStarted && new Date(cdrStarted) < new Date(sinceDate)) {
                  hasMore = false;
                  continue;
                }

                const logEntry = buildCallLog(cdr, codAgent, fixTz);
                const cdrId = cdr.id ? String(cdr.id) : null;

                if (cdrId) {
                  await supabase.from('phone_call_logs')
                    .upsert(logEntry, { onConflict: 'call_id' });
                } else {
                  const { data: dup } = await supabase.from('phone_call_logs').select('id')
                    .eq('cod_agent', codAgent)
                    .eq('caller', logEntry.caller || '')
                    .eq('started_at', logEntry.started_at || '')
                    .maybeSingle();
                  if (!dup) await supabase.from('phone_call_logs').insert(logEntry);
                }
                totalSynced++;
              }

              const meta = data?.meta || data?.pagination;
              if (meta?.current_page < meta?.last_page) page++;
              else if (records.length >= 10) page++;
              else hasMore = false;
            }
          }
        } catch (e: any) {
          syncErrors.push(e.message);
        }

        result = { synced: totalSynced, total: totalRecords, errors: syncErrors, notFound };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('3cplus-proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ------------------------------------------------------------------
// Helper: normalize a 3C+ CDR record to phone_call_logs shape
// ------------------------------------------------------------------
function buildCallLog(
  cdr: any,
  codAgent: string,
  fixTz: (ts: string | null | undefined) => string | null
): Record<string, any> {
  const cdrId = cdr.id ? String(cdr.id) : null;
  const direction = cdr.direction || cdr.call_type || 'outbound';
  const caller = cdr.from || cdr.caller || cdr.origin || '';
  const called = cdr.to || cdr.destination || cdr.phone_number || '';

  const metadata: Record<string, any> = { provider: '3cplus' };
  if (cdr.agent_id) metadata.agent_id = cdr.agent_id;
  if (cdr.campaign_id) metadata.campaign_id = cdr.campaign_id;
  if (cdr.metadata) metadata.raw_metadata = cdr.metadata;

  const log: Record<string, any> = {
    cod_agent: codAgent,
    extension_number: caller,
    direction,
    caller,
    called,
    started_at: fixTz(cdr.started_at || cdr.created_at),
    ended_at: fixTz(cdr.ended_at || cdr.finished_at),
    answered_at: fixTz(cdr.answered_at || cdr.answer_stamp),
    duration_seconds: Number(cdr.duration ?? cdr.talk_time ?? 0),
    record_url: cdr.record_url || cdr.recording_url || null,
    cost: Number(cdr.cost ?? cdr.call_price ?? 0),
    hangup_cause: cdr.hangup_cause || cdr.end_reason || null,
    status: 'hangup',
    metadata,
  };

  if (cdrId) log.call_id = cdrId;
  return log;
}
