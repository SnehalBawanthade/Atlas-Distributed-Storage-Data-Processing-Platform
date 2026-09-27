import { fnv1a } from "@atlas/hashing";

for (let i = 0; i < 10; i++) {
  const key = `chunk-${i}`;
  console.log(`${key}: hash=${fnv1a(key)}`);
}