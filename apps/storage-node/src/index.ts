import Fastify from "fastify";
import { createHash } from "node:crypto";
import { createWriteStream, createReadStream, existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const NODE_ID = process.env.NODE_ID ?? "storage-node-1";
const PORT = Number(process.env.PORT ?? 9001);
const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data/chunks");
const METADATA_SERVICE_URL = process.env.METADATA_SERVICE_URL ?? "http://localhost:8080";
const HEARTBEAT_INTERVAL_MS = 5000; // send a heartbeat every 5 seconds

const app = Fastify({ logger: true });
// We handle raw binary uploads ourselves via request.raw — tell Fastify
// not to attempt to parse application/octet-stream bodies at all.
app.addContentTypeParser(
  "application/octet-stream",
  (request, payload, done) => {
    done(null);
  }
);

// Ensure the storage directory exists before we accept any traffic.
await mkdir(DATA_DIR, { recursive: true });

function chunkPath(chunkId: string): string {
  return path.join(DATA_DIR, chunkId);
}

app.get("/internal/health", async () => {
  return {
    nodeId: NODE_ID,
    status: "ok",
    timestamp: new Date().toISOString(),
  };
});

// Write a chunk's bytes to disk, streaming, while computing its SHA-256 checksum.
app.post("/internal/chunks/:chunkId", async (request, reply) => {
  const { chunkId } = request.params as { chunkId: string };
  const destPath = chunkPath(chunkId);

  const hash = createHash("sha256");
  let size = 0;

  const writeStream = createWriteStream(destPath);

  // Tap the incoming stream: every piece of data that flows through
  // also gets fed into the hash and counted toward size, without
  // ever holding the full body in memory.
  request.raw.on("data", (piece: Buffer) => {
    hash.update(piece);
    size += piece.length;
  });

  try {
    await pipeline(request.raw, writeStream);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Failed to write chunk to disk" });
  }

  return {
    chunkId,
    size,
    checksum: hash.digest("hex"),
  };
});

// Stream a chunk's bytes back out.
app.get("/internal/chunks/:chunkId", async (request, reply) => {
  const { chunkId } = request.params as { chunkId: string };
  const filePath = chunkPath(chunkId);

  if (!existsSync(filePath)) {
    return reply.code(404).send({ error: "Chunk not found" });
  }

  return reply.send(createReadStream(filePath));
});

// Remove a chunk from disk.
app.delete("/internal/chunks/:chunkId", async (request, reply) => {
  const { chunkId } = request.params as { chunkId: string };
  const filePath = chunkPath(chunkId);

  if (!existsSync(filePath)) {
    return reply.code(404).send({ error: "Chunk not found" });
  }

  await unlink(filePath);
  return { chunkId, deleted: true };
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Storage node "${NODE_ID}" listening at ${address}`);

  // Send an immediate heartbeat on startup, then repeat on an interval.
  sendHeartbeat();
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
});


async function sendHeartbeat() {
  try {
    // For now, capacity/usedCapacity are placeholder values — we'll
    // compute real disk usage in a later refinement. The point of
    // this step is proving the heartbeat mechanism itself works.
    const response = await fetch(`${METADATA_SERVICE_URL}/internal/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId: NODE_ID,
        host: NODE_ID,
        port: PORT,
        capacity: "10737418240", // 10 GB placeholder
        usedCapacity: "0",
      }),
    });

    if (!response.ok) {
      app.log.warn(`Heartbeat failed with status ${response.status}`);
    } else {
      app.log.info("Heartbeat sent successfully");
    }
  } catch (err) {
    app.log.error({ err }, "Failed to send heartbeat");
  }
}