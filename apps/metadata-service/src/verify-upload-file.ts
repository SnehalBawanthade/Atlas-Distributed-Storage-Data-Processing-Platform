import { uploadFile } from "./upload-file.js";

async function main() {
  const fileId = await uploadFile("../../big-test-file.txt", "big-test-file.txt");
  console.log(`\nDone. File ID: ${fileId}`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exitCode = 1;
});