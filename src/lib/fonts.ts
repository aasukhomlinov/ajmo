/**
 * TikTok Sans — shipped as STATIC cuts instanced from the variable master
 * (assets/fonts/TikTokSans-Variable.ttf, OFL) by scripts/build-fonts.py, because
 * RN can't drive variable axes (wght/wdth/opsz) at runtime. Each cut bakes in a
 * weight + width and is registered as its own family in src/app/_layout.tsx.
 *
 * Do NOT reference these family names directly in components — render text
 * through the Text primitive (@/ui/Text) with a `variant`; the typography
 * presets in src/lib/theme.ts map each variant to the right cut.
 */
export const fonts = {
  display: 'TikTokSans-Display',
  h1: 'TikTokSans-H1',
  h2: 'TikTokSans-H2',
  body: 'TikTokSans-Body',
  caption: 'TikTokSans-Caption',
  button: 'TikTokSans-Button',
  section: 'TikTokSans-Section',
} as const;
