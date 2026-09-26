import { HashRing } from "@atlas/hashing";

function main() {
  const ring = new HashRing(100);

  ring.addNode("storage-node-1");
  ring.addNode("storage-node-2");
  ring.addNode("storage-node-3");
  ring.addNode("storage-node-4");

  console.log(`Ring has ${ring.size()} virtual node entries (4 nodes x 100 each).`);

  const chunkCount = 1000;
  const assignmentsBefore = new Map<string, string>();

  for (let i = 0; i < chunkCount; i++) {
    const chunkId = `chunk-${i}`;
    const node = ring.getNode(chunkId)!;
    assignmentsBefore.set(chunkId, node);
  }

  const distribution: Record<string, number> = {};
  for (const node of assignmentsBefore.values()) {
    distribution[node] = (distribution[node] ?? 0) + 1;
  }
  console.log("Distribution across 4 nodes:", distribution);

  console.log("\nRemoving storage-node-3 (simulating a failure)...\n");
  ring.removeNode("storage-node-3");

  let changedCount = 0;
  for (let i = 0; i < chunkCount; i++) {
    const chunkId = `chunk-${i}`;
    const newNode = ring.getNode(chunkId)!;
    const oldNode = assignmentsBefore.get(chunkId)!;
    if (newNode !== oldNode) {
      changedCount++;
    }
  }

  console.log(
    `Out of ${chunkCount} chunks, ${changedCount} (${((changedCount / chunkCount) * 100).toFixed(1)}%) were reassigned to a different node.`,
  );
  console.log(
    `If we had used naive hash(key) % numberOfNodes instead, ~75% of chunks would have been reassigned.`,
  );
}

main();