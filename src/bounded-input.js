import { readSync } from 'node:fs';

const READ_CHUNK_BYTES = 64 * 1024;

export function readBoundedFileDescriptor(fd, { maxBytes, label = 'input' }) {
  if (!Number.isSafeInteger(fd) || fd < 0) throw new TypeError('fd must be a non-negative integer');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError('maxBytes must be a non-negative safe integer');
  }

  const chunks = [];
  let totalBytes = 0;
  const scratch = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, maxBytes + 1));

  while (true) {
    const remainingWithProbe = (maxBytes - totalBytes) + 1;
    const bytesRead = readSync(
      fd,
      scratch,
      0,
      Math.min(scratch.length, remainingWithProbe),
      null,
    );

    if (bytesRead === 0) return Buffer.concat(chunks, totalBytes);
    if (bytesRead > maxBytes - totalBytes) {
      throw new RangeError(`${label} exceeds ${maxBytes} byte limit`);
    }

    chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
    totalBytes += bytesRead;
  }
}
