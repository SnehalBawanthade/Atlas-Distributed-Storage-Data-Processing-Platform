import { buildHealthyRing } from "./build-healthy-ring.js";
import { uploadChunkToNode } from "./upload-chunk-to-node.js";
import { getNodeAddress } from "./node-registry.js";
import { prisma } from "./resolve-node.js";

const REPLICATION_FACTOR = 2;

/**
 * Downloads a chunk's bytes from a specific (healthy) node over HTTP.
 */
async function downloadChunkFromNode(nodeId: string, chunkId: string): Promise<Buffer> {
  const baseUrl = getNodeAddress(nodeId);
  const response = await fetch(`${baseUrl}/internal/chunks/${chunkId}`);

  if (!response.ok) {
    throw new Error(`Failed to download chunk ${chunkId} from ${nodeId}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Finds every chunk that had a replica on the given (now-unhealthy)
 * node, and for each one, ensures it still has REPLICATION_FACTOR
 * healthy replicas — copying to a new node if it's fallen short.
 */
export async function recoverNode(failedNodeId: string) {
  const failedNode = await prisma.storageNode.findFirst({
    where: { host: failedNodeId },
  });

  if (!failedNode) {
    throw new Error(`Unknown node: ${failedNodeId}`);
  }

  // Every chunk that had a replica on the failed node.
  const affectedReplicas = await prisma.chunkReplica.findMany({
    where: { storageNodeId: failedNode.id },
    include: {
      chunk: {
        include: {
          replicas: { include: { storageNode: true } },
        },
      },
    },
  });

  console.log(`Found ${affectedReplicas.length} replica(s) on failed node ${failedNodeId}.`);

  const ring = await buildHealthyRing();

  for (const replica of affectedReplicas) {
    const chunk = replica.chunk;
    const globalChunkId = `${chunk.fileId}-chunk-${chunk.chunkNumber}`;

    // How many HEALTHY replicas does this chunk currently have,
    // excluding the one on the failed node?
    const healthyReplicas = chunk.replicas.filter(
      (r) => r.storageNode.status === "HEALTHY",
    );

    if (healthyReplicas.length >= REPLICATION_FACTOR) {
      console.log(`Chunk ${chunk.id} already has ${healthyReplicas.length} healthy replicas — skipping.`);
      continue;
    }

    if (healthyReplicas.length === 0) {
      console.error(`Chunk ${chunk.id} has NO healthy replicas left — DATA LOSS, cannot recover.`);
      continue;
    }

    // Pick a surviving replica to read the bytes from.
    const sourceNodeId = healthyReplicas[0].storageNode.host;

    // Ask the ring (built from only healthy nodes) who should hold
    // this chunk now. Pick a target that doesn't already have a
    // healthy replica of it.
    const candidates = ring.getNodes(globalChunkId, REPLICATION_FACTOR + 1);
    const existingHosts = new Set(healthyReplicas.map((r) => r.storageNode.host));
    const targetNodeId = candidates.find((c) => !existingHosts.has(c));

    if (!targetNodeId) {
      console.error(`No available target node to recover chunk ${chunk.id} onto.`);
      continue;
    }

    console.log(
      `Recovering chunk ${chunk.id}: copying from ${sourceNodeId} to ${targetNodeId}...`,
    );

    const data = await downloadChunkFromNode(sourceNodeId, globalChunkId);
    const uploadResult = await uploadChunkToNode(targetNodeId, globalChunkId, data);

    if (uploadResult.checksum !== chunk.checksum) {
      console.error(
        `Checksum mismatch recovering chunk ${chunk.id} onto ${targetNodeId}! Aborting this replica.`,
      );
      continue;
    }

    const targetNode = await prisma.storageNode.findFirst({ where: { host: targetNodeId } });

    await prisma.chunkReplica.upsert({
      where: {
        chunkId_storageNodeId: {
          chunkId: chunk.id,
          storageNodeId: targetNode!.id,
        },
      },
      update: { status: "HEALTHY" },
      create: {
        chunkId: chunk.id,
        storageNodeId: targetNode!.id,
        status: "HEALTHY",
      },
    });

    // Mark the old replica (on the failed node) as MISSING, rather
    // than deleting it — this preserves history of what happened,
    // and avoids the recovery process re-processing it every time
    // it runs.
    await prisma.chunkReplica.update({
      where: { id: replica.id },
      data: { status: "MISSING" },
    });

    console.log(`  -> chunk ${chunk.id} recovered onto ${targetNodeId}.`);
  }
}