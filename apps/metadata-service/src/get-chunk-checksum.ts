import { prisma } from "./resolve-node.js";

const fileId = process.argv[2];
const chunkNumber = Number(process.argv[3]);

async function main() {
  const chunk = await prisma.chunk.findFirst({
    where: { fileId, chunkNumber },
  });
  console.log(chunk?.checksum);
}

main();