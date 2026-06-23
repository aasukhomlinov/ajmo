/**
 * Generates the iOS tab-bar icon PNGs in assets/tab-icons/ from the SAME
 * Phosphor glyphs the rest of the app uses (phosphor-react-native).
 *
 * Why this exists: Expo Router native tabs render the real iOS Liquid Glass
 * bar, but that bar can only take SF Symbols or raster image assets as icons —
 * it cannot render a Phosphor (react-native-svg) component. To keep brand
 * consistency with the Phosphor set used everywhere else, we rasterize the
 * Phosphor path data to template PNGs (@1x/2x/3x, outline + fill per tab) and
 * feed those to NativeTabs. iOS tints the template masks (selected/idle) for us.
 * The Android custom bar (src/ui/TabBar.tsx) uses the live Phosphor components
 * directly and does NOT need these assets.
 *
 * Source of truth: the `d` strings are read straight from
 * node_modules/phosphor-react-native/src/defs/<Icon>.tsx, so bumping Phosphor
 * and re-running keeps the assets in sync — no hand-copied paths.
 *
 * Rasterizer: macOS `qlmanage` (Quick Look, built-in) — zero extra deps.
 * Run from the repo root: npm run generate-tab-icons   (macOS only)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  // White fill = template mask; iOS recolors via the tab bar tint. The alpha
  // channel carries the shape, so the literal colour is irrelevant on iOS.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWBOX}" height="${VIEWBOX}" ` +
    `viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"><path fill="#FFFFFF" d="${d}"/></svg>`
  );
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
      fs.renameSync(produced, path.join(OUT_DIR, `${outBase}${suffix}.png`));
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
