import { createConsumer } from "./kafka-client.js";

async function main() {
  const consumer = createConsumer("atlas-workers");

  await consumer.connect();
  console.log("Consumer connected.");

  await consumer.subscribe({ topic: "file.uploaded", fromBeginning: true });
  console.log("Subscribed to 'file.uploaded'. Waiting for messages...\n");

  await consumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value?.toString();
      console.log("Received message:", value);
    },
  });
}

main().catch((err) => {
  console.error("Kafka consumer failed:", err);
  process.exitCode = 1;
});