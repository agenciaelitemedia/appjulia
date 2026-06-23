// Shared helper: when a human attendant sends a message, deactivate the Julia
// AI session for that contact (mirrors the "humano assumiu" toggle).
//
// Resolves cod_agent from queue_agent_links, fetches the active session via the
// db-query edge function (action `get_session_status`) and, if active, calls
// `update_session_status` to set active=false. No-op when the queue has no AI
// agent or no session exists. Errors are swallowed (best-effort) and logged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface DisableJuliaArgs {
  clientId: string;
  queueId: string;
  contactPhone: string;
  /** Optional: skip when message comes from automation (bot, campaign, autoreply). */
  messageSource?: string | null;
}

async function callDbQuery(action: string, data: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/db-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`db-query ${action} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function triggerFollowupStop(codAgent: string, sessionId: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/n8n_execute-followup-stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ codAgent, sessionId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      console.error(
        `[disableJulia][followup-stop] failed cod_agent=${codAgent} phone=${sessionId}: ${res.status} ${json?.error ?? ""}`,
      );
      return;
    }
    console.log(
      `[disableJulia][followup-stop] ok cod_agent=${codAgent} phone=${sessionId} ` +
        `temp=${json?.data?.deleted_temp ?? 0} queue=${json?.data?.updated_queue ?? 0} status=${json?.data?.deleted_status ?? 0}`,
    );
  } catch (err) {
    console.error(`[disableJulia][followup-stop] error: ${(err as Error).message}`);
  }
}

export async function disableJuliaOnHumanSend(args: DisableJuliaArgs): Promise<void> {
  const { clientId, queueId, contactPhone, messageSource } = args;
  try {
    if (!clientId || !queueId || !contactPhone) return;
    if (messageSource && ["bot", "campaign", "autoreply", "ai"].includes(messageSource)) {
      return;
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Resolve cod_agent for the queue
    const { data: link } = await supabase
      .from("queue_agent_links")
      .select("cod_agent")
      .eq("queue_id", queueId)
      .maybeSingle();

    const codAgent = link?.cod_agent ? String(link.cod_agent) : null;
    if (!codAgent) {
      // Queue without AI agent → nothing to disable.
      return;
    }

    // 2) Fetch session
    const statusResp = await callDbQuery("get_session_status", {
      whatsappNumber: contactPhone,
      codAgent,
    });
    const session = statusResp?.data?.[0];
    if (!session?.id) {
      console.log(`[disableJulia] no session for cod_agent=${codAgent} phone=${contactPhone}`);
      return;
    }
    if (session.active !== false) {
      // 3) Deactivate
      await callDbQuery("update_session_status", {
        sessionId: session.id,
        active: false,
      });
      console.log(
        `[disableJulia] deactivated session=${session.id} cod_agent=${codAgent} phone=${contactPhone}`,
      );
    }

    // 4) Stop any active follow-ups for this contact (best-effort).
    await triggerFollowupStop(codAgent, contactPhone);
  } catch (err) {
    console.error(`[disableJulia] error: ${(err as Error).message}`);
  }
}