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

        result = await api4comRequest(baseUrl, '/dialer', headers, {
          method: 'POST',
          body: dialBody,
        });
        break;
      }

      case 'list_extensions': {
        result = await api4comRequest(baseUrl, '/extensions', headers);
        break;
      }

      case 'create_extension': {
        const { firstName, lastName, email, assignedMemberId, label, extensionNumber } = params;

        // Validate uniqueness: 1 member = 1 extension per agent
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

        // Generate random password
        const randomSenha = Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map(b => String.fromCharCode(65 + (b % 26)))
          .join('') + Math.floor(Math.random() * 900 + 100);

        const emailToUse = `ramal_${Date.now()}@atendejulia.com.br`;
        const fName = firstName || 'Ramal';
        const lName = lastName || codAgent;

        // Determine ramal number
        let ramalNumber = extensionNumber;
        if (!ramalNumber) {
          try {
            const existing = await api4comRequest(baseUrl, '/extensions', headers);
            const extList = Array.isArray(existing) ? existing : (existing?.data || existing?.extensions || []);
            const existingNumbers = new Set(
              extList
                .map((e: any) => parseInt(e.ramal || e.extension || '0', 10))
                .filter((n: number) => !isNaN(n) && n > 0)
            );
            // Find next available number starting from 1000
            let candidate = 1000;
            while (existingNumbers.has(candidate)) {
              candidate++;
            }
            ramalNumber = String(candidate);
            console.log('Auto-assigned ramal number:', ramalNumber, 'existing:', [...existingNumbers].sort());
          } catch {
            ramalNumber = String(1000 + Date.now() % 1000);
          }
        }

        // ---- STEP 1: Create user in Api4Com organization ----
        let api4comUserId: string | null = null;
        try {
          const userResult = await api4comRequest(baseUrl, '/users', headers, {
            method: 'POST',
            body: {
              name: `${fName} ${lName}`.trim(),
              email: emailToUse,
              password: randomSenha,
              phone: '',
              role: 'USER',
            },
          });
          api4comUserId = userResult?.id ? String(userResult.id) : null;
          console.log('Api4Com user created:', api4comUserId, userResult);
        } catch (userErr: any) {
          // User might already exist (email conflict) — continue to extension creation
          console.log('User creation skipped/failed (may already exist):', userErr.message);
        }

        // ---- STEP 2: Create extension (ramal) in Api4Com with retry on conflict ----
        let apiResult: any;
        let finalRamalNumber = ramalNumber;
        const maxRetries = 10;
        let created = false;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            apiResult = await api4comRequest(baseUrl, '/extensions', headers, {
              method: 'POST',
              body: {
                ramal: finalRamalNumber,
                senha: randomSenha,
                first_name: fName,
                last_name: lName,
                email_address: emailToUse,
                gravar_audio: 1,
              },
            });
            created = true;
            break;
          } catch (extErr: any) {
            // If "already exists", try next number (only for auto-assigned numbers)
            if (extErr.message?.includes('already exists') && !extensionNumber) {
              console.log(`Ramal ${finalRamalNumber} already exists, trying next...`);
              finalRamalNumber = String(parseInt(finalRamalNumber, 10) + 1);
              continue;
            }
            // Other error or user-chosen number — rollback and fail
            if (api4comUserId) {
              try {
                await fetch(`${baseUrl}/users/${api4comUserId}`, { method: 'DELETE', headers });
                console.log('Rolled back Api4Com user:', api4comUserId);
              } catch (e) {
                console.error('Rollback user delete failed:', e);
              }
            }
            throw new Error(`Erro ao criar ramal na Api4Com: ${extErr.message}`);
          }
        }

        if (!created) {
          if (api4comUserId) {
            try { await fetch(`${baseUrl}/users/${api4comUserId}`, { method: 'DELETE', headers }); } catch {}
          }
          throw new Error('Não foi possível encontrar um número de ramal disponível após várias tentativas.');
        }

        const ramal = apiResult?.ramal || apiResult?.extension || finalRamalNumber;
        const senha = apiResult?.senha || apiResult?.password || randomSenha;
        const api4comId = apiResult?.id ? String(apiResult.id) : null;

        if (!ramal) {
          throw new Error('Api4Com não retornou número de ramal. Resposta: ' + JSON.stringify(apiResult));
        }

        // Auto-populate sip_domain from response
        const sipDomainFromResponse = apiResult?.domain;
        if (sipDomainFromResponse && !config.sip_domain) {
          await supabase.from('phone_config')
            .update({ sip_domain: sipDomainFromResponse })
            .eq('id', config.id);
        }

        // ---- STEP 3: Verify extension was actually created ----
        try {
          const verifyList = await api4comRequest(baseUrl, '/extensions', headers);
          const vList = Array.isArray(verifyList) ? verifyList : (verifyList?.data || verifyList?.extensions || []);
          const found = vList.find((e: any) => String(e.id) === api4comId || String(e.ramal) === String(ramal));
          if (!found) {
            console.warn('Extension not found in verification list, but API returned success. Proceeding.');
          } else {
            console.log('Extension verified in Api4Com:', found.ramal, found.id);
          }
        } catch (verifyErr) {
          console.warn('Verification check failed (non-critical):', verifyErr);
        }

        // ---- STEP 4: Persist in DB — extension_number = api4com_ramal (no divergence) ----
        const { error: dbError } = await supabase
          .from('phone_extensions')
          .insert({
            cod_agent: codAgent,
            extension_number: ramal, // Same as api4com_ramal — no ambiguity
            label: label || fName || null,
            assigned_member_id: assignedMemberId || null,
            api4com_id: api4comId,
            api4com_ramal: ramal,
            api4com_password: senha,
            api4com_email: emailToUse,
            api4com_first_name: fName,
            api4com_last_name: lName,
            api4com_raw: {
              extension: apiResult || {},
              user_id: api4comUserId,
            },
            is_active: true,
          });

        // Rollback on DB failure
        if (dbError) {
          console.error('DB insert failed, rolling back Api4Com:', dbError);
          if (api4comId) {
            try { await fetch(`${baseUrl}/extensions/${api4comId}`, { method: 'DELETE', headers }); } catch (e) { console.error('Rollback ext:', e); }
          }
          if (api4comUserId) {
            try { await fetch(`${baseUrl}/users/${api4comUserId}`, { method: 'DELETE', headers }); } catch (e) { console.error('Rollback user:', e); }
          }
          throw new Error(`Erro ao salvar ramal no banco: ${dbError.message}`);
        }

        result = { ramal, senha, id: api4comId, userId: api4comUserId };
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
        
        // 1. Buscar registro no banco para obter api4com_raw.user_id
        const { data: extRecord } = await supabase
          .from('phone_extensions')
          .select('id, api4com_id, api4com_raw')
          .eq('api4com_id', extensionId)
          .eq('cod_agent', codAgent)
          .maybeSingle();

        const deleteResults: Record<string, unknown> = {};

        // 2. Deletar extensão na Api4Com
        try {
          const extResponse = await fetch(`${baseUrl}/extensions/${extensionId}`, {
            method: 'DELETE',
            headers,
          });
          deleteResults.extension = { success: extResponse.ok, status: extResponse.status };
          if (!extResponse.ok) {
            const errText = await extResponse.text();
            console.log('Failed to delete extension from Api4Com:', errText);
            // 404 = already gone, continue; otherwise fail
            if (extResponse.status !== 404) {
              throw new Error(`Erro ao deletar ramal na Api4Com: ${errText}`);
            }
          }
        } catch (e: any) {
          if (e.message?.includes('Erro ao deletar ramal')) throw e;
          console.log('Extension delete network error:', e.message);
        }

        // 3. Deletar usuário organizacional na Api4Com (se existir)
        const api4comUserId = extRecord?.api4com_raw?.user_id || extRecord?.api4com_raw?.userId;
        if (api4comUserId) {
          try {
            const userResponse = await fetch(`${baseUrl}/users/${api4comUserId}`, {
              method: 'DELETE',
              headers,
            });
            deleteResults.user = { success: userResponse.ok, status: userResponse.status };
            if (!userResponse.ok && userResponse.status !== 404) {
              console.log('Failed to delete user from Api4Com:', await userResponse.text());
            }
          } catch (e: any) {
            console.log('User delete error (non-blocking):', e.message);
            deleteResults.user = { success: false, error: e.message };
          }
        }

        // 4. Deletar do banco
        if (extRecord?.id) {
          const { error: dbError } = await supabase
            .from('phone_extensions')
            .delete()
            .eq('id', extRecord.id);
          if (dbError) throw new Error(`Erro ao deletar do banco: ${dbError.message}`);
          deleteResults.database = { success: true };
        } else {
          // Fallback: tentar deletar por api4com_id
          const { error: dbError } = await supabase
            .from('phone_extensions')
            .delete()
            .eq('api4com_id', extensionId)
            .eq('cod_agent', codAgent);
          if (dbError) throw new Error(`Erro ao deletar do banco: ${dbError.message}`);
          deleteResults.database = { success: true };
        }

        result = deleteResults;
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

      case 'sync_call_history': {
        const { callId, since } = params;
        let totalSynced = 0;
        let totalRecords = 0;
        const syncErrors: string[] = [];
        let notFound = false;

        // Helper: append -03:00 (Brasília) to naive timestamps
        const fixTz = (ts: string | null | undefined): string | null => {
          if (!ts) return null;
          const s = String(ts).trim();
          if (/[+-]\d{2}:\d{2}$/.test(s) || s.endsWith('Z')) return s;
          return `${s}-03:00`;
        };

        try {
          // MODE 1: Sync specific call_id — upsert (insert if not exists, update if exists)
          if (callId) {
            let found = false;
            let page = 1;
            const maxPages = 3;

            while (!found && page <= maxPages) {
              const callsData = await api4comRequest(baseUrl, `/calls?page=${page}`, headers);
              const records = Array.isArray(callsData) ? callsData : (callsData?.data || []);
              if (records.length === 0) break;
              totalRecords += records.length;

              for (const cdr of records) {
                const cdrId = cdr.id ? String(cdr.id) : null;
                if (cdrId !== String(callId)) continue;

                found = true;
                const direction = cdr.call_type || 'outbound';
                const caller = cdr.from || '';
                const called = cdr.to || '';
                const attendantName = [cdr.first_name, cdr.last_name].filter(Boolean).join(' ').trim() || null;
                const minutePrice = cdr.minute_price != null ? Number(cdr.minute_price) : null;
                const callPrice = cdr.call_price != null ? Number(cdr.call_price) : null;

                const cdrMetadata: Record<string, any> = {};
                if (cdr.BINA) cdrMetadata.bina = cdr.BINA;
                if (cdr.email) cdrMetadata.email = cdr.email;
                if (attendantName) cdrMetadata.attendant_name = attendantName;
                if (minutePrice != null) cdrMetadata.minute_price = minutePrice;
                if (cdr.metadata) {
                  cdrMetadata.api4com_metadata = cdr.metadata;
                  if (cdr.metadata.origin) cdrMetadata.origin = cdr.metadata.origin;
                  if (cdr.metadata.whatsapp_number) cdrMetadata.whatsapp_number = cdr.metadata.whatsapp_number;
                }
                if (cdr.domain) cdrMetadata.domain = cdr.domain;

                const logEntry = {
                  call_id: String(callId),
                  cod_agent: codAgent,
                  extension_number: caller,
                  direction, caller, called,
                  started_at: fixTz(cdr.started_at),
                  ended_at: fixTz(cdr.ended_at),
                  answered_at: fixTz(cdr.answer_stamp || cdr.answeredAt),
                  duration_seconds: Number(cdr.duration ?? 0),
                  record_url: cdr.record_url || null,
                  cost: callPrice ?? 0,
                  hangup_cause: cdr.hangup_cause || null,
                  status: 'hangup',
                  metadata: cdrMetadata,
                };

                // Upsert using UNIQUE constraint on call_id
                const { error: upsertErr } = await supabase
                  .from('phone_call_logs')
                  .upsert(logEntry, { onConflict: 'call_id' });

                if (upsertErr) {
                  console.error('Upsert error for callId', callId, upsertErr);
                }
                totalSynced = 1;
                break;
              }

              const meta = callsData?.meta;
              if (meta?.currentPage && meta?.totalPageCount && meta.currentPage < meta.totalPageCount) {
                page++;
              } else {
                break;
              }
            }

            if (!found) notFound = true;
          } else {
            // MODE 2: Incremental sync by date
            let sinceDate = since;
            if (!sinceDate) {
              const { data: lastLog } = await supabase
                .from('phone_call_logs')
                .select('started_at')
                .eq('cod_agent', codAgent)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              sinceDate = lastLog?.started_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            }

            let page = 1;
            let hasMore = true;
            const maxPages = 5;

            while (hasMore && page <= maxPages) {
              const callsData = await api4comRequest(baseUrl, `/calls?page=${page}`, headers);
              const records = Array.isArray(callsData) ? callsData : (callsData?.data || []);
              if (records.length === 0) break;
              totalRecords += records.length;

              for (const cdr of records) {
                const cdrId = cdr.id ? String(cdr.id) : null;
                const cdrStarted = cdr.started_at;
                if (sinceDate && cdrStarted && new Date(cdrStarted) < new Date(sinceDate)) {
                  hasMore = false;
                  continue;
                }

                const direction = cdr.call_type || 'outbound';
                const caller = cdr.from || '';
                const called = cdr.to || '';
                const attendantName = [cdr.first_name, cdr.last_name].filter(Boolean).join(' ').trim() || null;
                const minutePrice = cdr.minute_price != null ? Number(cdr.minute_price) : null;
                const callPrice = cdr.call_price != null ? Number(cdr.call_price) : null;

                const cdrMetadata: Record<string, any> = {};
                if (cdr.BINA) cdrMetadata.bina = cdr.BINA;
                if (cdr.email) cdrMetadata.email = cdr.email;
                if (attendantName) cdrMetadata.attendant_name = attendantName;
                if (minutePrice != null) cdrMetadata.minute_price = minutePrice;
                if (cdr.metadata) cdrMetadata.api4com_metadata = cdr.metadata;
                if (cdr.domain) cdrMetadata.domain = cdr.domain;

                const logEntry: any = {
                  cod_agent: codAgent,
                  extension_number: caller,
                  direction, caller, called,
                  started_at: fixTz(cdrStarted),
                  ended_at: fixTz(cdr.ended_at),
                  answered_at: fixTz(cdr.answer_stamp || cdr.answeredAt),
                  duration_seconds: Number(cdr.duration ?? 0),
                  record_url: cdr.record_url || null,
                  cost: callPrice ?? 0,
                  hangup_cause: cdr.hangup_cause || null,
                  status: 'hangup',
                  metadata: cdrMetadata,
                };

                if (cdrId) {
                  logEntry.call_id = cdrId;
                  // Upsert using UNIQUE constraint
                  const { error: upsertErr } = await supabase
                    .from('phone_call_logs')
                    .upsert(logEntry, { onConflict: 'call_id' });
                  if (upsertErr) console.error('Upsert error:', upsertErr);
                } else {
                  const { data: dup } = await supabase
                    .from('phone_call_logs').select('id')
                    .eq('cod_agent', codAgent).eq('extension_number', caller)
                    .eq('called', called || '').eq('started_at', fixTz(cdrStarted) || '')
                    .maybeSingle();
                  if (!dup) await supabase.from('phone_call_logs').insert(logEntry);
                }
                totalSynced++;
              }

              const meta = callsData?.meta;
              if (meta?.currentPage && meta?.totalPageCount && meta.currentPage < meta.totalPageCount) {
                page++;
              } else if (records.length >= 10) {
                page++;
              } else {
                hasMore = false;
              }
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
    console.error('api4com-proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
