/**
 * Generates the iOS tab-bar icon PNGs in assets/tab-icons/ from the SAME
 * Phosphor glyphs the rest of the app uses (phosphor-react-native).
 *
 * Why this exists: Expo Router native tabs render the real iOS Liquid Glass
 * bar, but that bar can only take SF Symbols or raster image assets as icons —
 * it cannot render a Phosphor (react-native-svg) component. To keep brand
 * consistency with the Phosphor set used everywhere else, we rasterize the
 * Phosphor path data to TEMPLATE PNGs (@1x/2x/3x, outline + fill per tab) and
 * feed those to NativeTabs. iOS tints the template masks (selected/idle) for us.
 * The Android custom bar (src/ui/TabBar.tsx) uses the live Phosphor components
 * directly and does NOT need these assets.
 *
 * Source of truth: the `d` strings are read straight from
 * node_modules/phosphor-react-native/src/defs/<Icon>.tsx, so bumping Phosphor
 * and re-running keeps the assets in sync — no hand-copied paths.
 *
 * Pipeline (zero extra deps):
 *  1. write an SVG with a BLACK glyph (no background),
 *  2. rasterize with macOS `qlmanage` (Quick Look) — but Quick Look flattens
 *     SVG transparency onto an OPAQUE WHITE matte, which is useless as a template
 *     mask, so…
 *  3. recover a real alpha mask in Node: black glyph → opaque, white matte →
 *     transparent (alpha = 255 − luminance, anti-aliased edges preserved), RGB
 *     forced to white. iOS template rendering uses only the alpha channel.
 * PNG decode/encode is done with the built-in `zlib` (no image library).
 *
 * Run from the repo root: npm run generate-tab-icons   (macOS only)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const DEFS_DIR = path.join(ROOT, 'node_modules', 'phosphor-react-native', 'src', 'defs');
const OUT_DIR = path.join(ROOT, 'assets', 'tab-icons');

// Phosphor viewBox is a fixed 256-unit square.
const VIEWBOX = 256;
// Density buckets. Base point size = 24 (matches the DS TabBar icon size).
const SIZES: { suffix: string; px: number }[] = [
  { suffix: '', px: 24 },
  { suffix: '@2x', px: 48 },
  { suffix: '@3x', px: 72 },
];

// asset basename -> phosphor def file (each emits an outline + a -fill variant).
const ICONS: { name: string; def: string }[] = [
  { name: 'compass', def: 'Compass' },
  { name: 'bookmark', def: 'BookmarkSimple' },
  { name: 'user', def: 'User' },
];

if (process.platform !== 'darwin') {
  console.error('build-tab-icons: qlmanage is macOS-only. Run this on macOS.');
  process.exit(1);
}

/** Pull the `d="…"` of a given weight out of a Phosphor def file. */
function extractPath(defSource: string, weight: 'regular' | 'fill'): string {
  // Each weight is an array entry: `'regular',` … then the first `<Path d="…"`.
  const weightIdx = defSource.indexOf(`'${weight}'`);
  if (weightIdx === -1) throw new Error(`weight '${weight}' not found`);
  const after = defSource.slice(weightIdx);
  const match = after.match(/d="([^"]+)"/);
  if (!match) throw new Error(`no path data after weight '${weight}'`);
  return match[1];
}

function svgFor(d: string): string {
  // BLACK glyph, no background — qlmanage mattes the transparent area to white,
  // which step 3 turns back into alpha.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWBOX}" height="${VIEWBOX}" ` +
    `viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"><path fill="#000000" d="${d}"/></svg>`
  );
}

// --- minimal PNG codec (RGBA, 8-bit, no interlace) over zlib --------------

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Decode an 8-bit PNG (any color type qlmanage emits) to flat RGBA. */
function decodePng(buf: Buffer): { width: number; height: number; rgba: Buffer } {
  let p = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const recon = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const pp = a + b - c;
    const da = Math.abs(pp - a);
    const db = Math.abs(pp - b);
    const dc = Math.abs(pp - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++];
      const a = x >= ch ? recon[y * stride + x - ch] : 0;
      const b = y > 0 ? recon[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? recon[(y - 1) * stride + x - ch] : 0;
      let r: number;
      switch (ft) {
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: r = v + paeth(a, b, c); break;
        default: r = v;
      }
      recon[y * stride + x] = r & 0xff;
    }
  }
  // expand to RGBA
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * ch;
    let rr: number, gg: number, bb: number, aa: number;
    if (ch >= 3) {
      rr = recon[s]; gg = recon[s + 1]; bb = recon[s + 2]; aa = ch === 4 ? recon[s + 3] : 255;
    } else {
      rr = gg = bb = recon[s]; aa = ch === 2 ? recon[s + 1] : 255;
    }
    rgba[i * 4] = rr; rgba[i * 4 + 1] = gg; rgba[i * 4 + 2] = bb; rgba[i * 4 + 3] = aa;
  }
  return { width, height, rgba };
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** qlmanage (black-on-white) -> transparent white template mask. */
function toTemplateMask(qlPng: Buffer): Buffer {
  const { width, height, rgba } = decodePng(qlPng);
  for (let i = 0; i < width * height; i++) {
    // grayscale (r==g==b for our black/white render); alpha = darkness.
    const alpha = 255 - rgba[i * 4];
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = alpha;
  }
  return encodePng(width, height, rgba);
}

function rasterize(svg: string, outBase: string): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajmo-tabicon-'));
  try {
    const svgPath = path.join(tmpDir, `${outBase}.svg`);
    fs.writeFileSync(svgPath, svg);
    for (const { suffix, px } of SIZES) {
      execFileSync('qlmanage', ['-t', '-s', String(px), '-o', tmpDir, svgPath], {
        stdio: 'ignore',
      });
      const produced = path.join(tmpDir, `${outBase}.svg.png`);
      if (!fs.existsSync(produced)) throw new Error(`qlmanage produced no PNG for ${outBase}`);
      const mask = toTemplateMask(fs.readFileSync(produced));
      fs.writeFileSync(path.join(OUT_DIR, `${outBase}${suffix}.png`), mask);
      fs.rmSync(produced, { force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const { name, def } of ICONS) {
  const defPath = path.join(DEFS_DIR, `${def}.tsx`);
  const source = fs.readFileSync(defPath, 'utf8');
  rasterize(svgFor(extractPath(source, 'regular')), name); // idle / default
  rasterize(svgFor(extractPath(source, 'fill')), `${name}-fill`); // selected
  count += 2;
  console.log(`✓ ${name} (outline + fill)`);
}

console.log(`\nGenerated ${count} glyphs × ${SIZES.length} densities → ${path.relative(ROOT, OUT_DIR)}/`);
