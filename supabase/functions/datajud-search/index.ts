import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// DataJud public API key (CNJ public access)
const DATAJUD_API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

// All tribunal endpoints
const TRIBUNAIS = {
  // Superiores
  STF: "api_publica_stf",
  STJ: "api_publica_stj",
  TST: "api_publica_tst",
  TSE: "api_publica_tse",
  STM: "api_publica_stm",
  // TRFs
  TRF1: "api_publica_trf1",
  TRF2: "api_publica_trf2",
  TRF3: "api_publica_trf3",
  TRF4: "api_publica_trf4",
  TRF5: "api_publica_trf5",
  TRF6: "api_publica_trf6",
  // TJs
  TJAC: "api_publica_tjac",
  TJAL: "api_publica_tjal",
  TJAM: "api_publica_tjam",
  TJAP: "api_publica_tjap",
  TJBA: "api_publica_tjba",
  TJCE: "api_publica_tjce",
  TJDFT: "api_publica_tjdft",
  TJES: "api_publica_tjes",
  TJGO: "api_publica_tjgo",
  TJMA: "api_publica_tjma",
  TJMG: "api_publica_tjmg",
  TJMS: "api_publica_tjms",
  TJMT: "api_publica_tjmt",
  TJPA: "api_publica_tjpa",
  TJPB: "api_publica_tjpb",
  TJPE: "api_publica_tjpe",
  TJPI: "api_publica_tjpi",
  TJPR: "api_publica_tjpr",
  TJRJ: "api_publica_tjrj",
  TJRN: "api_publica_tjrn",
  TJRO: "api_publica_tjro",
  TJRR: "api_publica_tjrr",
  TJRS: "api_publica_tjrs",
  TJSC: "api_publica_tjsc",
  TJSE: "api_publica_tjse",
  TJSP: "api_publica_tjsp",
  TJTO: "api_publica_tjto",
  // TRTs
  TRT1: "api_publica_trt1",
  TRT2: "api_publica_trt2",
  TRT3: "api_publica_trt3",
  TRT4: "api_publica_trt4",
  TRT5: "api_publica_trt5",
  TRT6: "api_publica_trt6",
  TRT7: "api_publica_trt7",
  TRT8: "api_publica_trt8",
  TRT9: "api_publica_trt9",
  TRT10: "api_publica_trt10",
  TRT11: "api_publica_trt11",
  TRT12: "api_publica_trt12",
  TRT13: "api_publica_trt13",
  TRT14: "api_publica_trt14",
  TRT15: "api_publica_trt15",
  TRT16: "api_publica_trt16",
  TRT17: "api_publica_trt17",
  TRT18: "api_publica_trt18",
  TRT19: "api_publica_trt19",
  TRT20: "api_publica_trt20",
  TRT21: "api_publica_trt21",
  TRT22: "api_publica_trt22",
  TRT23: "api_publica_trt23",
  TRT24: "api_publica_trt24",
  // TREs
  TREAC: "api_publica_tre-ac",
  TREAL: "api_publica_tre-al",
  TREAM: "api_publica_tre-am",
  TREAP: "api_publica_tre-ap",
  TREBA: "api_publica_tre-ba",
  TRECE: "api_publica_tre-ce",
  TREDF: "api_publica_tre-df",
  TREES: "api_publica_tre-es",
  TREGO: "api_publica_tre-go",
  TREMA: "api_publica_tre-ma",
  TREMG: "api_publica_tre-mg",
  TREMS: "api_publica_tre-ms",
  TREMT: "api_publica_tre-mt",
  TREPA: "api_publica_tre-pa",
  TREPB: "api_publica_tre-pb",
  TREPE: "api_publica_tre-pe",
  TREPI: "api_publica_tre-pi",
  TREPR: "api_publica_tre-pr",
  TRERJ: "api_publica_tre-rj",
  TRERN: "api_publica_tre-rn",
  TRERO: "api_publica_tre-ro",
  TRERR: "api_publica_tre-rr",
  TRERS: "api_publica_tre-rs",
  TRESC: "api_publica_tre-sc",
  TRESE: "api_publica_tre-se",
  TRESP: "api_publica_tre-sp",
  TRETO: "api_publica_tre-to",
  // TJMs
  TJMMG: "api_publica_tjmmg",
  TJMRS: "api_publica_tjmrs",
  TJMSP: "api_publica_tjmsp",
};

type TribunalKey = keyof typeof TRIBUNAIS;

interface SearchRequest {
  action:
    | "search_by_number"
    | "search_by_document"
    | "search_by_lawyer"
    | "get_movements"
    | "list_tribunals";
  query?: string;
  tribunals?: TribunalKey[];
  processNumber?: string;
  size?: number;
}

