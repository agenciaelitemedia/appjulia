// Verifica que `apply_queue_limit_from_order` é idempotente em retries.
// Cenário simulado: a primeira chamada incrementou o QUEUE_LIMIT e commitou
// o flag `queue_limit_applied` na mesma transação. Uma "falha posterior"
// (timeout de rede, crash do worker antes de marcar `provisioned`) dispara
// um retry — a segunda chamada precisa retornar `already_applied` SEM somar
// novamente ao QUEUE_LIMIT.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "apply_queue_limit_from_order é idempotente sob retry pós-incremento",
  ignore: !SERVICE_KEY,
  async fn() {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY!);

    // 1) Pega um plano ativo qualquer
    const { data: plan, error: planErr } = await sb
      .from("queue_plans")
      .select("id, max_queues")
      .eq("is_active", true)
      .gt("max_queues", 0)
      .limit(1)
      .single();
    if (planErr || !plan) throw new Error("Plano de teste não encontrado");

    const clientIdText = `test_idem_${crypto.randomUUID().slice(0, 8)}`;
    const extraQueues = 2;
    const expectedDelta = (plan.max_queues ?? 0) + extraQueues;

    // 2) Cria pedido de teste
    const { data: order, error: ordErr } = await sb
      .from("queue_orders")
      .insert({
        client_id: clientIdText,
        customer_name: "Teste Idempotência",
        customer_document: "00000000000",
        customer_email: "idem@test.local",
        plan_id: plan.id,
        plan_name: "test",
        billing_period: "monthly",
        extra_queues: extraQueues,
        plan_price: 0,
        setup_fee: 0,
        extra_queues_total: 0,
        total_amount: 0,
        status: "paid",
        paid_at: new Date().toISOString(),
        metadata: {},
      })
      .select("id")
      .single();
    if (ordErr || !order) throw new Error("Falha ao criar pedido: " + ordErr?.message);

    try {
      // 3) Primeira chamada — aplica o incremento
      const { data: r1, error: e1 } = await sb.rpc(
        "apply_queue_limit_from_order",
        { p_order_id: order.id },
      );
      if (e1) throw e1;
      assertEquals((r1 as any).status, "ok", "1ª chamada deve retornar ok");
      assertEquals(
        (r1 as any).delta,
        expectedDelta,
        "delta deve ser max_queues + extra_queues",
      );
      const newTotalAfter1 = (r1 as any).new_total;
      assertEquals(
        newTotalAfter1,
        expectedDelta,
        "primeiro QUEUE_LIMIT deve ser exatamente o delta (cliente novo)",
      );

      // Confirma persistência do incremento + flag commitada
      const { data: s1 } = await sb
        .from("chat_client_settings")
        .select("settings")
        .eq("client_id", clientIdText)
        .single();
      assertEquals(
        Number(((s1 as any).settings ?? {}).QUEUE_LIMIT),
        expectedDelta,
        "QUEUE_LIMIT persistido após 1ª chamada",
      );

      const { data: ord1 } = await sb
        .from("queue_orders")
        .select("metadata")
        .eq("id", order.id)
        .single();
      assertEquals(
        ((ord1 as any).metadata ?? {}).queue_limit_applied,
        true,
        "flag queue_limit_applied deve estar commitada após 1ª chamada",
      );

      // 4) Simula RETRY após falha posterior (ex: worker caiu antes de
      // marcar provisioned). A flag já está commitada — a segunda chamada
      // NÃO pode somar novamente.
      const { data: r2, error: e2 } = await sb.rpc(
        "apply_queue_limit_from_order",
        { p_order_id: order.id },
      );
      if (e2) throw e2;
      assertEquals(
        (r2 as any).status,
        "already_applied",
        "retry deve detectar flag e retornar already_applied",
      );

      const { data: s2 } = await sb
        .from("chat_client_settings")
        .select("settings")
        .eq("client_id", clientIdText)
        .single();
      assertEquals(
        Number(((s2 as any).settings ?? {}).QUEUE_LIMIT),
        expectedDelta,
        "QUEUE_LIMIT NÃO pode ser somado novamente em retry",
      );

      // 5) 3ª chamada para reforçar — ainda não soma
      const { data: r3 } = await sb.rpc("apply_queue_limit_from_order", {
        p_order_id: order.id,
      });
      assertEquals((r3 as any).status, "already_applied");
      const { data: s3 } = await sb
        .from("chat_client_settings")
        .select("settings")
        .eq("client_id", clientIdText)
        .single();
      assertEquals(
        Number(((s3 as any).settings ?? {}).QUEUE_LIMIT),
        expectedDelta,
        "múltiplos retries continuam idempotentes",
      );

      assert(true);
    } finally {
      // cleanup
      await sb.from("queue_orders").delete().eq("id", order.id);
      await sb
        .from("chat_client_settings")
        .delete()
        .eq("client_id", clientIdText);
    }
  },
});
