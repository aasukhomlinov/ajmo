// Cover perceptual hash (dHash): 9×8 luma gradient → 64 bits hex. A reworded
// repost almost always reuses the same poster, so hash closeness is a strong
// dedup signal; distinct sub-events of one festival usually have different
// posters. Computed ONCE per image — at rehost time in parse-venue's `covers`
// phase (bytes already in memory), or incrementally by dedup-events for
// pre-existing rows. JPEG decode is CPU-heavy on edge workers (a ~250-image
// batch hit WORKER_RESOURCE_LIMIT), so callers must bound how many images
// they decode per invocation.

import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const MAX_DECODE_BYTES = 8_000_000; // decode cost scales with pixels; skip monsters

export async function dhashBytes(bytes: Uint8Array): Promise<string | null> {
  try {
    if (bytes.length > MAX_DECODE_BYTES) return null;
    const img = await Image.decode(bytes);
    const small = img.resize(9, 8);
    const luma = (p: number) =>
      0.299 * ((p >> 24) & 0xff) + 0.587 * ((p >> 16) & 0xff) + 0.114 * ((p >> 8) & 0xff);
    let bits = 0n;
    for (let y = 1; y <= 8; y++) {
      for (let x = 1; x <= 8; x++) {
        bits = (bits << 1n) |
          (luma(small.getPixelAt(x, y)) < luma(small.getPixelAt(x + 1, y)) ? 1n : 0n);
      }
    }
    return bits.toString(16).padStart(16, '0');
  } catch {
    return null; // undecodable image = no cover signal, never an abort
  }
}

export async function dhashUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return await dhashBytes(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

export function hamming(a: string, b: string): number {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}
