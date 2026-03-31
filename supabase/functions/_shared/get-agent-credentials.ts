// ============================================
// Get Agent Credentials from External DB
// Fetches messaging credentials for any provider
// ============================================

import type { AgentMessagingCredentials } from "./messaging-factory.ts";

export async function getAgentCredentials(
  sql: any,
  codAgent: string,
): Promise<AgentMessagingCredentials | null> {
  try {
    const rows = await sql.unsafe(
      `SELECT hub, evo_url, evo_apikey, waba_token, waba_number_id 
       FROM agents WHERE cod_agent = $1 LIMIT 1`,
      [codAgent],
    );

    if (!rows || rows.length === 0) {
      console.log(`[getAgentCredentials] No agent found: ${codAgent}`);
      return null;
    }

    const { hub, evo_url, evo_apikey, waba_token, waba_number_id } = rows[0];

    if (!hub) {
      console.log(`[getAgentCredentials] No hub configured for agent ${codAgent}`);
      return null;
    }

    if (hub === 'uazapi' && (!evo_url || !evo_apikey)) {
      console.log(`[getAgentCredentials] Incomplete UaZapi credentials for agent ${codAgent}`);
      return null;
    }

    if (hub === 'waba' && (!waba_token || !waba_number_id)) {
      console.log(`[getAgentCredentials] Incomplete WABA credentials for agent ${codAgent}`);
      return null;
    }

    return { hub, evo_url, evo_apikey, waba_token, waba_number_id };
  } catch (err) {
    console.error(`[getAgentCredentials] Error fetching credentials for ${codAgent}:`, err);
    return null;
  }
}
