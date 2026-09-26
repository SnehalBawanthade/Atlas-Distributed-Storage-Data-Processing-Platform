import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

export interface FileChunk {
  chunkNumber: number;
  size: number;
  checksum: string;
  data: Buffer;
}

/**
 * Reads a file as a stream and splits it into fixed-size chunks.
 * Each chunk's checksum is computed as its bytes are assembled,
 * mirroring how the storage node computes checksums on write.
 */
export async function chunkFile(
  filePath: string,
  chunkSize: number,
): Promise<FileChunk[]> {
  const chunks: FileChunk[] = [];

  let chunkNumber = 0;
  let buffer: Buffer[] = [];
  let bufferedBytes = 0;

  function flushChunk() {
    if (bufferedBytes === 0) return;

    const data = Buffer.concat(buffer, bufferedBytes);
    const checksum = createHash("sha256").update(data).digest("hex");

    chunks.push({
      chunkNumber,
      size: data.length,
      checksum,
      data,
    });

    chunkNumber += 1;
    buffer = [];
    bufferedBytes = 0;
  }

  const readStream = createReadStream(filePath, {
    highWaterMark: chunkSize,
  });

  for await (const piece of readStream) {
    const pieceBuf = piece as Buffer;
    let offset = 0;

    // A single piece from the stream might not align exactly with
    // our chunk boundary, so we may need to split it across two chunks.
    while (offset < pieceBuf.length) {
      const spaceLeftInChunk = chunkSize - bufferedBytes;
      const bytesToTake = Math.min(spaceLeftInChunk, pieceBuf.length - offset);

      buffer.push(pieceBuf.subarray(offset, offset + bytesToTake));
      bufferedBytes += bytesToTake;
      offset += bytesToTake;

      if (bufferedBytes === chunkSize) {
        flushChunk();
      }
    }
  }

  // Any leftover bytes that didn't fill a complete chunk (the last,
  // smaller chunk of the file) still need to be flushed.
  flushChunk();

  return chunks;
}