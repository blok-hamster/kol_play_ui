import { UnifiedNode, UnifiedLink } from '@/types';

/**
 * Computes a hash string representing the topological structure and simulation-impacting
 * attributes of the graph. Visual-only changes (like labels or images) are excluded
 * to preventing unnecessary simulation restarts.
 */
export function computeSimulationHash(nodes: UnifiedNode[], links: UnifiedLink[]): string {
  // We only care about node existence and physical properties
  const nodeHash = nodes
    .map(n => 
      `${n.id}:${n.value}:${n.connections}:${(n.influenceScore || 0).toFixed(2)}`
    )
    .sort() // Ensure order independence
    .join('|');

  // We only care about link connections and strength factors
  const linkHash = links
    .map(l => {
      // Handle both string IDs and object references for source/target
      const sourceId = typeof l.source === 'object' ? (l.source as any).id || l.source : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id || l.target : l.target;
      
      return `${sourceId}-${targetId}:${l.tradeCount}:${(l.volume || 0).toFixed(0)}`;
    })
    .sort() // Ensure order independence
    .join('|');

  // Simple string concatenation is sufficient for typical graph sizes (100-500 nodes)
  // For much larger graphs, we might want a real hash function (DJB2/FNV), 
  // but string comparison is fast enough for this scale.
  return `N[${nodes.length}]:${nodeHash}&L[${links.length}]:${linkHash}`;
}
