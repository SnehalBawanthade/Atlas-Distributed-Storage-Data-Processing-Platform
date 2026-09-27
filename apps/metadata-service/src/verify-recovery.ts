import { recoverNode } from "./recover-node.js";

const nodeId = process.argv[2];
if (!nodeId) {
  console.error("Usage: npx tsx src/verify-recovery.ts <nodeId>");
  process.exit(1);
}

recoverNode(nodeId).catch(console.error);