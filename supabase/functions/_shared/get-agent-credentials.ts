// ============================================
// Get Agent Credentials from External DB
// Fetches UaZapi connection info for an agent
// ============================================

export interface AgentCredentials {
  evo_url: string;
  evo_apikey: string;
}

export async function getAgentCredentials(
  sql: any,
  codAgent: string,
): Promise<AgentCredentials | null> {
  try {
    const rows = await sql.unsafe(
      `SELECT evo_url, evo_apikey FROM agents WHERE cod_agent = $1 AND hub = 'uazapi' LIMIT 1`,
      [codAgent],
    );

    if (!rows || rows.length === 0) {
      console.log(`[getAgentCredentials] No UaZapi credentials for agent ${codAgent}`);
      return null;
    }

    const { evo_url, evo_apikey } = rows[0];
    if (!evo_url || !evo_apikey) {
      console.log(`[getAgentCredentials] Incomplete credentials for agent ${codAgent}`);
      return null;
    }

    return { evo_url, evo_apikey };
  } catch (err) {
    console.error(`[getAgentCredentials] Error fetching credentials for ${codAgent}:`, err);
    return null;
  }
}
