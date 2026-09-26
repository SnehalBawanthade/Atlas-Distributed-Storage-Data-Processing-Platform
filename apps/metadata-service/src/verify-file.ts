import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const created = await prisma.file.create({
    data: {
      filename: "sample-dataset.csv",
      size: 1048576n, // BigInt literal — note the trailing 'n'
      contentType: "text/csv",
      checksum: "dummy-checksum-for-now",
      chunkSize: 262144,
      totalChunks: 4,
    },
  });

  console.log("Created file:", created);

  const fetched = await prisma.file.findUnique({
    where: { id: created.id },
  });

  console.log("Fetched back:", fetched);
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });