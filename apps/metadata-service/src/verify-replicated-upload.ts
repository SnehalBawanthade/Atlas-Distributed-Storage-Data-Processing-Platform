import { chunkFile } from "@atlas/shared";
import { HashRing } from "@atlas/hashing";
import { uploadChunkToNode } from "./upload-chunk-to-node.js";

const REPLICATION_FACTOR = 2;

async function main() {
  const ring = new HashRing(100);
  ring.addNode("storage-node-1");
  ring.addNode("storage-node-2");
  ring.addNode("storage-node-3");
  ring.addNode("storage-node-4");

  const chunks = await chunkFile("../../big-test-file.txt", 4096);
  console.log(`File split into ${chunks.length} chunks.\n`);

  for (const chunk of chunks) {
    const chunkId = `verify-chunk-${chunk.chunkNumber}`;
    const targetNodes = ring.getNodes(chunkId, REPLICATION_FACTOR);

    console.log(`${chunkId} -> nodes: [${targetNodes.join(", ")}]`);

    const uploadResults = await Promise.all(
      targetNodes.map((nodeId) =>
        uploadChunkToNode(nodeId, chunkId, chunk.data),
      ),
    );

    for (const result of uploadResults) {
      const matches = result.checksum === chunk.checksum;
      console.log(
        `  -> ${result.nodeId}: size=${result.size}, checksum matches local: ${matches}`,
      );
      if (!matches) {
        console.error(
          `  !! MISMATCH: expected ${chunk.checksum}, got ${result.checksum}`,
        );
      }
    }
  }
}

main().catch((err) => {
  console.error("Replicated upload verification failed:", err);
  process.exitCode = 1;
});