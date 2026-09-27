import { fnv1a } from "./fnv1a.js";

interface RingEntry {
  position: number; // where this virtual node sits on the ring
  nodeId: string;    // which real node this position belongs to
}

export class HashRing {
  private ring: RingEntry[] = [];
  private readonly virtualNodesPerNode: number;
  private readonly knownNodes = new Set<string>();

  constructor(virtualNodesPerNode = 100) {
    this.virtualNodesPerNode = virtualNodesPerNode;
  }

  /**
   * Adds a real node to the ring by placing several "virtual node"
   * points for it, spread across the ring, to even out distribution.
   */
  addNode(nodeId: string): void {
    if (this.knownNodes.has(nodeId)) {
      return; // idempotent: adding the same node twice is a no-op
    }

    for (let i = 0; i < this.virtualNodesPerNode; i++) {
      const virtualKey = `${nodeId}#${i}`;
      const position = fnv1a(virtualKey);
      this.ring.push({ position, nodeId });
    }

    this.ring.sort((a, b) => a.position - b.position);
    this.knownNodes.add(nodeId);
  }

  /**
   * Removes a real node and all of its virtual-node positions from the ring.
   */
  removeNode(nodeId: string): void {
    if (!this.knownNodes.has(nodeId)) {
      return; // idempotent: removing a node that isn't there is a no-op
    }

    this.ring = this.ring.filter((entry) => entry.nodeId !== nodeId);
    this.knownNodes.delete(nodeId);
  }

  /**
   * Given a key (e.g. a chunk ID), finds which real node owns it:
   * hash the key, then walk clockwise (find the first ring position
   * >= that hash), wrapping around to the start if necessary.
   */
  getNode(key: string): string | null {
    if (this.ring.length === 0) {
      return null;
    }

    const keyPosition = fnv1a(key);
    const index = this.findFirstPositionAtOrAfter(keyPosition);
    return this.ring[index].nodeId;
  }

    /**
   * Given a key, returns up to `count` DISTINCT real nodes, walking
   * clockwise from the key's position. The first result is the
   * "primary" node (same as getNode would return); subsequent
   * results are replica nodes.
   */
  getNodes(key: string, count: number): string[] {
    if (this.ring.length === 0 || count <= 0) {
      return [];
    }

    const keyPosition = fnv1a(key);
    const startIndex = this.findFirstPositionAtOrAfter(keyPosition);

    const result: string[] = [];
    const seen = new Set<string>();

    // Walk forward through the ring, wrapping around, until we've
    // collected `count` distinct real nodes OR we've looped through
    // every virtual-node entry once (meaning there aren't enough
    // distinct real nodes to satisfy the request).
    for (let i = 0; i < this.ring.length && result.length < count; i++) {
      const index = (startIndex + i) % this.ring.length;
      const nodeId = this.ring[index].nodeId;

      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        result.push(nodeId);
      }
    }

    return result;
  }

  private findFirstPositionAtOrAfter(targetPosition: number): number {
    let low = 0;
    let high = this.ring.length - 1;

    if (targetPosition > this.ring[high].position) {
      return 0;
    }

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid].position < targetPosition) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /** For debugging/inspection: how many virtual-node entries exist right now. */
  size(): number {
    return this.ring.length;
  }
}