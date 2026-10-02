import { producer } from "./kafka-client.js";

async function main() {
  await producer.connect();
  console.log("Connected to Kafka.");

  await producer.send({
    topic: "file.uploaded",
    messages: [
      { value: JSON.stringify({ fileId: "test-123", filename: "test.csv", totalChunks: 4 }) },
    ],
  });

  console.log("Message sent to topic 'file.uploaded'.");

  await producer.disconnect();
  console.log("Disconnected.");
}

main().catch((err) => {
  console.error("Kafka producer test failed:", err);
  process.exitCode = 1;
});