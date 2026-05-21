import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { resolveAI, providerHeaders } from '../_shared/aiGateway.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

interface RequestBody {
  conversationId: string;
  messageId?: string;
  messageText: string;
  contactName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body: RequestBody = await req.json();
    if (!body.conversationId || !body.messageText) {
      return new Response(JSON.stringify({ error: 'conversationId and messageText required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve global config for the autoreply agent (Lovable default / OpenRouter).
    const autoreplyAI = await resolveAI(supabase, 'chat_autoreply');

    // 1. Carregar conversa + contexto
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id, client_id, cod_agent, channel, status, assigned_to')
      .eq('id', body.conversationId)
      .maybeSingle();

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Classificar mensagem (intent + sentiment) — Gemini Flash
    const classifyPrompt = `Analise esta mensagem de cliente e responda APENAS com JSON válido:
{"intent": "uma de: duvida|reclamacao|elogio|compra|suporte|cancelamento|saudacao|despedida|outro",
 "sentiment": "uma de: positivo|neutro|negativo",
 "urgency": "uma de: baixa|media|alta",
 "topics": ["lista", "de", "topicos"],
 "language": "pt-BR|en|es|...",
 "confidence": 0.0-1.0}

Mensagem: "${body.messageText}"`;

    const classifyRes = await fetch(autoreplyAI.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${autoreplyAI.apiKey}`, ...providerHeaders(autoreplyAI.provider) },
      body: JSON.stringify({
        model: autoreplyAI.model,
        messages: [
          { role: 'system', content: 'Você é um classificador. Responda APENAS com JSON, sem markdown ou comentários.' },
          { role: 'user', content: classifyPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (classifyRes.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (classifyRes.status === 402) {
      return new Response(JSON.stringify({ error: 'credits_exhausted' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const classifyJson = await classifyRes.json();
    let classification: any = {};
    try {
      const raw = classifyJson.choices?.[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      classification = JSON.parse(cleaned);
    } catch (e) {
      classification = { intent: 'outro', sentiment: 'neutro', urgency: 'media', topics: [], language: 'pt-BR', confidence: 0 };
    }

    await supabase.from('chat_ai_classifications').insert({
      client_id: conversation.client_id,
      cod_agent: conversation.cod_agent,
      conversation_id: conversation.id,
      message_id: body.messageId || null,
      intent: classification.intent,
      sentiment: classification.sentiment,
      urgency: classification.urgency,
      topics: classification.topics || [],
      language: classification.language,
      confidence: classification.confidence,
      raw_response: classification,
      model: 'google/gemini-2.5-flash',
    });

    // 3. Buscar regra de auto-resposta aplicável
    const { data: rules = [] } = await supabase
      .from('chat_ai_autoreply_rules')
      .select('*')
      .eq('client_id', conversation.client_id)
      .eq('is_active', true)
      .order('position', { ascending: true });

    const matchedRule = (rules ?? []).find((r: any) => {
      const intentMatch = !r.match_intents?.length || r.match_intents.includes(classification.intent);
      const kwMatch = !r.match_keywords?.length || r.match_keywords.some((kw: string) =>
        body.messageText.toLowerCase().includes(kw.toLowerCase())
      );
      return intentMatch && kwMatch && classification.confidence >= (r.confidence_threshold || 0);
    });

    let aiReply: string | null = null;
    let usedKbIds: string[] = [];

    if (matchedRule) {
      // Verificar limite de respostas
      const { count: priorReplies = 0 } = await supabase
        .from('chat_ai_autoreply_logs')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .eq('rule_id', matchedRule.id)
        .eq('sent', true);

      if ((priorReplies || 0) >= matchedRule.max_replies_per_conversation) {
        if (matchedRule.handoff_after_max && !conversation.assigned_to) {
          await supabase.from('chat_conversations').update({ status: 'pending', assigned_to: null, metadata: { handoff_reason: 'ai_max_replies' } }).eq('id', conversation.id);
        }
      } else {
        // Buscar contexto da KB se ativado
        let kbContext = '';
        if (matchedRule.use_knowledge_base) {
          let kbQuery = supabase
            .from('chat_kb_articles')
            .select('id, title, summary, content, keywords')
            .eq('client_id', conversation.client_id)
            .eq('is_published', true);
          if (matchedRule.kb_category_id) kbQuery = kbQuery.eq('category_id', matchedRule.kb_category_id);
          const { data: articles = [] } = await kbQuery.limit(20);

          // Filtro simples por relevância (palavras em comum)
          const lowerMsg = body.messageText.toLowerCase();
          const scored = (articles ?? []).map((a: any) => {
            const text = `${a.title} ${a.summary || ''} ${(a.keywords || []).join(' ')}`.toLowerCase();
            const score = text.split(/\s+/).filter((w: string) => w.length > 3 && lowerMsg.includes(w)).length;
            return { ...a, score };
          }).filter((a: any) => a.score > 0).sort((a: any, b: any) => b.score - a.score).slice(0, 3);

          if (scored.length > 0) {
            kbContext = '\n\nBASE DE CONHECIMENTO (use como referência):\n' + scored.map((a: any) =>
              `- ${a.title}: ${a.summary || a.content.slice(0, 300)}`
            ).join('\n');
            usedKbIds = scored.map((a: any) => a.id);
          }
        }

        // Rule-level model override keeps precedence (historically a Lovable model);
        // otherwise use the global autoreply config (Lovable default / OpenRouter).
        const replyEndpoint = matchedRule.model ? 'https://ai.gateway.lovable.dev/v1/chat/completions' : autoreplyAI.endpoint;
        const replyKey = matchedRule.model ? LOVABLE_API_KEY : autoreplyAI.apiKey;
        const replyProvider = matchedRule.model ? 'lovable' : autoreplyAI.provider;
        const replyRes = await fetch(replyEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${replyKey}`, ...providerHeaders(replyProvider) },
          body: JSON.stringify({
            model: matchedRule.model || autoreplyAI.model,
            messages: [
              { role: 'system', content: (matchedRule.system_prompt || 'Você é um atendente cordial.') + kbContext + '\n\nResponda de forma concisa, em português.' },
              { role: 'user', content: body.messageText },
            ],
            temperature: 0.6,
          }),
        });

        if (replyRes.ok) {
          const replyJson = await replyRes.json();
          aiReply = replyJson.choices?.[0]?.message?.content?.trim() || null;
        }

        await supabase.from('chat_ai_autoreply_logs').insert({
          client_id: conversation.client_id,
          rule_id: matchedRule.id,
          conversation_id: conversation.id,
          message_id: body.messageId || null,
          generated_text: aiReply,
          sent: false, // o front faz o envio efetivo via canal apropriado
          confidence: classification.confidence,
          used_kb_articles: usedKbIds,
        });

        await supabase.from('chat_ai_autoreply_rules').update({
          execution_count: (matchedRule.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        }).eq('id', matchedRule.id);
      }
    }

    return new Response(JSON.stringify({
      classification,
      reply: aiReply,
      rule_id: matchedRule?.id || null,
      used_kb_articles: usedKbIds,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('chat-ai-process error', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
