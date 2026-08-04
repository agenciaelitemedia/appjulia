import { useCallback, useMemo, useRef, useState } from 'react';
import { useNodesState, useEdgesState, type OnSelectionChangeParams } from '@xyflow/react';
import { NODE_DEFINITIONS } from '../registry/nodeRegistry';
import { autoLayout } from '../lib/autoLayout';
import type { FlowCanvasEdge, FlowCanvasNode, FlowNodeConfig, FlowNodeKind } from '../types';

let seq = 0;
const nextId = () => `node_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function createFlowNode(kind: FlowNodeKind, position: { x: number; y: number }): FlowCanvasNode {
  const def = NODE_DEFINITIONS[kind];
  return {
    id: nextId(),
    type: 'flowNode',
    position,
    data: { kind, label: def.label, config: { ...def.defaultConfig } },
  };
}

export function useFlowEditorState(initialNodes: FlowCanvasNode[], initialEdges: FlowCanvasEdge[]) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowCanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowCanvasEdge>(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  /* ── Histórico (desfazer / refazer) ───────────────────────── */
  const HISTORY_LIMIT = 50;
  type Snapshot = { nodes: FlowCanvasNode[]; edges: FlowCanvasEdge[] };
  const stateRef = useRef<Snapshot>({ nodes: initialNodes, edges: initialEdges });
  stateRef.current = { nodes, edges };
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  const snapshot = useCallback((source: Snapshot): Snapshot => ({
    nodes: source.nodes.map((n) => ({ ...n, data: { ...n.data, config: { ...n.data.config } } })),
    edges: source.edges.map((e) => ({ ...e })),
  }), []);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current, snapshot(stateRef.current)].slice(-HISTORY_LIMIT);
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }, [snapshot]);

  const applySnapshot = useCallback(
    (target: Snapshot) => {
      setNodes(target.nodes);
      setEdges(target.edges);
      setSelectedId(null);
      markDirty();
    },
    [markDirty, setEdges, setNodes],
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, snapshot(stateRef.current)].slice(-HISTORY_LIMIT);
    applySnapshot(previous);
    setHistoryTick((t) => t + 1);
  }, [applySnapshot, snapshot]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, snapshot(stateRef.current)].slice(-HISTORY_LIMIT);
    applySnapshot(next);
    setHistoryTick((t) => t + 1);
  }, [applySnapshot, snapshot]);

  const applyAutoLayout = useCallback(() => {
    pushHistory();
    setNodes((current) => autoLayout(current, stateRef.current.edges));
    markDirty();
  }, [markDirty, pushHistory, setNodes]);

  const addNode = useCallback(
    (kind: FlowNodeKind, position?: { x: number; y: number }) => {
      pushHistory();
      const node = createFlowNode(kind, position ?? { x: 240 + Math.random() * 120, y: 160 + Math.random() * 160 });
      setNodes((current) => [...current, node]);
      setSelectedId(node.id);
      markDirty();
    },
    [markDirty, pushHistory, setNodes],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      pushHistory();
      setNodes((current) => {
        const source = current.find((n) => n.id === nodeId);
        if (!source) return current;
        return [
          ...current,
          {
            ...source,
            id: nextId(),
            selected: false,
            position: { x: source.position.x + 48, y: source.position.y + 48 },
            data: { ...source.data, config: { ...source.data.config } },
          },
        ];
      });
      markDirty();
    },
    [markDirty, pushHistory, setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      pushHistory();
      setNodes((current) => current.filter((n) => n.id !== nodeId));
      setEdges((current) => current.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedId((current) => (current === nodeId ? null : current));
      markDirty();
    },
    [markDirty, pushHistory, setEdges, setNodes],
  );

  const updateNodeData = useCallback(
    (nodeId: string, updater: (node: FlowCanvasNode) => FlowCanvasNode['data']) => {
      pushHistory();
      setNodes((current) => current.map((n) => (n.id === nodeId ? { ...n, data: updater(n) } : n)));
      markDirty();
    },
    [markDirty, pushHistory, setNodes],
  );

  const setNodeLabel = useCallback(
    (nodeId: string, label: string) => updateNodeData(nodeId, (n) => ({ ...n.data, label })),
    [updateNodeData],
  );

  const setNodeConfig = useCallback(
    (nodeId: string, patch: FlowNodeConfig) =>
      updateNodeData(nodeId, (n) => ({ ...n.data, config: { ...n.data.config, ...patch } })),
    [updateNodeData],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedId(params.nodes.length === 1 ? params.nodes[0].id : null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const issues = useMemo(() => {
    const list: string[] = [];
    if (!nodes.some((n) => NODE_DEFINITIONS[n.data.kind]?.category === 'trigger')) {
      list.push('Adicione um bloco de disparo para o fluxo iniciar.');
    }
    nodes.forEach((n) => {
      const def = NODE_DEFINITIONS[n.data.kind];
      const errs = def?.validate(n.data.config || {}) ?? [];
      errs.forEach((err) => list.push(`${n.data.label || def?.label}: ${err}`));
    });
    return list;
  }, [nodes]);

  const reset = useCallback(
    (nextNodes: FlowCanvasNode[], nextEdges: FlowCanvasEdge[]) => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedId(null);
      setDirty(false);
      pastRef.current = [];
      futureRef.current = [];
      setHistoryTick((t) => t + 1);
    },
    [setEdges, setNodes],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: (changes: Parameters<typeof onNodesChange>[0]) => {
      if (changes.some((c) => c.type === 'remove' || (c.type === 'position' && c.dragging === false))) pushHistory();
      onNodesChange(changes);
      if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) markDirty();
    },
    onEdgesChange: (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (changes.some((c) => c.type === 'remove')) pushHistory();
      onEdgesChange(changes);
      if (changes.some((c) => c.type !== 'select')) markDirty();
    },
    onSelectionChange,
    selectedNode,
    addNode,
    duplicateNode,
    deleteNode,
    setNodeLabel,
    setNodeConfig,
    issues,
    dirty,
    setDirty,
    reset,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    historyTick,
    applyAutoLayout,
    pushHistory,
  };
}