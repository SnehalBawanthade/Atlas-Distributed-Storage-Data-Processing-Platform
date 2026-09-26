import { chunkFile } from "@atlas/shared";

async function main() {
  const chunks = await chunkFile("../../big-test-file.txt", 4096); // 4KB chunks

  console.log(`Split into ${chunks.length} chunks:`);
  for (const chunk of chunks) {
    console.log(
      `  chunk ${chunk.chunkNumber}: ${chunk.size} bytes, checksum ${chunk.checksum.slice(0, 12)}...`,
    );
  }

  const totalBytes = chunks.reduce((sum, c) => sum + c.size, 0);
  console.log(`Total bytes across all chunks: ${totalBytes}`);
}

main().catch((err) => {
  console.error("Chunking verification failed:", err);
  process.exitCode = 1;
});