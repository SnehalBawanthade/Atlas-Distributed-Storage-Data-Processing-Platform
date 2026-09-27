import { HashRing } from "@atlas/hashing";
import { prisma } from "./resolve-node.js";

export async function buildHealthyRing(): Promise<HashRing> {
  const healthyNodes = await prisma.storageNode.findMany({
    where: { status: "HEALTHY" },
  });

  const ring = new HashRing(100);
  for (const node of healthyNodes) {
    ring.addNode(node.host); // host stores our logical node ID, e.g. "storage-node-2"
  }

  return ring;
}