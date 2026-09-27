import { prisma } from "./resolve-node.js";

const FILE_ID = process.argv[2];

async function main() {
  const file = await prisma.file.findUnique({
    where: { id: FILE_ID },
    include: {
      chunks: {
        include: {
          replicas: {
            include: { storageNode: true },
          },
        },
        orderBy: { chunkNumber: "asc" },
      },
    },
  });

  if (!file) {
    console.log("File not found.");
    return;
  }

  console.log(`File: ${file.filename} (${file.status})`);
  for (const chunk of file.chunks) {
    const nodeNames = chunk.replicas.map((r) => `${r.storageNode.host} (${r.status})`);
    console.log(`  Chunk ${chunk.chunkNumber}: replicas on [${nodeNames.join(", ")}]`);
  }
}

main().catch(console.error);