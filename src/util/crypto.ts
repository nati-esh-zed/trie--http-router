import { encodeHex } from "jsr:@std/encoding/hex";
import { brotliCompressSync, type BrotliOptions } from "node:zlib";

export function hash(
  data: string | Uint8Array | BufferSource,
  algorithm?: AlgorithmIdentifier | "SHA-256",
) {
  algorithm = algorithm || "SHA-256";
  const buffer = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data;
  const hashBuffer = crypto.subtle.digest(algorithm, buffer);
  return hashBuffer;
}

export async function hashString(text: string) {
  const textBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", textBuffer);
  const hash = encodeHex(hashBuffer);
  return hash;
}

export function compress(
  data: Uint8Array,
  format: CompressionFormat | "brotli",
  options?: BrotliOptions,
) {
  if (format === "brotli") {
    return new Promise<Uint8Array>((resolve) =>
      resolve(new Uint8Array(brotliCompressSync(data, options)))
    );
  } else {
    const compressionStream = new CompressionStream(format);
    const writer = compressionStream.writable.getWriter();
    writer.write(data);
    writer.close();
    return compressionStream.readable
      .getReader()
      .read()
      .then((r) => r.value);
  }
}
