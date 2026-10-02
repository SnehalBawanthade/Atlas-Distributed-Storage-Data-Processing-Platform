import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "atlas-metadata-service",
  brokers: ["localhost:9092"],
});

export const producer = kafka.producer();

export function createConsumer(groupId: string) {
  return kafka.consumer({ groupId });
}