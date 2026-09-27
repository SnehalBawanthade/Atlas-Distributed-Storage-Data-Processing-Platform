import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.PORT ?? 8080);
const prisma = new PrismaClient();

const app = Fastify({ logger: true });

interface HeartbeatBody {
  nodeId: string;
  host: string;
  port: number;
  capacity: string; // sent as string since BigInt isn't native JSON
  usedCapacity: string;
}

app.post("/internal/heartbeat", async (request, reply) => {
  const body = request.body as HeartbeatBody;

  // upsert: create the node if we've never seen it before,
  // otherwise update its existing row. This makes heartbeats
  // idempotent and self-registering — a node doesn't need a
  // separate "register" step before it can start heartbeating.
  const node = await prisma.storageNode.upsert({
    where: { host_port: { host: body.host, port: body.port } },
    update: {
      status: "HEALTHY",
      lastHeartbeat: new Date(),
      capacity: BigInt(body.capacity),
      usedCapacity: BigInt(body.usedCapacity),
    },
    create: {
      host: body.host,
      port: body.port,
      status: "HEALTHY",
      lastHeartbeat: new Date(),
      capacity: BigInt(body.capacity),
      usedCapacity: BigInt(body.usedCapacity),
    },
  });

  return {
    nodeId: body.nodeId,
    status: node.status,
    lastHeartbeat: node.lastHeartbeat,
  };
});

app.get("/internal/nodes", async () => {
  const nodes = await prisma.storageNode.findMany();
  // Convert BigInt fields to strings so JSON.stringify doesn't crash
  // (the same gotcha we hit back in Phase 2).
  return nodes.map((n) => ({
    ...n,
    capacity: n.capacity.toString(),
    usedCapacity: n.usedCapacity.toString(),
  }));
});

const HEARTBEAT_TIMEOUT_MS = 15_000; // mark unhealthy after 15s of silence
const SWEEP_INTERVAL_MS = 5000; // check every 5 seconds

async function sweepUnhealthyNodes() {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

  const result = await prisma.storageNode.updateMany({
    where: {
      status: "HEALTHY",
      lastHeartbeat: { lt: cutoff },
    },
    data: {
      status: "UNHEALTHY",
    },
  });

  if (result.count > 0) {
    app.log.warn(`Marked ${result.count} node(s) as UNHEALTHY due to missed heartbeats`);
  }
}

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Metadata service listening at ${address}`);
   setInterval(sweepUnhealthyNodes, SWEEP_INTERVAL_MS);
});