interface DataJudHit {
  _index: string;
  _id: string;
  _score: number;
  _source: {
    numeroProcesso: string;
    classe: { codigo: number; nome: string };
    assuntos: Array<{ codigo: number; nome: string }>;
    tribunal: string;
    dataAjuizamento: string;
    grau: string;
    orgaoJulgador: { codigo: number; nome: string };
    movimentos: Array<{
      codigo: number;
      nome: string;
      dataHora: string;
      complementosTabelados?: Array<{ codigo: number; nome: string; valor?: number; descricao?: string }>;
    }>;
    silesNome?: string;
    formato?: { codigo: number; nome: string };
    sistema?: { codigo: number; nome: string };
    valorCausa?: number;
  };
}

async function searchTribunal(
  tribunal: TribunalKey,
  query: object,
  size: number = 10
): Promise<{ tribunal: TribunalKey; hits: DataJudHit[]; total: number; error?: string }> {
  const endpoint = TRIBUNAIS[tribunal];
  const url = `${DATAJUD_BASE_URL}/${endpoint}/_search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        size,
        query,
        sort: [{ dataAjuizamento: { order: "desc" } }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from ${tribunal}:`, errorText);
      return { tribunal, hits: [], total: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      tribunal,
      hits: data.hits?.hits || [],
      total: data.hits?.total?.value || 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error searching ${tribunal}:`, errorMessage);
    return { tribunal, hits: [], total: 0, error: errorMessage };
  }
}

async function searchAllTribunals(
  query: object,
  tribunals?: TribunalKey[],
  size: number = 10
): Promise<{ results: Array<{ tribunal: TribunalKey; hits: DataJudHit[]; total: number; error?: string }>; totalResults: number; searchedTribunals: number }> {
  const tribunalsToSearch = tribunals && tribunals.length > 0
    ? tribunals
    : (Object.keys(TRIBUNAIS) as TribunalKey[]);

  // Search in parallel with concurrency limit
  const CONCURRENCY = 10;
  const results: Array<{ tribunal: TribunalKey; hits: DataJudHit[]; total: number; error?: string }> = [];
  
  for (let i = 0; i < tribunalsToSearch.length; i += CONCURRENCY) {
    const batch = tribunalsToSearch.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((t) => searchTribunal(t, query, size))
    );
    results.push(...batchResults);
  }

  const totalResults = results.reduce((sum, r) => sum + r.total, 0);

  return {
    results: results.filter((r) => r.total > 0 || r.error),
    totalResults,
    searchedTribunals: tribunalsToSearch.length,
  };
}

function buildProcessNumberQuery(processNumber: string) {
  // Remove formatting and search by exact number
  const cleanNumber = processNumber.replace(/\D/g, "");
  return {
    bool: {
      should: [
        { match: { numeroProcesso: processNumber } },
        { match: { numeroProcesso: cleanNumber } },
        { wildcard: { numeroProcesso: `*${cleanNumber}*` } },
      ],
      minimum_should_match: 1,
    },
  };
}

function buildDocumentQuery(document: string) {
  // Search in party documents (CNPJ/CPF)
  const cleanDoc = document.replace(/\D/g, "");
  return {
    bool: {
      should: [
        { match: { "dadosBasicos.polo.parte.pessoa.documento": cleanDoc } },
        { match: { "dadosBasicos.polo.parte.pessoa.numeroDocumentoPrincipal": cleanDoc } },
        { wildcard: { "dadosBasicos.polo.parte.pessoa.documento": `*${cleanDoc}*` } },
      ],
      minimum_should_match: 1,
    },
  };
}

function buildLawyerQuery(oab: string) {
  // Parse OAB format: SP123456 or OAB/SP 123.456
  const cleanOab = oab.replace(/[^\w]/g, "").toUpperCase();
  const ufMatch = cleanOab.match(/^([A-Z]{2})(\d+)$/);
  
  if (ufMatch) {
    const [, uf, numero] = ufMatch;
    return {
      bool: {
        must: [
          { match: { "dadosBasicos.polo.parte.advogado.inscricao.numero": numero } },
        ],
        should: [
          { match: { "dadosBasicos.polo.parte.advogado.inscricao.uf": uf } },
        ],
      },
    };
  }
  
  // Fallback: search by number only
  const numeroOnly = cleanOab.replace(/\D/g, "");
  return {
    match: { "dadosBasicos.polo.parte.advogado.inscricao.numero": numeroOnly },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const body: SearchRequest = await req.json();
    const { action, query, tribunals, processNumber, size = 10 } = body;

    let response: object;

    switch (action) {
      case "list_tribunals":
        response = {
          tribunals: Object.keys(TRIBUNAIS).map((key) => ({
            key,
            endpoint: TRIBUNAIS[key as TribunalKey],
            name: getTribunalName(key as TribunalKey),
            category: getTribunalCategory(key as TribunalKey),
          })),
        };
        break;

      case "search_by_number":
        if (!query) {
          return new Response(
            JSON.stringify({ error: "Query is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        response = await searchAllTribunals(
          buildProcessNumberQuery(query),
          tribunals,
          size
        );
        break;

      case "search_by_document":
        if (!query) {
          return new Response(
            JSON.stringify({ error: "Query is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        response = await searchAllTribunals(
          buildDocumentQuery(query),
          tribunals,
          size
        );
        break;

      case "search_by_lawyer":
        if (!query) {
          return new Response(
            JSON.stringify({ error: "Query is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        response = await searchAllTribunals(
          buildLawyerQuery(query),
          tribunals,
          size
        );
        break;

      case "get_movements":
        if (!processNumber || !tribunals || tribunals.length === 0) {
          return new Response(
            JSON.stringify({ error: "Process number and tribunal are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const movResult = await searchTribunal(
          tribunals[0],
          buildProcessNumberQuery(processNumber),
          1
        );
        response = {
          movements: movResult.hits[0]?._source?.movimentos || [],
          process: movResult.hits[0]?._source || null,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({ ...response, responseTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in datajud-search:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getTribunalName(key: TribunalKey): string {
  const names: Record<string, string> = {
    STF: "Supremo Tribunal Federal",
    STJ: "Superior Tribunal de Justiça",
    TST: "Tribunal Superior do Trabalho",
    TSE: "Tribunal Superior Eleitoral",
    STM: "Superior Tribunal Militar",
    TRF1: "Tribunal Regional Federal da 1ª Região",
    TRF2: "Tribunal Regional Federal da 2ª Região",
    TRF3: "Tribunal Regional Federal da 3ª Região",
    TRF4: "Tribunal Regional Federal da 4ª Região",
    TRF5: "Tribunal Regional Federal da 5ª Região",
    TRF6: "Tribunal Regional Federal da 6ª Região",
    TJAC: "Tribunal de Justiça do Acre",
    TJAL: "Tribunal de Justiça de Alagoas",
    TJAM: "Tribunal de Justiça do Amazonas",
    TJAP: "Tribunal de Justiça do Amapá",
    TJBA: "Tribunal de Justiça da Bahia",
    TJCE: "Tribunal de Justiça do Ceará",
    TJDFT: "Tribunal de Justiça do Distrito Federal e Territórios",
    TJES: "Tribunal de Justiça do Espírito Santo",
    TJGO: "Tribunal de Justiça de Goiás",
    TJMA: "Tribunal de Justiça do Maranhão",
    TJMG: "Tribunal de Justiça de Minas Gerais",
    TJMS: "Tribunal de Justiça de Mato Grosso do Sul",
    TJMT: "Tribunal de Justiça de Mato Grosso",
    TJPA: "Tribunal de Justiça do Pará",
    TJPB: "Tribunal de Justiça da Paraíba",
    TJPE: "Tribunal de Justiça de Pernambuco",
    TJPI: "Tribunal de Justiça do Piauí",
    TJPR: "Tribunal de Justiça do Paraná",
    TJRJ: "Tribunal de Justiça do Rio de Janeiro",
    TJRN: "Tribunal de Justiça do Rio Grande do Norte",
    TJRO: "Tribunal de Justiça de Rondônia",
    TJRR: "Tribunal de Justiça de Roraima",
    TJRS: "Tribunal de Justiça do Rio Grande do Sul",
    TJSC: "Tribunal de Justiça de Santa Catarina",
    TJSE: "Tribunal de Justiça de Sergipe",
    TJSP: "Tribunal de Justiça de São Paulo",
    TJTO: "Tribunal de Justiça do Tocantins",
  };
  
  // TRTs
  if (key.startsWith("TRT")) {
    const num = key.replace("TRT", "");
    return `Tribunal Regional do Trabalho da ${num}ª Região`;
  }
  
  // TREs
  if (key.startsWith("TRE")) {
    const uf = key.replace("TRE", "");
    const estados: Record<string, string> = {
      AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
      BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
      GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
      MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
      PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
      RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina",
      SE: "Sergipe", SP: "São Paulo", TO: "Tocantins"
    };
    return `Tribunal Regional Eleitoral do ${estados[uf] || uf}`;
  }
  
  // TJMs
  if (key.startsWith("TJM")) {
    const uf = key.replace("TJM", "");
    const estados: Record<string, string> = { MG: "Minas Gerais", RS: "Rio Grande do Sul", SP: "São Paulo" };
    return `Tribunal de Justiça Militar de ${estados[uf] || uf}`;
  }
  
  return names[key] || key;
}

function getTribunalCategory(key: TribunalKey): string {
  if (["STF", "STJ", "TST", "TSE", "STM"].includes(key)) return "Superior";
  if (key.startsWith("TRF")) return "Federal";
  if (key.startsWith("TJ") && !key.startsWith("TJM")) return "Estadual";
  if (key.startsWith("TRT")) return "Trabalhista";
  if (key.startsWith("TRE")) return "Eleitoral";
  if (key.startsWith("TJM")) return "Militar";
  return "Outro";
}
