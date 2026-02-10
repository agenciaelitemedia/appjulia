import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

// Minimal tribunal map for monitored processes
const TRIBUNAIS: Record<string, string> = {
  STF: "api_publica_stf", STJ: "api_publica_stj", TST: "api_publica_tst", TSE: "api_publica_tse", STM: "api_publica_stm",
  TRF1: "api_publica_trf1", TRF2: "api_publica_trf2", TRF3: "api_publica_trf3", TRF4: "api_publica_trf4", TRF5: "api_publica_trf5", TRF6: "api_publica_trf6",
  TJAC: "api_publica_tjac", TJAL: "api_publica_tjal", TJAM: "api_publica_tjam", TJAP: "api_publica_tjap",
  TJBA: "api_publica_tjba", TJCE: "api_publica_tjce", TJDFT: "api_publica_tjdft", TJES: "api_publica_tjes",
  TJGO: "api_publica_tjgo", TJMA: "api_publica_tjma", TJMG: "api_publica_tjmg", TJMS: "api_publica_tjms",
  TJMT: "api_publica_tjmt", TJPA: "api_publica_tjpa", TJPB: "api_publica_tjpb", TJPE: "api_publica_tjpe",
  TJPI: "api_publica_tjpi", TJPR: "api_publica_tjpr", TJRJ: "api_publica_tjrj", TJRN: "api_publica_tjrn",
  TJRO: "api_publica_tjro", TJRR: "api_publica_tjrr", TJRS: "api_publica_tjrs", TJSC: "api_publica_tjsc",
  TJSE: "api_publica_tjse", TJSP: "api_publica_tjsp", TJTO: "api_publica_tjto",
  TRT1: "api_publica_trt1", TRT2: "api_publica_trt2", TRT3: "api_publica_trt3", TRT4: "api_publica_trt4",
  TRT5: "api_publica_trt5", TRT6: "api_publica_trt6", TRT7: "api_publica_trt7", TRT8: "api_publica_trt8",
  TRT9: "api_publica_trt9", TRT10: "api_publica_trt10", TRT11: "api_publica_trt11", TRT12: "api_publica_trt12",
  TRT13: "api_publica_trt13", TRT14: "api_publica_trt14", TRT15: "api_publica_trt15", TRT16: "api_publica_trt16",
  TRT17: "api_publica_trt17", TRT18: "api_publica_trt18", TRT19: "api_publica_trt19", TRT20: "api_publica_trt20",
  TRT21: "api_publica_trt21", TRT22: "api_publica_trt22", TRT23: "api_publica_trt23", TRT24: "api_publica_trt24",
};

// Detect tribunal from process number (positions 14-15 = justice branch, 16-17 = tribunal)
function detectTribunal(processNumber: string): string | null {
  if (processNumber.length !== 20) return null;
  const justice = processNumber.slice(13, 14);
  const tribunalNum = processNumber.slice(14, 16);
  const state = processNumber.slice(16, 18);

  // Map justice branch codes
  if (justice === '8') {
    // State justice
    const stateMap: Record<string, string> = {
      '01': 'TJAC', '02': 'TJAL', '03': 'TJAP', '04': 'TJAM', '05': 'TJBA', '06': 'TJCE',
      '07': 'TJDFT', '08': 'TJES', '09': 'TJGO', '10': 'TJMA', '11': 'TJMT', '12': 'TJMS',
      '13': 'TJMG', '14': 'TJPA', '15': 'TJPB', '16': 'TJPE', '17': 'TJPI', '18': 'TJPR',
      '19': 'TJRJ', '20': 'TJRN', '21': 'TJRS', '22': 'TJRO', '23': 'TJRR', '24': 'TJSC',
      '25': 'TJSE', '26': 'TJSP', '27': 'TJTO',
    };
    return stateMap[tribunalNum] || null;
  }
  if (justice === '5') return `TRT${parseInt(tribunalNum)}`;
  if (justice === '4') return `TRF${parseInt(tribunalNum)}`;
  return null;
}

