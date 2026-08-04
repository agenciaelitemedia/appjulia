/**
 * Auto-layout do quadro usando dagre (esquerda → direita).
 */
import dagre from 'dagre';
import type { FlowCanvasEdge, FlowCanvasNode } from '../types';

const NODE_WIDTH = 264;
const NODE_HEIGHT = 108;

export function autoLayout(nodes: FlowCanvasNode[], edges: FlowCanvasEdge[]): FlowCanvasNode[] {
  if (nodes.length === 0) return nodes;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 96, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: node.width ?? NODE_WIDTH,
      height: node.height ?? NODE_HEIGHT,
    });
  });
  edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    if (!positioned) return node;
    return {
      ...node,
      position: {
        x: Math.round(positioned.x - (node.width ?? NODE_WIDTH) / 2),
        y: Math.round(positioned.y - (node.height ?? NODE_HEIGHT) / 2),
      },
    };
  });
}
