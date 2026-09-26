import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Create a StorageNode — represents a node that will hold data
  const node = await prisma.storageNode.create({
    data: {
      host: "storage-node-1",
      port: 9001,
      capacity: 10_737_418_240n, // 10 GB, as a BigInt
    },
  });
  console.log("Created node:", node);

  // 2. Create a File AND its Chunks in a single transaction.
  //    This is the important part: if chunk creation fails partway,
  //    the whole thing rolls back — no orphaned File with 0 chunks.
  const file = await prisma.file.create({
    data: {
      filename: "sales.csv",
      size: 4096n,
      contentType: "text/csv",
      checksum: "dummy-checksum",
      chunkSize: 1024,
      totalChunks: 4,
      chunks: {
        create: [
          { chunkNumber: 0, size: 1024, checksum: "chunk-0-hash" },
          { chunkNumber: 1, size: 1024, checksum: "chunk-1-hash" },
          { chunkNumber: 2, size: 1024, checksum: "chunk-2-hash" },
          { chunkNumber: 3, size: 1024, checksum: "chunk-3-hash" },
        ],
      },
    },
    include: { chunks: true },
  });
  console.log("Created file with chunks:", file);

  // 3. Assign a replica of chunk 0 to our storage node
  const replica = await prisma.chunkReplica.create({
    data: {
      chunkId: file.chunks[0].id,
      storageNodeId: node.id,
      status: "HEALTHY",
    },
  });
  console.log("Created replica:", replica);

  // 4. Prove the relationship query works: "give me this file,
  //    with all its chunks, and each chunk's replicas, and each
  //    replica's node" — a 3-level nested join.
  const fullFile = await prisma.file.findUnique({
    where: { id: file.id },
    include: {
      chunks: {
        include: {
          replicas: {
            include: { storageNode: true },
          },
        },
      },
    },
  });
  console.log(
  "Full nested file:",
  JSON.stringify(fullFile, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  2)
);

  // 5. Prove the unique constraint is enforced: try to create a
  //    duplicate chunkNumber for the same file — this SHOULD fail.
  try {
    await prisma.chunk.create({
      data: {
        fileId: file.id,
        chunkNumber: 0, // duplicate!
        size: 1024,
        checksum: "duplicate-attempt",
      },
    });
    console.error("BUG: duplicate chunkNumber was allowed — constraint not working!");
  } catch (err) {
    console.log("Correctly rejected duplicate chunkNumber (constraint working).");
  }
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });