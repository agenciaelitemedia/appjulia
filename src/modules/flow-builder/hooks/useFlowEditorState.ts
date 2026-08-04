import { useCallback, useMemo, useState } from 'react';
import { useNodesState, useEdgesState, type OnSelectionChangeParams } from '@xyflow/react';
import { NODE_DEFINITIONS } from '../registry/nodeRegistry';
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

  const addNode = useCallback(
    (kind: FlowNodeKind, position?: { x: number; y: number }) => {
      const node = createFlowNode(kind, position ?? { x: 240 + Math.random() * 120, y: 160 + Math.random() * 160 });
      setNodes((current) => [...current, node]);
      setSelectedId(node.id);
      markDirty();
    },
    [markDirty, setNodes],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
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
    [markDirty, setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((n) => n.id !== nodeId));
      setEdges((current) => current.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedId((current) => (current === nodeId ? null : current));
      markDirty();
    },
    [markDirty, setEdges, setNodes],
  );

  const updateNodeData = useCallback(
    (nodeId: string, updater: (node: FlowCanvasNode) => FlowCanvasNode['data']) => {
      setNodes((current) => current.map((n) => (n.id === nodeId ? { ...n, data: updater(n) } : n)));
      markDirty();
    },
    [markDirty, setNodes],
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
    },
    [setEdges, setNodes],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) markDirty();
    },
    onEdgesChange: (changes: Parameters<typeof onEdgesChange>[0]) => {
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
  };
}