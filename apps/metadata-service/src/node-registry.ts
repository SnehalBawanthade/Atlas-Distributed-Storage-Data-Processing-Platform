// Static mapping of node ID -> base URL. In a more advanced version,
// this could come from the StorageNode table in Postgres instead of
// being hardcoded — we'll revisit that in a later phase.
const NODE_ADDRESSES: Record<string, string> = {
  "storage-node-1": "http://localhost:9001",
  "storage-node-2": "http://localhost:9002",
  "storage-node-3": "http://localhost:9003",
  "storage-node-4": "http://localhost:9004",
};

export function getNodeAddress(nodeId: string): string {
  const address = NODE_ADDRESSES[nodeId];
  if (!address) {
    throw new Error(`Unknown storage node: ${nodeId}`);
  }
  return address;
}