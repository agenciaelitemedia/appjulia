import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useFlowBuilderIdentity } from '../extend/auth';
import { convertLegacyFlow, isLegacyFlow } from '../lib/legacyFlow';
import type { FlowCanvasEdge, FlowCanvasNode } from '../types';

export interface FlowSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  /** Situação da automação: rascunho, publicada ou arquivada. */
  status: FlowStatus;
  published_at: string | null;
  published_version: number | null;
  /** Rascunho difere da versão publicada. */
  has_unpublished_changes: boolean;
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  start_node_id: string | null;
  execution_count: number;
  last_executed_at: string | null;
  updated_at: string;
  /** Fluxo veio do construtor antigo e foi convertido na leitura. */
  migrated_from_legacy?: boolean;
}

export type FlowStatus = 'draft' | 'published' | 'archived';

const TABLE = 'chat_bot_flows';
const KEY = 'flow-builder-flows';

function graphSignature(nodes: unknown[], edges: unknown[]): string {
  return JSON.stringify([nodes ?? [], edges ?? []]);
}

function normalize(row: Record<string, unknown>): FlowSummary {
  const rawNodes = Array.isArray(row.nodes) ? (row.nodes as unknown[]) : [];
  const rawEdges = Array.isArray(row.edges) ? (row.edges as unknown[]) : [];
  const legacy = isLegacyFlow(rawNodes);
  const converted = legacy
    ? convertLegacyFlow(rawNodes, rawEdges, {
        keywords: Array.isArray(row.trigger_keywords) ? (row.trigger_keywords as string[]) : [],
        match_mode: (row.match_mode as string) ?? 'contains',
        only_business_hours: Boolean(row.only_business_hours),
      })
    : null;

  const publishedNodes = Array.isArray(row.published_nodes) ? (row.published_nodes as unknown[]) : [];
  const publishedEdges = Array.isArray(row.published_edges) ? (row.published_edges as unknown[]) : [];
  const status = (String(row.status ?? 'draft') as FlowStatus) ?? 'draft';

  return {
    id: String(row.id),
    name: String(row.name ?? 'Sem nome'),
    description: (row.description as string) ?? null,
    is_active: Boolean(row.is_active),
    status,
    published_at: (row.published_at as string) ?? null,
    published_version: row.published_version != null ? Number(row.published_version) : null,
    has_unpublished_changes:
      publishedNodes.length === 0
        ? status !== 'published'
        : graphSignature(converted ? converted.nodes : rawNodes, converted ? converted.edges : rawEdges) !==
          graphSignature(publishedNodes, publishedEdges),
    nodes: converted ? converted.nodes : (rawNodes as FlowCanvasNode[]),
    edges: converted ? converted.edges : (rawEdges as FlowCanvasEdge[]),
    start_node_id: converted ? converted.nodes[0]?.id ?? null : ((row.start_node_id as string) ?? null),
    execution_count: Number(row.execution_count ?? 0),
    last_executed_at: (row.last_executed_at as string) ?? null,
    updated_at: String(row.updated_at ?? ''),
    migrated_from_legacy: legacy,
  };
}

export function useFlows() {
  const { clientId } = useFlowBuilderIdentity();
  return useQuery({
    queryKey: [KEY, clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<FlowSummary[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalize);
    },
  });
}

export function useFlow(flowId?: string) {
  return useQuery({
    queryKey: [KEY, 'detail', flowId],
    enabled: !!flowId && flowId !== 'novo',
    queryFn: async (): Promise<FlowSummary | null> => {
      const { data, error } = await supabase.from(TABLE).select('*').eq('id', flowId).maybeSingle();
      if (error) throw error;
      return data ? normalize(data) : null;
    },
  });
}

export function useFlowMutations() {
  const queryClient = useQueryClient();
  const { clientId, codAgent } = useFlowBuilderIdentity();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });

  const createFlow = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          client_id: clientId,
          cod_agent: codAgent,
          name: input.name,
          description: input.description ?? null,
          is_active: false,
          nodes: [],
          edges: [],
        })
        .select('*')
        .single();
      if (error) throw error;
      return normalize(data);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(`Não foi possível criar a automação: ${e.message}`),
  });

  const saveFlow = useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string | null;
      nodes?: FlowCanvasNode[];
      edges?: FlowCanvasEdge[];
      is_active?: boolean;
    }) => {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) payload.name = input.name;
      if (input.description !== undefined) payload.description = input.description;
      if (input.is_active !== undefined) payload.is_active = input.is_active;
      if (input.nodes) {
        payload.nodes = input.nodes;
        const trigger = input.nodes.find((n) => String(n.data?.kind ?? '').startsWith('trigger_'));
        payload.start_node_id = trigger?.id ?? null;
      }
      if (input.edges) payload.edges = input.edges;
      const { error } = await supabase.from(TABLE).update(payload).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Automação excluída');
      invalidate();
    },
    onError: (e: Error) => toast.error(`Falha ao excluir: ${e.message}`),
  });

  return { createFlow, saveFlow, deleteFlow };
}