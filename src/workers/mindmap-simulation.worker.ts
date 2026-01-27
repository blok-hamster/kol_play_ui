import * as d3 from 'd3';
import { UnifiedNode, UnifiedLink } from '../types';

// Define message types
type SimulationMessage = 
  | { type: 'INIT'; nodes: UnifiedNode[]; links: UnifiedLink[]; width: number; height: number }
  | { type: 'UPDATE_DATA'; nodes: UnifiedNode[]; links: UnifiedLink[] }
  | { type: 'UPDATE_DIMENSIONS'; width: number; height: number }
  | { type: 'DRAG_START'; id: string; x: number; y: number }
  | { type: 'DRAG_MOVE'; id: string; x: number; y: number }
  | { type: 'DRAG_END'; id: string }
  | { type: 'STOP' };

// Internal state
let simulation: d3.Simulation<UnifiedNode, UnifiedLink> | null = null;
let nodes: UnifiedNode[] = [];
let links: UnifiedLink[] = [];
let width = 800;
let height = 600;

// Initialize simulation
const initSimulation = (newNodes: UnifiedNode[], newLinks: UnifiedLink[]) => {
  if (simulation) simulation.stop();

  nodes = newNodes;
  links = newLinks;

  simulation = d3
    .forceSimulation<UnifiedNode>(nodes)
    .force(
      'link',
      d3
        .forceLink<UnifiedNode, UnifiedLink>(links)
        .id(d => d.id)
        .distance(link => {
          const strengthFactor = Math.min(
            1,
            (Math.log(link.tradeCount + 1) * 0.5 + Math.log(link.volume + 1) * 0.5) / 10
          );
          return 120 - strengthFactor * 40;
        })
    )
    .force(
      'charge',
      d3.forceManyBody().strength(d => {
        const node = d as UnifiedNode;
        const connectionStrength =
          node.type === 'token'
            ? Math.min(50, node.connections * 5)
            : Math.min(30, (node.influenceScore || 0) / 2);
        return -400 - connectionStrength;
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collision',
      d3.forceCollide().radius(d => {
        const node = d as UnifiedNode;
        const baseRadius = node.type === 'token' ? 20 : 14;
        const bonus =
          node.type === 'token'
            ? Math.sqrt(node.connections) * 7
            : Math.sqrt(node.influenceScore || 0) * 2.2;
        return baseRadius + bonus + 15;
      })
    );

  simulation.on('tick', () => {
    // Post positions back to main thread
    // We strictly send only what's needed to minimize serialization cost
    const positions = new Map<string, { x: number; y: number }>();
    nodes.forEach(node => {
      if (node.x != null && node.y != null) {
        positions.set(node.id, { x: node.x, y: node.y });
      }
    });
    
    // Map is not directly serializable via postMessage in all envs without transform, 
    // sending as array or object is safer/standard
    self.postMessage({ type: 'TICK', positions: Array.from(positions.entries()) });
  });
};

self.onmessage = (event: MessageEvent<SimulationMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'INIT':
      {
        const { nodes: initNodes, links: initLinks, width: w, height: h } = message;
        width = w;
        height = h;
        initSimulation(initNodes, initLinks);
        break;
      }

    case 'UPDATE_DATA':
      {
         const { nodes: newNodes, links: newLinks } = message;
         // In a real optimized scenario, we would merge/diff here to preserve positions
         // For now, simpler re-init or re-heating could work, but let's try to preserve
         
         // Basic strategy: Update the simulation nodes/links references
         // Note: D3 mutates objects. New data usually comes fresh. 
         // We should try to copy existing positions to new nodes if ids match
         const posMap = new Map(nodes.map(n => [n.id, {x: n.x, y: n.y, vx: n.vx, vy: n.vy}]));
         
         newNodes.forEach(n => {
             const existing = posMap.get(n.id);
             if (existing) {
                 if (existing.x !== undefined) n.x = existing.x;
                 if (existing.y !== undefined) n.y = existing.y;
                 if (existing.vx !== undefined) n.vx = existing.vx;
                 if (existing.vy !== undefined) n.vy = existing.vy;
             }
         });
         
         if (simulation) {
             simulation.nodes(newNodes);
             const linkForce = simulation.force('link') as d3.ForceLink<UnifiedNode, UnifiedLink>;
             if (linkForce) linkForce.links(newLinks);
             simulation.alpha(0.3).restart();
         } else {
             initSimulation(newNodes, newLinks);
         }
         nodes = newNodes;
         links = newLinks;
         break;
      }
      
    case 'UPDATE_DIMENSIONS':
      {
        width = message.width;
        height = message.height;
        if (simulation) {
            simulation.force('center', d3.forceCenter(width / 2, height / 2));
            simulation.alpha(0.3).restart();
        }
        break;
      }

    case 'DRAG_START':
      {
        if (!simulation) return;
        const node = nodes.find(n => n.id === message.id);
        if (node) {
            simulation.alphaTarget(0.3).restart();
            node.fx = message.x;
            node.fy = message.y;
        }
        break;
      }

    case 'DRAG_MOVE':
      {
        if (!simulation) return;
        const node = nodes.find(n => n.id === message.id);
        if (node) {
            node.fx = message.x;
            node.fy = message.y;
        }
        break;
      }

    case 'DRAG_END':
      {
        if (!simulation) return;
        const node = nodes.find(n => n.id === message.id);
        if (node) {
            simulation.alphaTarget(0);
            node.fx = null;
            node.fy = null;
        }
        break;
      }

    case 'STOP':
      if (simulation) simulation.stop();
      break;
  }
};
