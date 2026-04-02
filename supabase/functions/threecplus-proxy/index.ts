import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: makes authenticated request to 3C+ API
async function threecRequest(
  baseUrl: string,
  token: string,
  path: string,
  options: { method?: string; body?: any } = {},
) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}${path}${separator}api_token=${token}`;
  const headers: Record<string, string> = { "Accept": "application/json" };
  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
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

function getThreecErrorStatus(error: unknown): number | null {
  const message = String((error as any)?.message || error || "");
  const match = message.match(/3C\+ erro\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function isRecoverableDeleteStatus(status: number | null): boolean {
  return status === 400 || status === 403 || status === 404 || status === 405;
}

// Helper: extract agent's own api_token from threecplus_raw or fetch fresh
async function getAgentToken(
  supabase: any,
  extensionId: number | string,
  codAgent: string,
  baseUrl: string,
  managerToken: string,
): Promise<string | null> {
  const { data: extFull } = await supabase
    .from("phone_extensions")
    .select("threecplus_raw, threecplus_agent_id")
    .eq("id", extensionId)
    .eq("cod_agent", codAgent)
    .single();

  if (!extFull) return null;

  const rawData = (extFull.threecplus_raw as any)?.data ?? extFull.threecplus_raw;
  let agentApiToken = rawData?.api_token;

  // If no cached token, fetch fresh from API using manager token
  if (!agentApiToken && extFull.threecplus_agent_id) {
    try {
      const freshUser = await threecRequest(baseUrl, managerToken, `/users/${extFull.threecplus_agent_id}`);
      const freshData = freshUser?.data ?? freshUser;
      agentApiToken = freshData?.api_token;

      if (agentApiToken) {
        // Update raw cache with fresh data
        await supabase.from("phone_extensions").update({
          threecplus_raw: freshUser,
        }).eq("id", extensionId);
      }
    } catch (e) {
      console.warn("Failed to fetch fresh agent token:", e);
    }
  }

  return agentApiToken || null;
}

// Helper: ensure webphone is enabled for the agent
async function ensureWebphoneEnabled(
  supabase: any,
  baseUrl: string,
  managerToken: string,
  agentToken: string,
  agentId: string,
  extensionId: number | string,
  codAgent: string,
): Promise<void> {
  try {
    // Check current status
    const userData = await threecRequest(baseUrl, managerToken, `/users/${agentId}`);
    const u = userData?.data ?? userData;
    
    if (u?.webphone === true) {
      console.log(`Webphone already enabled for agent ${agentId}`);
      return;
    }

    console.log(`Enabling webphone for agent ${agentId}...`);
    
    // Try with manager token first
    try {
      await threecRequest(baseUrl, managerToken, `/users/${agentId}`, {
        method: "PUT",
        body: {
          name: u?.name || "Agente",
          email: u?.email || `agente_${Date.now()}@atendejulia.com.br`,
          role: u?.role?.name || u?.role || "agent",
          timezone: u?.settings?.timezone || "America/Sao_Paulo",
          extension_number: u?.extension?.extension_number,
          webphone: true,
        },
      });
      console.log(`Webphone enabled via manager token for agent ${agentId}`);
    } catch (e: any) {
      console.warn(`Manager token failed to enable webphone: ${e.message}`);
      // Try with agent token as fallback
      try {
        await threecRequest(baseUrl, agentToken, `/users/${agentId}`, {
          method: "PUT",
          body: {
            name: u?.name || "Agente",
            email: u?.email || `agente_${Date.now()}@atendejulia.com.br`,
            role: u?.role?.name || u?.role || "agent",
            timezone: u?.settings?.timezone || "America/Sao_Paulo",
            extension_number: u?.extension?.extension_number,
            webphone: true,
          },
        });
        console.log(`Webphone enabled via agent token for agent ${agentId}`);
      } catch (e2: any) {
        console.warn(`Agent token also failed to enable webphone: ${e2.message}`);
      }
    }
  } catch (e: any) {
    console.warn(`ensureWebphoneEnabled error: ${e.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, codAgent, ...params } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get 3C+ config — try agent-specific first, then fallback to global
    let { data: config } = await supabase
      .from("phone_config")
      .select("*")
      .eq("cod_agent", codAgent)
      .eq("is_active", true)
      .eq("provider", "3cplus")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config) {
      const { data: globalConfig } = await supabase
        .from("phone_config")
        .select("*")
        .eq("is_active", true)
        .eq("provider", "3cplus")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      config = globalConfig;
    }

    if (!config) {
      throw new Error(
        "Configuração 3C+ não encontrada. Configure o provedor de telefonia.",
      );
    }

    if (!config.threecplus_token) {
      throw new Error("Token da API 3C+ não configurado.");
    }

    const baseUrl = config.threecplus_base_url ||
      "https://app.3c.fluxoti.com/api/v1";
    const token = config.threecplus_token;

    let result: any;

    switch (action) {
      // ------------------------------------------------------------------
      // get_sip_credentials — login agente no webphone 3C+
      // POST /agent/webphone/login  → { domain, username, password, port }
      // ------------------------------------------------------------------
      case "get_sip_credentials": {
        const { extensionId } = params;

        // Fetch extension record from DB
        const { data: ext } = await supabase
          .from("phone_extensions")
          .select(
            "threecplus_agent_id, threecplus_sip_username, threecplus_sip_password, threecplus_sip_domain, threecplus_extension",
          )
          .eq("id", extensionId)
          .eq("cod_agent", codAgent)
          .single();

        if (!ext) throw new Error("Ramal não encontrado.");

        // Helper: resolve wsUrl from config or derive from domain
        const resolveWsUrl = (domain: string): { wsUrl: string; wsUrlSource: string } => {
          if (config.threecplus_ws_url) {
            return { wsUrl: config.threecplus_ws_url, wsUrlSource: 'phone_config.threecplus_ws_url' };
          }
          return { wsUrl: `wss://${domain}:8089/ws`, wsUrlSource: `derivado do domínio SIP: ${domain}` };
        };

        // If we already have cached SIP credentials, return them
        // Prefer extension cached domain, config.sip_domain only as override
        if (
          ext.threecplus_sip_username && ext.threecplus_sip_password &&
          ext.threecplus_sip_domain
        ) {
          let preferredDomain = ext.threecplus_sip_domain;
          let domainSource = 'phone_extensions.threecplus_sip_domain (cache)';
          if (config.sip_domain) {
            preferredDomain = config.sip_domain;
            domainSource = 'phone_config.sip_domain (override manual)';
          }
          const ws = resolveWsUrl(preferredDomain);
          result = {
            domain: preferredDomain,
            domainSource,
            username: ext.threecplus_sip_username,
            password: ext.threecplus_sip_password,
            wsUrl: ws.wsUrl,
            wsUrlSource: ws.wsUrlSource,
            configSipDomain: config.sip_domain || null,
            extensionSipDomain: ext.threecplus_sip_domain || null,
            baseUrl: baseUrl,
          };
          break;
        }

        // Try to extract SIP credentials from threecplus_raw (saved during creation)
        // The raw data contains extension_password and telephony_id
        const { data: extFull } = await supabase
          .from("phone_extensions")
          .select("threecplus_raw")
          .eq("id", extensionId)
          .eq("cod_agent", codAgent)
          .single();

        const rawData = (extFull?.threecplus_raw as any)?.data ||
          extFull?.threecplus_raw;
        if (rawData?.telephony_id && rawData?.extension_password) {
          // Use credentials from raw creation response
          // Priority: 1) config.sip_domain (manual override), 2) derive from base_url hostname, 3) hardcoded fallback
          let sipDomainFromRaw: string;
          let rawDomainSource: string;
          if (config.sip_domain) {
            sipDomainFromRaw = config.sip_domain;
            rawDomainSource = "phone_config.sip_domain (override manual)";
          } else {
            // Derive from tenant base_url: https://assessoria.3c.fluxoti.com/api/v1 → assessoria.3c.fluxoti.com
            try {
              sipDomainFromRaw = new URL(baseUrl).hostname;
              rawDomainSource = `derivado de threecplus_base_url (${baseUrl})`;
            } catch {
              sipDomainFromRaw = "pbx01.3c.fluxoti.com";
              rawDomainSource = "fallback padrão (pbx01.3c.fluxoti.com)";
            }
          }
          const sipUsernameFromRaw = rawData.telephony_id;
          const sipPasswordFromRaw = rawData.extension_password;

          // Cache for future use
          await supabase.from("phone_extensions").update({
            threecplus_sip_domain: sipDomainFromRaw,
            threecplus_sip_username: sipUsernameFromRaw,
            threecplus_sip_password: sipPasswordFromRaw,
          }).eq("id", extensionId);

          const ws = resolveWsUrl(sipDomainFromRaw);
          result = {
            domain: sipDomainFromRaw,
            domainSource: rawDomainSource,
            username: sipUsernameFromRaw,
            password: sipPasswordFromRaw,
            wsUrl: ws.wsUrl,
            wsUrlSource: ws.wsUrlSource,
            baseUrl,
          };
          break;
        }

        // Fallback: call 3C+ webphone login to obtain fresh SIP credentials
        if (!ext.threecplus_agent_id) {
          throw new Error("ID do agente 3C+ não configurado neste ramal.");
        }

        // Use agent's own api_token for /agent/* endpoints (manager token returns 403)
        const agentToken = await getAgentToken(supabase, extensionId, codAgent, baseUrl, token);
        if (!agentToken) {
          throw new Error("Token do agente 3C+ não encontrado. Recrie o ramal ou atualize os dados.");
        }

        // First ensure webphone is enabled
        await ensureWebphoneEnabled(supabase, baseUrl, token, agentToken, ext.threecplus_agent_id, extensionId, codAgent);

        const loginResp = await threecRequest(
          baseUrl,
          agentToken,
          "/agent/webphone/login",
          {
            method: "POST",
            body: {},
          },
        );

        // 3C+ returns: { sip_server, sip_user, sip_password, ... }
        const sipDomain = loginResp.sip_server || loginResp.domain ||
          loginResp.host;
        const sipUsername = loginResp.sip_user || loginResp.username ||
          loginResp.extension;
        const sipPassword = loginResp.sip_password || loginResp.password;

        if (!sipDomain || !sipUsername || !sipPassword) {
          throw new Error(
            "3C+ não retornou credenciais SIP válidas: " +
              JSON.stringify(loginResp),
          );
        }

        // Cache credentials in DB
        await supabase.from("phone_extensions").update({
          threecplus_sip_domain: sipDomain,
          threecplus_sip_username: sipUsername,
          threecplus_sip_password: sipPassword,
        }).eq("id", extensionId);

        const ws = resolveWsUrl(sipDomain);
        result = {
          domain: sipDomain,
          domainSource: "3C+ webphone login (sip_server)",
          username: sipUsername,
          password: sipPassword,
          wsUrl: ws.wsUrl,
          wsUrlSource: ws.wsUrlSource,
          baseUrl,
        };
        break;
      }

      // ------------------------------------------------------------------
      // dial — realiza chamada click-to-call
      // POST /click2call
      // ------------------------------------------------------------------
      case "dial": {
        const { extensionId, phone, metadata } = params;

        // Resolve extension record
        let agentId: string | null = null;
        let extension: string | null = null;

        if (extensionId) {
          const { data: ext } = await supabase
            .from("phone_extensions")
            .select("threecplus_agent_id, threecplus_extension")
            .eq("id", extensionId)
            .eq("cod_agent", codAgent)
            .single();

          if (!ext?.threecplus_agent_id && !ext?.threecplus_extension) {
            throw new Error(
              "Ramal sem vínculo 3C+. Sincronize ou recrie o ramal.",
            );
          }
          agentId = ext.threecplus_agent_id || null;
          extension = ext.threecplus_extension || null;
        }

        const dialBody: Record<string, any> = {
          phone_number: phone,
          ...(agentId ? { agent_id: agentId } : {}),
          ...(extension ? { extension } : {}),
          metadata: {
            ...(metadata || {}),
            gateway: "atende-julia",
            cod_agent: codAgent,
          },
        };

        result = await threecRequest(baseUrl, token, "/click2call", {
          method: "POST",
          body: dialBody,
        });
        break;
      }

      // ------------------------------------------------------------------
      // hangup — desliga chamada ativa
      // POST /agent/call/{callId}/hangup
      // ------------------------------------------------------------------
      case "hangup": {
        const { callId } = params;
        result = await threecRequest(
          baseUrl,
          token,
          `/agent/call/${callId}/hangup`,
          {
            method: "POST",
            body: {},
          },
        );
        break;
      }

      // ------------------------------------------------------------------
      // list_extensions — lista agentes no 3C+
      // GET /agents
      // ------------------------------------------------------------------
      case "list_extensions": {
        result = await threecRequest(baseUrl, token, "/agents");
        break;
      }

      // ------------------------------------------------------------------
      // create_extension — cria agente no 3C+ e persiste no DB
      // POST /agents
      // ------------------------------------------------------------------
      case "create_extension": {
        const createPayload =
          (params?.params && typeof params.params === "object")
            ? params.params
            : params;
        const { firstName, lastName, email, assignedMemberId, label } =
          createPayload;
        let extensionNumber = String(
          createPayload.extensionNumber ??
            createPayload.extension_number ??
            createPayload.extension ??
            createPayload.number ??
            createPayload.ramal ??
            "",
        ).trim();

        // Validate uniqueness
        if (assignedMemberId) {
          const { data: existingMember } = await supabase
            .from("phone_extensions")
            .select("id")
            .eq("cod_agent", codAgent)
            .eq("assigned_member_id", assignedMemberId)
            .maybeSingle();
          if (existingMember) {
            throw new Error("Este membro já possui um ramal vinculado.");
          }
        }

        const fName = firstName || "Agente";
        const lName = lastName || String(codAgent);
        const emailToUse = email || `agente_${Date.now()}@atendejulia.com.br`;

        // Generate strong random password (12+ chars, uppercase, number, special)
        const upper = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => String.fromCharCode(65 + (b % 26))).join("");
        const lower = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => String.fromCharCode(97 + (b % 26))).join("");
        const nums = Array.from(crypto.getRandomValues(new Uint8Array(2)))
          .map((b) => String(b % 10)).join("");
        const specials = ["@", "#", "$", "!", "%"];
        const spec1 = specials[
          crypto.getRandomValues(new Uint8Array(1))[0] % specials.length
        ];
        const spec2 = specials[
          crypto.getRandomValues(new Uint8Array(1))[0] % specials.length
        ];
        const randomPass = `${upper}${lower}${nums}${spec1}${spec2}`;

        const usedExtensions = new Set<number>();

        // Collect used extension numbers from local DB
        const { data: existingExts, error: extError } = await supabase
          .from("phone_extensions")
          .select("extension_number")
          .eq("cod_agent", codAgent)
          .eq("provider", "3cplus");

        if (extError) {
          throw new Error(
            `Erro ao consultar ramais existentes: ${extError.message}`,
          );
        }

        for (const row of (existingExts || [])) {
          const n = Number.parseInt(String((row as any).extension_number), 10);
          if (Number.isFinite(n) && n > 0) usedExtensions.add(n);
        }

        // Also collect used extension numbers from 3C+ itself (source of truth)
        try {
          const remoteAgents = await threecRequest(baseUrl, token, "/agents");
          const agentList: any[] = Array.isArray(remoteAgents)
            ? remoteAgents
            : (remoteAgents?.data || remoteAgents?.agents || []);

          for (const agent of agentList) {
            const n = Number.parseInt(String(agent?.extension), 10);
            if (Number.isFinite(n) && n > 0) usedExtensions.add(n);
          }
        } catch (e) {
          console.warn(
            "3C+ create_extension: falha ao consultar /agents para detectar ramais ocupados",
            e,
          );
        }

        if (!extensionNumber) {
          let candidate = 1000;
          while (usedExtensions.has(candidate)) candidate++;
          extensionNumber = String(candidate);
          console.log(
            `3C+ create_extension: ramal ausente no payload, usando ${extensionNumber}`,
          );
        }

        // Create user in 3C+ (endpoint is /users, not /agents)
        let currentExtension = extensionNumber;
        let currentEmail = emailToUse;
        let apiResult: any = null;

        const makeUniqueEmail = (
          baseEmail: string,
          attempt: number,
        ): string => {
          if (attempt <= 0) return baseEmail;
          const [localPart, domainPart] = baseEmail.includes("@")
            ? baseEmail.split("@")
            : [baseEmail, "atendejulia.com.br"];
          return `${localPart}+${Date.now()}${attempt}@${
            domainPart || "atendejulia.com.br"
          }`;
        };

        for (let attempt = 0; attempt < 20; attempt++) {
          const userBody: Record<string, any> = {
            name: `${fName} ${lName}`.trim(),
            email: currentEmail,
            password: randomPass,
            role: "agent",
            timezone: "America/Sao_Paulo",
            extension_number: String(currentExtension),
          };

          try {
            apiResult = await threecRequest(baseUrl, token, "/users", {
              method: "POST",
              body: userBody,
            });
            break;
          } catch (e: any) {
            const msg = String(e?.message || "");
            const emailInUse = msg.includes("e-mail já está sendo utilizado");
            const extensionInUse =
              msg.includes("Ramal já se encontra utilizado") ||
              msg.includes("campo Ramal já se encontra utilizado") ||
              msg.includes("extension_number");

            const isLastAttempt = attempt === 19;
            if (isLastAttempt || (!emailInUse && !extensionInUse)) {
              throw e;
            }

            if (emailInUse) {
              currentEmail = makeUniqueEmail(emailToUse, attempt + 1);
            }

            if (extensionInUse) {
              const current = Number.parseInt(String(currentExtension), 10);
              let next = Number.isFinite(current) && current > 0
                ? current + 1
                : 1000;
              while (usedExtensions.has(next)) next++;
              usedExtensions.add(next);
              currentExtension = String(next);
            }

            console.warn(
              `3C+ create_extension retry #${
                attempt + 1
              }: email=${currentEmail}, extension=${currentExtension}`,
            );
          }
        }

        const apiUser = apiResult?.data ?? apiResult;
        const agentId = apiUser?.id ? String(apiUser.id) : null;
        const apiExtension = apiUser?.extension?.extension_number ??
          apiUser?.extension_number ?? apiUser?.extension;
        const ext = apiExtension !== undefined && apiExtension !== null
          ? String(apiExtension)
          : (currentExtension || null);

        if (!agentId) {
          throw new Error(
            "3C+ não retornou ID do agente. Resposta: " +
              JSON.stringify(apiResult),
          );
        }

        // Enable webphone for this user
        try {
          // Fetch current user data to build full PUT payload
          const userData = await threecRequest(
            baseUrl,
            token,
            `/users/${agentId}`,
          );
          const u = userData?.data ?? userData;
          await threecRequest(baseUrl, token, `/users/${agentId}`, {
            method: "PUT",
            body: {
              name: u?.name || `${fName} ${lName}`.trim(),
              email: u?.email || currentEmail,
              role: u?.role?.name || u?.role || "agent",
              timezone: u?.settings?.timezone || "America/Sao_Paulo",
              extension_number: u?.extension?.extension_number ?? ext ??
                currentExtension,
              webphone: true,
            },
          });
          console.log(`3C+ webphone habilitado para user ${agentId}`);
        } catch (wpErr: any) {
          console.warn(
            `3C+ falha ao habilitar webphone para user ${agentId}:`,
            wpErr?.message,
          );
        }

        // Persist in DB
        const { error: dbError } = await supabase.from("phone_extensions")
          .insert({
            cod_agent: codAgent,
            extension_number: ext || agentId,
            label: label || fName || null,
            assigned_member_id: assignedMemberId || null,
            provider: "3cplus",
            threecplus_agent_id: agentId,
            threecplus_extension: ext,
            threecplus_raw: apiResult,
            is_active: true,
          });

        if (dbError) {
          // Best-effort rollback: delete user from 3C+
          try {
            await threecRequest(baseUrl, token, `/users/${agentId}`, {
              method: "DELETE",
            });
          } catch {}
          throw new Error(`Erro ao salvar ramal no banco: ${dbError.message}`);
        }

        result = {
          agentId,
          extension: ext,
          webphoneEnabled: true,
          raw: apiResult,
        };
        break;
      }

      // ------------------------------------------------------------------
      // get_extension_url — returns the official 3C+ webphone URL for the agent
      // Uses the agent's own api_token (not the manager token)
      // ------------------------------------------------------------------
      case "get_extension_url": {
        const { extensionId: extUrlId } = params;

        const { data: extUrl } = await supabase
          .from("phone_extensions")
          .select("threecplus_agent_id, threecplus_raw")
          .eq("id", extUrlId)
          .eq("cod_agent", codAgent)
          .single();

        if (!extUrl?.threecplus_agent_id) {
          throw new Error("Ramal sem vínculo 3C+.");
        }

        // Extract agent's own api_token from raw data
        const rawAgent = (extUrl.threecplus_raw as any)?.data ?? extUrl.threecplus_raw;
        let agentApiToken = rawAgent?.api_token;

        // If no cached token, fetch fresh from API
        if (!agentApiToken) {
          const freshUser = await threecRequest(baseUrl, token, `/users/${extUrl.threecplus_agent_id}`);
          const freshData = freshUser?.data ?? freshUser;
          agentApiToken = freshData?.api_token;

          if (agentApiToken) {
            // Update raw cache
            await supabase.from("phone_extensions").update({
              threecplus_raw: freshUser,
            }).eq("id", extUrlId);
          }
        }

        if (!agentApiToken) {
          throw new Error("Token do agente 3C+ não encontrado. Recrie o ramal.");
        }

        // Build the official extension URL from the base URL tenant domain
        // baseUrl is like "https://assessoria.3c.fluxoti.com/api/v1"
        // Extension URL is "https://assessoria.3c.fluxoti.com/extension?api_token=..."
        const tenantOrigin = baseUrl.replace(/\/api\/v\d+\/?$/, "");
        const extensionUrl = `${tenantOrigin}/extension?api_token=${agentApiToken}`;

        result = {
          extensionUrl,
          agentId: extUrl.threecplus_agent_id,
        };
        break;
      }

      // ------------------------------------------------------------------
      // enable_webphone — habilita webphone para um usuário 3C+ existente
      // PATCH /users/{id} { webphone: true }
      // ------------------------------------------------------------------
      case "enable_webphone": {
        const { extensionId } = params;

        const { data: ext } = await supabase
          .from("phone_extensions")
          .select(
            "threecplus_agent_id, threecplus_extension, extension_number, threecplus_raw",
          )
          .eq("id", extensionId)
          .eq("cod_agent", codAgent)
          .single();

        if (!ext?.threecplus_agent_id) {
          throw new Error(
            "Ramal sem vínculo 3C+ (threecplus_agent_id ausente).",
          );
        }

        const userId = ext.threecplus_agent_id;

        // Fetch current user data for full PUT payload
        const userData = await threecRequest(
          baseUrl,
          token,
          `/users/${userId}`,
        );
        const u = userData?.data ?? userData;

        const putResult = await threecRequest(
          baseUrl,
          token,
          `/users/${userId}`,
          {
            method: "PUT",
            body: {
              name: u?.name || "Agente",
              email: u?.email || `agente_${Date.now()}@atendejulia.com.br`,
              role: u?.role?.name || u?.role || "agent",
              timezone: u?.settings?.timezone || "America/Sao_Paulo",
              extension_number: u?.extension?.extension_number ??
                ext.threecplus_extension ?? ext.extension_number,
              webphone: true,
            },
          },
        );

        result = { userId, webphoneEnabled: true, raw: putResult };
        break;
      }

      // ------------------------------------------------------------------
      // delete_extension — remove usuário/ramal do 3C+ e do DB
      // Prefer /users/{id} com threecplus_extension e fallback para /agents/{id}
      // ------------------------------------------------------------------
      case "delete_extension": {
        const { extensionId } = params;
        const incomingId = String(extensionId || "").trim();

        // Fetch DB record
        const { data: extRecord } = await supabase
          .from("phone_extensions")
          .select(
            "id, threecplus_agent_id, threecplus_extension, extension_number, threecplus_raw",
          )
          .or(
            `threecplus_agent_id.eq.${incomingId},threecplus_extension.eq.${incomingId},extension_number.eq.${incomingId}`,
          )
          .eq("cod_agent", codAgent)
          .maybeSingle();

        const deleteResults: Record<string, unknown> = {};

        const rawData = (extRecord?.threecplus_raw as any)?.data ||
          extRecord?.threecplus_raw || {};
        const userCandidates = Array.from(
          new Set(
            [
              rawData?.id,
              extRecord?.threecplus_agent_id,
              extRecord?.threecplus_extension,
              extRecord?.extension_number,
              incomingId,
            ].filter(Boolean).map((v) => String(v).trim()),
          ),
        );

        const agentCandidates = Array.from(
          new Set(
            [
              extRecord?.threecplus_agent_id,
              rawData?.agent_id,
              rawData?.id,
              incomingId,
            ].filter(Boolean).map((v) => String(v).trim()),
          ),
        );

        let remoteDeleted = false;
        let lastHardError: Error | null = null;

        for (const userId of userCandidates) {
          try {
            await threecRequest(baseUrl, token, `/users/${userId}`, {
              method: "DELETE",
            });
            deleteResults.provider = {
              success: true,
              endpoint: "users",
              id: userId,
            };
            remoteDeleted = true;
            break;
          } catch (error) {
            const status = getThreecErrorStatus(error);
            if (isRecoverableDeleteStatus(status)) continue;
            lastHardError = error as Error;
            break;
          }
        }

        if (!remoteDeleted && !lastHardError) {
          for (const agentId of agentCandidates) {
            try {
              await threecRequest(baseUrl, token, `/agents/${agentId}`, {
                method: "DELETE",
              });
              deleteResults.provider = {
                success: true,
                endpoint: "agents",
                id: agentId,
              };
              remoteDeleted = true;
              break;
            } catch (error) {
              const status = getThreecErrorStatus(error);
              if (isRecoverableDeleteStatus(status)) continue;
              lastHardError = error as Error;
              break;
            }
          }
        }

        if (lastHardError) throw lastHardError;
        if (!remoteDeleted) {
          deleteResults.provider = {
            success: true,
            note: "resource_not_found_or_incompatible_id",
            triedUsers: userCandidates,
            triedAgents: agentCandidates,
          };
        }

        // Delete from DB
        if (extRecord?.id) {
          const { error: dbError } = await supabase
            .from("phone_extensions").delete().eq("id", extRecord.id);
          if (dbError) {
            throw new Error(`Erro ao deletar do banco: ${dbError.message}`);
          }
        } else {
          await supabase.from("phone_extensions").delete()
            .or(
              `threecplus_agent_id.eq.${incomingId},threecplus_extension.eq.${incomingId},extension_number.eq.${incomingId}`,
            )
            .eq("cod_agent", codAgent);
        }
        deleteResults.database = { success: true };
        result = deleteResults;
        break;
      }

      // ------------------------------------------------------------------
      // sync_extensions — sincroniza agentes do 3C+ com o DB local
      // GET /agents
      // ------------------------------------------------------------------
      case "sync_extensions": {
        const agentsData = await threecRequest(baseUrl, token, "/agents");
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
            .from("phone_extensions").select("id")
            .eq("cod_agent", codAgent).eq("threecplus_agent_id", agentId)
            .maybeSingle();

          if (existing) {
            await supabase.from("phone_extensions").update({
              threecplus_extension: ext,
              threecplus_raw: agent,
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            const { error: insertError } = await supabase.from(
              "phone_extensions",
            ).insert({
              cod_agent: codAgent,
              extension_number: ext || agentId,
              provider: "3cplus",
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
      case "setup_webhook": {
        const webhookUrl = `${
          Deno.env.get("SUPABASE_URL")
        }/functions/v1/threecplus-webhook`;
        result = await threecRequest(baseUrl, token, "/webhooks", {
          method: "POST",
          body: {
            url: webhookUrl,
            events: [
              "call-was-answered",
              "call-was-ended",
              "agent-status-changed",
            ],
            active: true,
          },
        });
        break;
      }

      // ------------------------------------------------------------------
      // get_account — retorna informações da conta 3C+
      // GET /account
      // ------------------------------------------------------------------
      case "get_account": {
        result = await threecRequest(baseUrl, token, "/account");
        break;
      }

      // ------------------------------------------------------------------
      // sync_call_history — sincroniza histórico de chamadas
      // GET /agent/calls (com paginação)
      // ------------------------------------------------------------------
      case "sync_call_history": {
        const { callId, since } = params;
        let totalSynced = 0;
        let totalRecords = 0;
        const syncErrors: string[] = [];
        let notFound = false;

        const fixTz = (ts: string | null | undefined): string | null => {
          if (!ts) return null;
          const s = String(ts).trim();
          if (/[+-]\d{2}:\d{2}$/.test(s) || s.endsWith("Z")) return s;
          return `${s}-03:00`;
        };

        try {
          if (callId) {
            // MODE 1: Sync specific call
            let page = 1;
            let found = false;
            const maxPages = 3;

            while (!found && page <= maxPages) {
              const data = await threecRequest(
                baseUrl,
                token,
                `/agent/calls?page=${page}`,
              );
              const records: any[] = Array.isArray(data)
                ? data
                : (data?.data || []);
              if (records.length === 0) break;
              totalRecords += records.length;

              for (const cdr of records) {
                const cdrId = cdr.id ? String(cdr.id) : null;
                if (cdrId !== String(callId)) continue;
                found = true;

                const logEntry = buildCallLog(cdr, codAgent, fixTz);
                await supabase.from("phone_call_logs")
                  .upsert(logEntry, { onConflict: "call_id" });
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
                .from("phone_call_logs").select("started_at")
                .eq("cod_agent", codAgent)
                .order("started_at", { ascending: false })
                .limit(1).maybeSingle();
              sinceDate = lastLog?.started_at ||
                new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            }

            let page = 1;
            let hasMore = true;
            const maxPages = 5;

            while (hasMore && page <= maxPages) {
              const data = await threecRequest(
                baseUrl,
                token,
                `/agent/calls?page=${page}`,
              );
              const records: any[] = Array.isArray(data)
                ? data
                : (data?.data || []);
              if (records.length === 0) break;
              totalRecords += records.length;

              for (const cdr of records) {
                const cdrStarted = cdr.started_at || cdr.created_at;
                if (
                  sinceDate && cdrStarted &&
                  new Date(cdrStarted) < new Date(sinceDate)
                ) {
                  hasMore = false;
                  continue;
                }

                const logEntry = buildCallLog(cdr, codAgent, fixTz);
                const cdrId = cdr.id ? String(cdr.id) : null;

                if (cdrId) {
                  await supabase.from("phone_call_logs")
                    .upsert(logEntry, { onConflict: "call_id" });
                } else {
                  const { data: dup } = await supabase.from("phone_call_logs")
                    .select("id")
                    .eq("cod_agent", codAgent)
                    .eq("caller", logEntry.caller || "")
                    .eq("started_at", logEntry.started_at || "")
                    .maybeSingle();
                  if (!dup) {
                    await supabase.from("phone_call_logs").insert(logEntry);
                  }
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

        result = {
          synced: totalSynced,
          total: totalRecords,
          errors: syncErrors,
          notFound,
        };
        break;
      }

      case "diagnose_token": {
        const endpoints = [
          { name: "users_list", method: "GET", path: "/users?per_page=1" },
          { name: "agents_list", method: "GET", path: "/agents?per_page=1" },
          {
            name: "webphone_login",
            method: "POST",
            path: "/agent/webphone/login",
            body: { agent_id: 0 },
          },
          {
            name: "campaigns_list",
            method: "GET",
            path: "/campaigns?per_page=1",
          },
        ];

        const diagResults: Record<
          string,
          { status: number; ok: boolean; detail?: string }
        > = {};

        for (const ep of endpoints) {
          try {
            const separator = ep.path.includes("?") ? "&" : "?";
            const diagUrl =
              `${baseUrl}${ep.path}${separator}api_token=${token}`;
            const diagHeaders: Record<string, string> = {
              "Accept": "application/json",
            };
            const diagOpts: RequestInit = {
              method: ep.method,
              headers: diagHeaders,
            };
            if ((ep as any).body) {
              diagHeaders["Content-Type"] = "application/json";
              diagOpts.body = JSON.stringify((ep as any).body);
            }
            const res = await fetch(diagUrl, diagOpts);
            const txt = await res.text();
            diagResults[ep.name] = {
              status: res.status,
              ok: res.ok,
              detail: res.ok ? undefined : txt.substring(0, 200),
            };
          } catch (err) {
            diagResults[ep.name] = {
              status: 0,
              ok: false,
              detail: String(err).substring(0, 200),
            };
          }
        }

        result = {
          token_prefix: token.substring(0, 10) + "...",
          base_url: baseUrl,
          cod_agent: codAgent,
          permissions: diagResults,
          summary: Object.entries(diagResults).map(([k, v]) =>
            `${k}: ${v.ok ? "✅" : "❌"} (${v.status})`
          ).join(", "),
        };
        break;
      }

      // ------------------------------------------------------------------
      // validate_sip — diagnóstico administrativo de conectividade SIP
      // ------------------------------------------------------------------
      case "validate_sip": {
        const { extensionId } = params;

        const { data: ext } = await supabase
          .from("phone_extensions")
          .select("threecplus_agent_id, threecplus_sip_username, threecplus_sip_password, threecplus_sip_domain, threecplus_extension, threecplus_raw")
          .eq("id", extensionId)
          .eq("cod_agent", codAgent)
          .single();

        if (!ext) throw new Error("Ramal não encontrado.");

        const rawData = (ext.threecplus_raw as any)?.data || ext.threecplus_raw;

        // Try webphone login to get fresh SIP info from 3C+ using AGENT token
        let loginResult: any = null;
        let loginError: string | null = null;
        let usedAgentToken = false;
        let webphoneStatus: boolean | null = null;

        if (ext.threecplus_agent_id) {
          // Get agent token
          const valAgentToken = await getAgentToken(supabase, extensionId, codAgent, baseUrl, token);
          
          // Check webphone status
          try {
            const userData = await threecRequest(baseUrl, token, `/users/${ext.threecplus_agent_id}`);
            const u = userData?.data ?? userData;
            webphoneStatus = u?.webphone ?? null;
          } catch {}

          if (valAgentToken) {
            usedAgentToken = true;
            // Ensure webphone is enabled first
            await ensureWebphoneEnabled(supabase, baseUrl, token, valAgentToken, ext.threecplus_agent_id, extensionId, codAgent);

            try {
              loginResult = await threecRequest(baseUrl, valAgentToken, "/agent/webphone/login", {
                method: "POST",
                body: {},
              });
            } catch (e: any) {
              loginError = e.message || String(e);
            }
          } else {
            loginError = "Token do agente não encontrado em threecplus_raw.data.api_token";
          }
        }

        const resolveWs = (domain: string) =>
          config.threecplus_ws_url || `wss://${domain}:8089/ws`;

        result = {
          config: {
            sip_domain: config.sip_domain || null,
            threecplus_ws_url: config.threecplus_ws_url || null,
            threecplus_base_url: config.threecplus_base_url || null,
          },
          extension: {
            threecplus_sip_domain: ext.threecplus_sip_domain || null,
            threecplus_sip_username: ext.threecplus_sip_username || null,
            has_password: !!ext.threecplus_sip_password,
            threecplus_agent_id: ext.threecplus_agent_id,
            raw_telephony_id: rawData?.telephony_id || null,
            raw_extension_password: rawData?.extension_password ? '***' : null,
            webphone_enabled: webphoneStatus,
          },
          tokenInfo: {
            usedAgentToken,
            hasAgentToken: !!rawData?.api_token,
          },
          login: loginResult ? {
            sip_server: loginResult.sip_server || loginResult.domain || loginResult.host || null,
            sip_user: loginResult.sip_user || loginResult.username || loginResult.extension || null,
            has_sip_password: !!(loginResult.sip_password || loginResult.password),
            full_response_keys: Object.keys(loginResult),
            raw_login: loginResult,
          } : null,
          loginError,
          resolved: {
            domain: config.sip_domain || ext.threecplus_sip_domain || (loginResult?.sip_server) || "pbx01.3c.fluxoti.com",
            wsUrl: resolveWs(config.sip_domain || ext.threecplus_sip_domain || "pbx01.3c.fluxoti.com"),
          },
        };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("3cplus-proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// ------------------------------------------------------------------
// Helper: normalize a 3C+ CDR record to phone_call_logs shape
// ------------------------------------------------------------------
function buildCallLog(
  cdr: any,
  codAgent: string,
  fixTz: (ts: string | null | undefined) => string | null,
): Record<string, any> {
  const cdrId = cdr.id ? String(cdr.id) : null;
  const direction = cdr.direction || cdr.call_type || "outbound";
  const caller = cdr.from || cdr.caller || cdr.origin || "";
  const called = cdr.to || cdr.destination || cdr.phone_number || "";

  const metadata: Record<string, any> = { provider: "3cplus" };
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
    status: "hangup",
    metadata,
  };

  if (cdrId) log.call_id = cdrId;
  return log;
}
