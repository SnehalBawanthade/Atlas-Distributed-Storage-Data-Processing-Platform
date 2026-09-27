import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Looks up a storage node's real database row by its logical node ID
 * (e.g. "storage-node-2"), which we store as `host` on the StorageNode
 * table. Throws if the node has never sent a heartbeat, since that
 * means we have no database record for it at all.
 */
export async function resolveNodeDbId(nodeId: string): Promise<string> {
  const node = await prisma.storageNode.findFirst({
    where: { host: nodeId },
  });

  if (!node) {
    throw new Error(
      `No StorageNode record found for "${nodeId}" — has it sent a heartbeat yet?`,
    );
  }

  return node.id;
}

export { prisma };