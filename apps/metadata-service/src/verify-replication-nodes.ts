import { HashRing } from "@atlas/hashing";

function main() {
  const ring = new HashRing(100);

  ring.addNode("storage-node-1");
  ring.addNode("storage-node-2");
  ring.addNode("storage-node-3");
  ring.addNode("storage-node-4");

  const replicationFactor = 2;

  console.log(`Replication factor: ${replicationFactor}\n`);

  for (let i = 0; i < 10; i++) {
    const chunkId = `chunk-${i}`;
    const nodes = ring.getNodes(chunkId, replicationFactor);
    console.log(`${chunkId}: primary=${nodes[0]}, replica=${nodes[1]}`);
  }

  // Edge case: what happens if we ask for more replicas than nodes exist?
  console.log("\nAsking for 6 nodes when only 4 exist:");
  const overRequested = ring.getNodes("chunk-edge-case", 6);
  console.log(overRequested);
}

main();