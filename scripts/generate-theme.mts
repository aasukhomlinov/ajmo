/**
 * Generates src/lib/theme.ts from design-tokens.json (repo root).
 *
 * design-tokens.json follows the W3C Design Tokens draft format:
 * groups of { "$type": ..., "$value": ... } leaves, with optional
 * aliases written as "{path.to.token}". Expected top-level groups:
 * color(s), spacing/space, radius/radii, shadow(s), typography.
 *
 * Run from the repo root: npm run generate-theme
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TOKENS_PATH = path.join(ROOT, 'design-tokens.json');
const OUT_PATH = path.join(ROOT, 'src', 'lib', 'theme.ts');

if (!fs.existsSync(TOKENS_PATH)) {
  console.error(
    [
      '✖ generate-theme: design-tokens.json not found at the repo root.',
      '',
      '  This file is the design-system source of truth and is created in the',
      '  design-direction phase (see CLAUDE.md). Until it exists, the app theme',
      '  cannot be generated — do not hand-write src/lib/theme.ts.',
      '',
      `  Expected location: ${TOKENS_PATH}`,
    ].join('\n'),
  );
  process.exit(1);
}

type TokenLeaf = { $type?: string; $value: unknown; $description?: string };
type TokenNode = TokenLeaf | { [key: string]: TokenNode };

const tokens: Record<string, TokenNode> = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));

function isLeaf(node: TokenNode): node is TokenLeaf {
  return typeof node === 'object' && node !== null && '$value' in node;
}

/** Look up a token by dot path, e.g. "color.bg.primary". */
function getByPath(dotPath: string): TokenLeaf {
  let node: TokenNode = tokens as unknown as TokenNode;
  for (const part of dotPath.split('.')) {
    node = (node as Record<string, TokenNode>)[part];
    if (node === undefined) {
      throw new Error(`Alias "{${dotPath}}" does not resolve to a token`);
    }
  }
  if (!isLeaf(node)) throw new Error(`Alias "{${dotPath}}" points to a group, not a token`);
  return node;
}

/** Resolve "{path.to.token}" aliases, recursively, with a cycle guard. */
function resolveValue(value: unknown, seen: string[] = []): unknown {
  if (typeof value === 'string') {
    const match = value.match(/^\{(.+)\}$/);
    if (match) {
      const target = match[1];
      if (seen.includes(target)) {
        throw new Error(`Circular token alias: ${[...seen, target].join(' -> ')}`);
      }
      return resolveValue(getByPath(target).$value, [...seen, target]);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, seen));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveValue(v, seen)]),
    );
  }
  return value;
}

/** "16px" | 16 | { value: 16, unit: "px" } -> 16 (RN density-independent px). */
function toNumber(value: unknown, context: string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/^(-?\d*\.?\d+)(px)?$/);
    if (match) return parseFloat(match[1]);
  }
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const dim = value as { value: number; unit?: string };
    if (dim.unit && dim.unit !== 'px') {
      throw new Error(`${context}: unsupported unit "${dim.unit}" (only px)`);
    }
    return dim.value;
  }
  throw new Error(`${context}: cannot convert ${JSON.stringify(value)} to a number`);
}

/** Walk a group and map each leaf through `transform`, preserving nesting. */
function mapGroup(
  node: TokenNode | undefined,
  transform: (value: unknown, tokenPath: string) => unknown,
  prefix = '',
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!node) return out;
  for (const [key, child] of Object.entries(node) as [string, TokenNode][]) {
    if (key.startsWith('$')) continue;
    const tokenPath = prefix ? `${prefix}.${key}` : key;
    out[key] = isLeaf(child)
      ? transform(resolveValue(child.$value), tokenPath)
      : mapGroup(child, transform, tokenPath);
  }
  return out;
}

function pickGroup(...names: string[]): TokenNode | undefined {
  for (const name of names) {
    if (tokens[name]) return tokens[name];
  }
  return undefined;
}

// W3C shadow -> React Native shadow style (+ Android elevation heuristic).
function toShadow(value: unknown, tokenPath: string) {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'object' || first === null) {
    throw new Error(`${tokenPath}: expected a shadow object`);
  }
  const s = first as Record<string, unknown>;
  const blur = toNumber(s.blur ?? 0, `${tokenPath}.blur`);
  return {
    shadowColor: s.color ?? '#000000',
    shadowOffset: {
      width: toNumber(s.offsetX ?? 0, `${tokenPath}.offsetX`),
      height: toNumber(s.offsetY ?? 0, `${tokenPath}.offsetY`),
    },
    shadowOpacity: 1, // opacity is expected to live in the color's alpha channel
    shadowRadius: blur / 2,
    elevation: Math.max(1, Math.round(blur / 2)),
  };
}