async function searchProcess(processNumber: string, tribunal: string) {
  const endpoint = TRIBUNAIS[tribunal];
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${DATAJUD_BASE_URL}/${endpoint}/_search`, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: processNumber } },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    return data.hits?.hits?.[0]?._source || null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active monitored processes
    const { data: processes, error: procError } = await supabase
      .from("datajud_monitored_processes")
      .select("*")
      .eq("status", "active");

    if (procError) throw procError;
    if (!processes || processes.length === 0) {
      return new Response(JSON.stringify({ message: "No processes to monitor", checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group processes by user_id
    const userProcesses = new Map<number, typeof processes>();
    for (const proc of processes) {
      const list = userProcesses.get(proc.user_id) || [];
      list.push(proc);
      userProcesses.set(proc.user_id, list);
    }

    let totalAlerts = 0;

    for (const [userId, userProcs] of userProcesses.entries()) {
      // Get notification config for user
      const { data: config } = await supabase
        .from("datajud_notification_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Get agent connection for WhatsApp sending
      let agentConnection: { evo_url: string; evo_apikey: string; evo_instancia: string } | null = null;
      if (config?.default_agent_cod && config?.is_active) {
        try {
          const { data: agentData } = await supabase.functions.invoke("db-query", {
            body: {
              action: "raw",
              data: {
                query: `SELECT a.evo_url, a.evo_apikey, a.evo_instancia FROM agents a WHERE a.cod_agent = $1 AND a.evo_url IS NOT NULL LIMIT 1`,
                params: [config.default_agent_cod],
              },
            },
          });
          if (agentData?.data?.[0]) {
            agentConnection = agentData.data[0];
          }
        } catch (e) {
          console.error("Error fetching agent connection:", e);
        }
      }

      for (const proc of userProcs) {
        try {
          // Determine tribunal
          const tribunal = proc.tribunal || detectTribunal(proc.process_number);
          if (!tribunal) {
            await supabase.from("datajud_monitored_processes").update({ status: "error" } as any).eq("id", proc.id);
            continue;
          }

          // Fetch current data from DataJud
          const currentData = await searchProcess(proc.process_number, tribunal);
          if (!currentData) {
            await supabase.from("datajud_monitored_processes").update({ last_check_at: new Date().toISOString() } as any).eq("id", proc.id);
            continue;
          }

          // Compare movements
          const currentMovements = currentData.movimentos || [];
          const knownMovements = proc.last_known_movements || [];
          const knownCodes = new Set(knownMovements.map((m: any) => `${m.codigo}-${m.dataHora}`));
          const newMovements = currentMovements.filter(
            (m: any) => !knownCodes.has(`${m.codigo}-${m.dataHora}`)
          );

          if (newMovements.length > 0) {
            // Create alerts for each new movement
            const alerts = newMovements.map((mov: any) => ({
              process_id: proc.id,
              user_id: userId,
              movement_data: mov,
              is_read: false,
              whatsapp_sent: false,
            }));

            const { data: insertedAlerts, error: alertErr } = await supabase
              .from("datajud_alerts")
              .insert(alerts as any[])
              .select();

            if (alertErr) console.error("Alert insert error:", alertErr);
            totalAlerts += newMovements.length;

            // Send WhatsApp notifications
            if (agentConnection && config?.is_active) {
              const phones: string[] = [...(config.office_phones || [])];
              if (proc.client_phone) phones.push(proc.client_phone);

              for (const mov of newMovements) {
                const message = `*📋 Nova Movimentação Processual*\n\n` +
                  `*Processo:* ${proc.process_number_formatted}\n` +
                  `*Nome:* ${proc.name}\n` +
                  `*Tribunal:* ${tribunal}\n\n` +
                  `*Movimentação:* ${mov.nome}\n` +
                  `*Data:* ${new Date(mov.dataHora).toLocaleDateString("pt-BR")}\n\n` +
                  `--\n_Alerta automático - Busca Processual Julia_`;

                for (const phone of phones) {
                  try {
                    const sendUrl = `${agentConnection.evo_url}/message/sendText/${agentConnection.evo_instancia}`;
                    const sendResp = await fetch(sendUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        apikey: agentConnection.evo_apikey,
                      },
                      body: JSON.stringify({ number: phone, text: message }),
                    });

                    if (sendResp.ok && insertedAlerts?.[0]?.id) {
                      await supabase.from("datajud_alerts").update({ whatsapp_sent: true } as any).eq("id", insertedAlerts[0].id);
                    }
                  } catch (sendErr) {
                    console.error(`WhatsApp send error to ${phone}:`, sendErr);
                    if (insertedAlerts?.[0]?.id) {
                      await supabase.from("datajud_alerts").update({
                        whatsapp_error: sendErr instanceof Error ? sendErr.message : "Send failed",
                      } as any).eq("id", insertedAlerts[0].id);
                    }
                  }
                }
              }
            }

            // Update known movements
            await supabase.from("datajud_monitored_processes").update({
              last_known_movements: currentMovements,
              last_check_at: new Date().toISOString(),
              tribunal: tribunal,
            } as any).eq("id", proc.id);
          } else {
            // No new movements, just update check time
            await supabase.from("datajud_monitored_processes").update({
              last_check_at: new Date().toISOString(),
            } as any).eq("id", proc.id);
          }
        } catch (procErr) {
          console.error(`Error checking process ${proc.process_number}:`, procErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Monitor check complete", checked: processes.length, alerts: totalAlerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Monitor error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
