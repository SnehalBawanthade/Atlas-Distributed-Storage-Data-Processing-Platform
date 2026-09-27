import { chunkFile } from "@atlas/shared";
import { HashRing } from "@atlas/hashing";
import { uploadChunkToNode } from "./upload-chunk-to-node.js";
import { resolveNodeDbId, prisma } from "./resolve-node.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const REPLICATION_FACTOR = 2;
const CHUNK_SIZE = 4096;

export async function uploadFile(filePath: string, filename: string) {
  const ring = new HashRing(100);
  ring.addNode("storage-node-1");
  ring.addNode("storage-node-2");
  ring.addNode("storage-node-3");
  ring.addNode("storage-node-4");

  const fileBytes = await readFile(filePath);
  const fileChecksum = createHash("sha256").update(fileBytes).digest("hex");

  const chunks = await chunkFile(filePath, CHUNK_SIZE);

  // Create the File row and all its Chunk rows together, in one
  // transaction — this is the same nested-write pattern we proved
  // works back in Phase 2's verify-relations.ts.
  const file = await prisma.file.create({
    data: {
      filename,
      size: BigInt(fileBytes.length),
      contentType: "application/octet-stream",
      checksum: fileChecksum,
      chunkSize: CHUNK_SIZE,
      totalChunks: chunks.length,
      status: "UPLOADING",
      chunks: {
        create: chunks.map((c) => ({
          chunkNumber: c.chunkNumber,
          size: c.size,
          checksum: c.checksum,
        })),
      },
    },
    include: { chunks: true },
  });

  console.log(`Created File ${file.id} with ${file.chunks.length} chunk rows.`);

  // For each chunk, find its target nodes, upload to all of them,
  // and record each successful replica in the database.
  for (const chunk of chunks) {
    const dbChunk = file.chunks.find((c) => c.chunkNumber === chunk.chunkNumber)!;
    const globalChunkId = `${file.id}-chunk-${chunk.chunkNumber}`;
    const targetNodes = ring.getNodes(globalChunkId, REPLICATION_FACTOR);

    console.log(`Chunk ${chunk.chunkNumber} -> nodes: [${targetNodes.join(", ")}]`);

    for (const nodeId of targetNodes) {
      const uploadResult = await uploadChunkToNode(nodeId, globalChunkId, chunk.data);

      if (uploadResult.checksum !== chunk.checksum) {
        throw new Error(
          `Checksum mismatch uploading chunk ${chunk.chunkNumber} to ${nodeId}`,
        );
      }

      const nodeDbId = await resolveNodeDbId(nodeId);

      await prisma.chunkReplica.upsert({
        where: {
          chunkId_storageNodeId: {
            chunkId: dbChunk.id,
            storageNodeId: nodeDbId,
          },
        },
        update: { status: "HEALTHY" },
        create: {
          chunkId: dbChunk.id,
          storageNodeId: nodeDbId,
          status: "HEALTHY",
        },
      });

      console.log(`  -> recorded replica on ${nodeId} (db id ${nodeDbId})`);
    }
  }

  // Now that every chunk has its required replicas, mark the file
  // as fully uploaded. This is our concrete definition of "successful
  // upload," per your spec's requirement to define that clearly.
  await prisma.file.update({
    where: { id: file.id },
    data: { status: "UPLOADED" },
  });

  console.log(`File ${file.id} marked UPLOADED.`);
  return file.id;
}