// Token textCase -> RN textTransform. Baking case into the preset lets a variant
// (e.g. sectionHeader) render uppercase without a per-call-site override.
const TEXT_CASE: Record<string, string> = {
  upper: 'uppercase',
  uppercase: 'uppercase',
  lower: 'lowercase',
  lowercase: 'lowercase',
  title: 'capitalize',
  capitalize: 'capitalize',
  none: 'none',
};

// Each preset renders through a STATIC cut instanced from the variable master
// (scripts/build-fonts.py) — RN can't drive wght/wdth/opsz at runtime. Weight
// and width are baked into the face, so we emit only the family name here (no
// fontWeight: it would make Android faux-bold an already-bold cut). Keep this
// map in sync with CUTS in build-fonts.py; bodySmall reuses the Body cut.
const CUT_FAMILY: Record<string, string> = {
  display: 'TikTokSans-Display',
  h1: 'TikTokSans-H1',
  h2: 'TikTokSans-H2',
  body: 'TikTokSans-Body',
  bodySmall: 'TikTokSans-Body',
  caption: 'TikTokSans-Caption',
  button: 'TikTokSans-Button',
  sectionHeader: 'TikTokSans-Section',
};

// W3C typography -> React Native TextStyle preset.
function toTypography(value: unknown, tokenPath: string) {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${tokenPath}: expected a typography object`);
  }
  const t = value as Record<string, unknown>;
  const fontSize = toNumber(t.fontSize, `${tokenPath}.fontSize`);
  const fontFamily = CUT_FAMILY[tokenPath];
  if (!fontFamily) {
    throw new Error(
      `${tokenPath}: no static cut mapped. Add it to CUT_FAMILY (here) and to ` +
        `CUTS in scripts/build-fonts.py, then run: npm run generate-fonts`,
    );
  }
  const preset: Record<string, unknown> = { fontSize, fontFamily };
  if (t.lineHeight !== undefined) {
    // Unitless lineHeight is a multiplier; RN wants absolute px.
    const lh = t.lineHeight;
    preset.lineHeight =
      typeof lh === 'number' ? Math.round(lh * fontSize) : toNumber(lh, `${tokenPath}.lineHeight`);
  }
  if (t.letterSpacing !== undefined) {
    preset.letterSpacing = toNumber(t.letterSpacing, `${tokenPath}.letterSpacing`);
  }
  if (t.textCase !== undefined) {
    const transform = TEXT_CASE[String(t.textCase).toLowerCase()];
    if (!transform) {
      throw new Error(`${tokenPath}.textCase: unsupported value "${String(t.textCase)}"`);
    }
    preset.textTransform = transform;
  }
  // Variable-font axes (wght/wdth/opsz) are baked into the static cut, not
  // emitted: RN ignores fontVariationSettings, and the family carries them.
  return preset;
}

const theme = {
  colors: mapGroup(pickGroup('color', 'colors'), (v) => v),
  spacing: mapGroup(pickGroup('spacing', 'space'), (v, p) => toNumber(v, p)),
  radii: mapGroup(pickGroup('radius', 'radii', 'borderRadius'), (v, p) => toNumber(v, p)),
  shadows: mapGroup(pickGroup('shadow', 'shadows'), toShadow),
  typography: mapGroup(pickGroup('typography', 'type'), toTypography),
  // Liquid Glass constants (Android TabBar fallback; iOS uses the native bar).
  glass: mapGroup(pickGroup('glass'), (v, p) =>
    p === 'blur' ? toNumber(v, p) : toShadow(v, p),
  ),
};

const KNOWN_GROUPS = new Set([
  'color', 'colors', 'spacing', 'space', 'radius', 'radii', 'borderRadius',
  'shadow', 'shadows', 'typography', 'type', 'glass',
]);
for (const name of Object.keys(tokens)) {
  if (!name.startsWith('$') && !KNOWN_GROUPS.has(name)) {
    console.warn(`⚠ generate-theme: skipping unknown top-level group "${name}"`);
  }
}

const output = `// AUTO-GENERATED from design-tokens.json — do not edit by hand.
// Regenerate with: npm run generate-theme

export const theme = ${JSON.stringify(theme, null, 2)} as const;

export type Theme = typeof theme;
export type ThemeColors = Theme['colors'];
export type ThemeSpacing = Theme['spacing'];
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, output);
console.log(`✔ generate-theme: wrote ${path.relative(ROOT, OUT_PATH)}`);
