import { getNodeAddress } from "./node-registry.js";

export interface UploadResult {
  nodeId: string;
  chunkId: string;
  size: number;
  checksum: string;
}

/**
 * Sends a chunk's raw bytes to a specific storage node's internal API.
 * Uses Node's built-in fetch (available natively since Node 18+ —
 * no extra HTTP client library needed for this).
 */
export async function uploadChunkToNode(
  nodeId: string,
  chunkId: string,
  data: Buffer,
): Promise<UploadResult> {
  const baseUrl = getNodeAddress(nodeId);
  const url = `${baseUrl}/internal/chunks/${chunkId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(data),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to upload chunk ${chunkId} to ${nodeId}: ${response.status} ${body}`,
    );
  }

  const result = (await response.json()) as {
    chunkId: string;
    size: number;
    checksum: string;
  };

  return { nodeId, ...result };
}