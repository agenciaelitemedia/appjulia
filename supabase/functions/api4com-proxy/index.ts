import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: makes request to Api4Com and validates response
async function api4comRequest(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  options: { method?: string; body?: any } = {}
) {
  const url = `${baseUrl}${path}`;
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  console.log(`Api4Com request: ${fetchOptions.method} ${url}`);
  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`Api4Com erro ${response.status}: ${text}`);
    }
    result = { raw: text };
  }

  // Check for error in response body
  if (result?.error) {
    throw new Error(`Api4Com: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`);
  }
  if (result?.data?.error) {
    throw new Error(`Api4Com: ${typeof result.data.error === 'string' ? result.data.error : JSON.stringify(result.data.error)}`);
  }

  if (!response.ok) {
    throw new Error(`Api4Com erro ${response.status}: ${JSON.stringify(result)}`);
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

    // Get API4Com config for this agent
    const { data: config, error: configError } = await supabase
      .from('phone_config')
      .select('*')
      .eq('cod_agent', codAgent)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      throw new Error('Configuração Api4Com não encontrada para este agente');
    }

    const baseUrl = `https://${config.api4com_domain}/api/v1`;
    const headers = {
      'Authorization': config.api4com_token,
      'Content-Type': 'application/json',
    };

    let result: any;

    switch (action) {
      case 'dial': {
        const { extensionId, phone, metadata } = params;

        // Resolve real extension from DB
        let api4comRamal: string;
        if (extensionId) {
          const { data: ext } = await supabase
            .from('phone_extensions')
            .select('api4com_ramal, extension_number')
            .eq('id', extensionId)
            .eq('cod_agent', codAgent)
            .single();

          if (!ext?.api4com_ramal) {
            throw new Error('Ramal sem vínculo Api4Com. Sincronize ou recrie o ramal.');
          }
          api4comRamal = ext.api4com_ramal;
        } else if (params.extension) {
          // Legacy fallback
          api4comRamal = params.extension;
        } else {
          throw new Error('extensionId ou extension é obrigatório');
        }

        const dialBody = {
          extension: api4comRamal,
          phone,
          metadata: { ...(metadata || {}), gateway: 'atende-julia', cod_agent: codAgent },
        };

        try {
          result = await api4comRequest(baseUrl, '/dialer', headers, {
            method: 'POST',
            body: dialBody,
          });

          // Log successful initiation
          await supabase.from('phone_call_logs').insert({
            call_id: result.call_id || result.id || null,
            cod_agent: codAgent,
            extension_number: api4comRamal,
            direction: 'outbound',
            caller: api4comRamal,
            called: phone,
            started_at: new Date().toISOString(),
            status: 'initiated',
            metadata: dialBody.metadata,
          });
        } catch (dialError: any) {
          // Log failed attempt
          await supabase.from('phone_call_logs').insert({
            cod_agent: codAgent,
            extension_number: api4comRamal,
            direction: 'outbound',
            caller: api4comRamal,
            called: phone,
            started_at: new Date().toISOString(),
            status: 'failed',
            hangup_cause: dialError.message,
            metadata: dialBody.metadata,
          });
          throw dialError;
        }
        break;
      }

      case 'list_extensions': {
        result = await api4comRequest(baseUrl, '/extensions', headers);
        break;
      }

      case 'create_extension': {
        const { firstName, lastName, email } = params;
        // Generate random password for the extension
        const randomSenha = Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map(b => String.fromCharCode(65 + (b % 26)))
          .join('') + Math.floor(Math.random() * 900 + 100);

        result = await api4comRequest(baseUrl, '/extensions/next-available', headers, {
          method: 'POST',
          body: {
            first_name: firstName || 'Ramal',
            last_name: lastName || codAgent,
            email_address: email || `ramal_${Date.now()}@atendejulia.com`,
            senha: randomSenha,
            gravar_audio: 1,
          },
        });

        // Validate Api4Com returned real credentials
        const ramal = result?.ramal || result?.extension;
        const senha = result?.senha || result?.password;
        const id = result?.id;

        if (!ramal) {
          throw new Error('Api4Com não retornou número de ramal. Resposta: ' + JSON.stringify(result));
        }

        // Auto-populate sip_domain from create response if not set
        const sipDomainFromResponse = result?.domain;
        if (sipDomainFromResponse && !config.sip_domain) {
          await supabase.from('phone_config')
            .update({ sip_domain: sipDomainFromResponse })
            .eq('id', config.id);
          console.log(`Auto-saved sip_domain: ${sipDomainFromResponse}`);
        }

        // Enrich result for frontend
        result = { ...result, ramal, senha, id: id ? String(id) : null };
        break;
      }

      case 'update_extension': {
        const { extensionId, extensionData } = params;
        result = await api4comRequest(baseUrl, `/extensions/${extensionId}`, headers, {
          method: 'PUT',
          body: extensionData,
        });
        break;
      }

      case 'delete_extension': {
        const { extensionId } = params;
        const response = await fetch(`${baseUrl}/extensions/${extensionId}`, {
          method: 'DELETE',
          headers,
        });
        const text = await response.text();
        result = { success: response.ok, detail: text };
        break;
      }

      case 'hangup': {
        const { callId } = params;
        result = await api4comRequest(baseUrl, '/calls/hangup', headers, {
          method: 'POST',
          body: { call_id: callId },
        });
        break;
      }

      case 'get_sip_credentials': {
        const { extensionId } = params;
        // Get extension from our DB
        const { data: ext } = await supabase
          .from('phone_extensions')
          .select('api4com_ramal, api4com_password, api4com_id')
          .eq('id', extensionId)
          .eq('cod_agent', codAgent)
          .single();

        let username = ext?.api4com_ramal;
        let password = ext?.api4com_password;

        // If credentials missing, try to auto-hydrate from Api4Com
        if ((!username || !password) && ext?.api4com_id) {
          console.log('Credentials missing, attempting auto-hydrate from Api4Com');
          try {
            const apiExt = await api4comRequest(baseUrl, `/extensions/${ext.api4com_id}`, headers);
            username = apiExt?.ramal || apiExt?.extension || username;
            password = apiExt?.senha || apiExt?.password || password;

            if (username && password) {
              await supabase.from('phone_extensions')
                .update({ api4com_ramal: username, api4com_password: password })
                .eq('id', extensionId);
            }
          } catch (e) {
            console.log('Auto-hydrate failed:', e);
          }
        }

        if (!username || !password) {
          throw new Error('Credenciais SIP não encontradas. Sincronize os ramais ou recrie este ramal.');
        }

        let sipDomain = config.sip_domain;

        // Auto-resolve account SIP domain when not configured
        if (!sipDomain) {
          try {
            const account = await api4comRequest(baseUrl, '/accounts', headers);
            const resolvedDomain = account?.domain || account?.data?.domain || (Array.isArray(account) ? account[0]?.domain : null);

            if (resolvedDomain) {
              sipDomain = resolvedDomain;
              await supabase.from('phone_config')
                .update({ sip_domain: resolvedDomain })
                .eq('id', config.id);
              console.log(`Resolved and saved sip_domain: ${resolvedDomain}`);
            }
          } catch (e) {
            console.log('Could not auto-resolve sip_domain from /accounts:', e);
          }
        }

        const finalSipDomain = sipDomain || config.api4com_domain;

        result = {
          domain: finalSipDomain,
          username,
          password,
          wsUrl: `wss://${finalSipDomain}:6443`,
        };
        break;
      }

      case 'sync_extensions': {
        // List all real extensions from Api4Com and upsert into our DB
        const apiExtensions = await api4comRequest(baseUrl, '/extensions', headers);
        const extList = Array.isArray(apiExtensions) ? apiExtensions : (apiExtensions?.data || apiExtensions?.extensions || []);

        let synced = 0;
        let errors: string[] = [];

        for (const apiExt of extList) {
          const api4comId = apiExt.id ? String(apiExt.id) : null;
          const ramal = apiExt.ramal || apiExt.extension || null;
          const senha = apiExt.senha || apiExt.password || null;

          if (!api4comId && !ramal) continue;

          // Check if we already have this extension
          let query = supabase.from('phone_extensions').select('id').eq('cod_agent', codAgent);
          if (api4comId) {
            query = query.eq('api4com_id', api4comId);
          } else {
            query = query.eq('api4com_ramal', ramal);
          }
          const { data: existing } = await query.maybeSingle();

          if (existing) {
            // Update credentials
            const updateData: any = {};
            if (ramal) updateData.api4com_ramal = ramal;
            if (senha) updateData.api4com_password = senha;
            if (api4comId) updateData.api4com_id = api4comId;
            updateData.updated_at = new Date().toISOString();

            await supabase.from('phone_extensions').update(updateData).eq('id', existing.id);
            synced++;
          } else {
            // Insert new extension
            const { error: insertError } = await supabase.from('phone_extensions').insert({
              cod_agent: codAgent,
              extension_number: ramal || `ext-${api4comId}`,
              label: apiExt.first_name ? `${apiExt.first_name} ${apiExt.last_name || ''}`.trim() : null,
              api4com_id: api4comId,
              api4com_ramal: ramal,
              api4com_password: senha,
              is_active: true,
            });
            if (insertError) {
              errors.push(`Ramal ${ramal}: ${insertError.message}`);
            } else {
              synced++;
            }
          }
        }

        result = { synced, total: extList.length, errors };
        break;
      }

      case 'setup_webhook': {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/api4com-webhook`;
        result = await api4comRequest(baseUrl, '/integrations', headers, {
          method: 'PATCH',
          body: {
            gateway: 'atende-julia',
            webhook: true,
            webhookConstraint: {
              metadata: { gateway: 'atende-julia' }
            },
            metadata: {
              webhookUrl,
              webhookVersion: 'v1.4',
              webhookTypes: ['channel-create', 'channel-answer', 'channel-hangup']
            }
          },
        });
        break;
      }

      case 'get_account': {
        result = await api4comRequest(baseUrl, '/accounts', headers);
        break;
      }

      case 'complete_call_log': {
        const { extensionNumber, phone, startedAt, endedAt, durationSeconds, hangupCause } = params;

        // Try to find existing log (created by dial or webhook)
        let existingLog = null;
        if (extensionNumber && phone) {
          const { data: logs } = await supabase
            .from('phone_call_logs')
            .select('id, call_id, status')
            .eq('cod_agent', codAgent)
            .eq('extension_number', extensionNumber)
            .eq('called', phone)
            .order('created_at', { ascending: false })
            .limit(1);
          existingLog = logs?.[0] || null;
        }

        // Try to fetch CDR details from Api4Com for recording URL and cost
        let recordUrl: string | null = null;
        let cost: number | null = null;
        if (existingLog?.call_id) {
          try {
            const cdrResult = await api4comRequest(baseUrl, `/cdr?call_id=${existingLog.call_id}`, headers);
            const cdr = Array.isArray(cdrResult) ? cdrResult[0] : cdrResult?.data?.[0] || cdrResult;
            recordUrl = cdr?.record_url || cdr?.recording_url || cdr?.gravacao || null;
            cost = cdr?.cost != null ? Number(cdr.cost) : null;
          } catch (e) {
            console.log('CDR fetch failed (non-critical):', e);
          }
        }

        const logData: any = {
          cod_agent: codAgent,
          extension_number: extensionNumber || null,
          called: phone || null,
          ended_at: endedAt || new Date().toISOString(),
          duration_seconds: durationSeconds || 0,
          hangup_cause: hangupCause || 'normal_clearing',
          status: 'hangup',
        };
        if (recordUrl) logData.record_url = recordUrl;
        if (cost != null) logData.cost = cost;
        if (startedAt) logData.started_at = startedAt;

        if (existingLog) {
          // Update existing log (don't overwrite webhook data if already complete)
          if (existingLog.status === 'hangup') {
            // Already completed by webhook, just ensure we have all fields
            const { error: updateErr } = await supabase
              .from('phone_call_logs')
              .update({
                ...(recordUrl && { record_url: recordUrl }),
                ...(cost != null && { cost }),
                ...(durationSeconds && { duration_seconds: durationSeconds }),
              })
              .eq('id', existingLog.id);
            if (updateErr) console.log('Update existing complete log error:', updateErr);
          } else {
            const { error: updateErr } = await supabase
              .from('phone_call_logs')
              .update(logData)
              .eq('id', existingLog.id);
            if (updateErr) throw new Error(`Erro ao atualizar log: ${updateErr.message}`);
          }
          result = { updated: true, id: existingLog.id, record_url: recordUrl, cost };
        } else {
          // Create new log as fallback
          logData.direction = 'outbound';
          logData.caller = extensionNumber || null;
          const { data: inserted, error: insertErr } = await supabase
            .from('phone_call_logs')
            .insert(logData)
            .select('id')
            .single();
          if (insertErr) throw new Error(`Erro ao criar log: ${insertErr.message}`);
          result = { created: true, id: inserted?.id, record_url: recordUrl, cost };
        }
        break;
      }

      case 'sync_call_history': {
        // Fetch all extensions for this agent
        const { data: agentExtensions } = await supabase
          .from('phone_extensions')
          .select('api4com_ramal, extension_number')
          .eq('cod_agent', codAgent)
          .not('api4com_ramal', 'is', null);

        if (!agentExtensions?.length) {
          result = { synced: 0, total: 0, message: 'Nenhum ramal encontrado' };
          break;
        }

        let totalSynced = 0;
        let totalRecords = 0;
        const syncErrors: string[] = [];

        for (const ext of agentExtensions) {
          try {
            // Try different CDR endpoint patterns
            let cdrData: any;
            try {
              cdrData = await api4comRequest(baseUrl, `/cdr?ramal=${ext.api4com_ramal}`, headers);
            } catch {
              try {
                cdrData = await api4comRequest(baseUrl, `/cdr?extension=${ext.api4com_ramal}`, headers);
              } catch {
                cdrData = await api4comRequest(baseUrl, `/cdr/${ext.api4com_ramal}`, headers);
              }
            }

            const records = Array.isArray(cdrData) ? cdrData : (cdrData?.data || cdrData?.records || cdrData?.cdr || []);
            totalRecords += records.length;

            for (const cdr of records) {
              const callId = cdr.call_id || cdr.uniqueid || cdr.id || null;
              const direction = cdr.direction || (cdr.type === 'inbound' ? 'inbound' : 'outbound');
              const caller = cdr.caller || cdr.src || cdr.from || ext.api4com_ramal;
              const called = cdr.called || cdr.dst || cdr.to || null;
              const startedAt = cdr.started_at || cdr.start || cdr.calldate || null;
              const endedAt = cdr.ended_at || cdr.end || null;
              const durationSec = cdr.duration_seconds ?? cdr.duration ?? cdr.billsec ?? 0;
              const recordUrlCdr = cdr.record_url || cdr.recording_url || cdr.gravacao || null;
              const costCdr = cdr.cost != null ? Number(cdr.cost) : (cdr.tarifa != null ? Number(cdr.tarifa) : 0);
              const hangupCauseCdr = cdr.hangup_cause || cdr.disposition || null;

              const logEntry: any = {
                cod_agent: codAgent,
                extension_number: ext.api4com_ramal,
                direction,
                caller,
                called,
                started_at: startedAt,
                ended_at: endedAt,
                duration_seconds: Number(durationSec),
                record_url: recordUrlCdr,
                cost: costCdr,
                hangup_cause: hangupCauseCdr,
                status: 'hangup',
              };

              if (callId) {
                logEntry.call_id = String(callId);
                // Check if exists
                const { data: existing } = await supabase
                  .from('phone_call_logs')
                  .select('id')
                  .eq('call_id', String(callId))
                  .maybeSingle();

                if (existing) {
                  // Update with enriched data
                  await supabase.from('phone_call_logs').update({
                    duration_seconds: Number(durationSec),
                    record_url: recordUrlCdr,
                    cost: costCdr,
                    hangup_cause: hangupCauseCdr,
                    ended_at: endedAt,
                    status: 'hangup',
                  }).eq('id', existing.id);
                } else {
                  await supabase.from('phone_call_logs').insert(logEntry);
                }
              } else {
                // No call_id — insert if not duplicate by time+number
                const { data: dup } = await supabase
                  .from('phone_call_logs')
                  .select('id')
                  .eq('cod_agent', codAgent)
                  .eq('extension_number', ext.api4com_ramal)
                  .eq('called', called || '')
                  .eq('started_at', startedAt || '')
                  .maybeSingle();

                if (!dup) {
                  await supabase.from('phone_call_logs').insert(logEntry);
                }
              }
              totalSynced++;
            }
          } catch (e: any) {
            syncErrors.push(`Ramal ${ext.api4com_ramal}: ${e.message}`);
          }
        }

        result = { synced: totalSynced, total: totalRecords, errors: syncErrors };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('api4com-proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
