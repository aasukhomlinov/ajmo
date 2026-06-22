# Figma → React Native translation rules (ajmo)

How to turn the ajmo Figma design system into code in THIS repo. Applies to every
Figma-driven change. The Figma MCP returns **React + Tailwind** reference markup —
treat it as a description of layout/behavior, never paste it in. Convert it to our
React Native + Expo primitives and theme tokens.

## Connector & access (read first)

- Figma DS file key: `H5mzFcoh4EbVAkhNGFRJEx` (file "ajmo DS").
- IMPORTANT: use the **personal-account** Figma MCP connector (UUID prefix
  `6abba146-…`, account `soleil.alloveryou@gmail.com`). The server literally named
  `figma` is the work account and CANNOT access ajmo files.
- IMPORTANT: **Code Connect is unavailable** on this plan (ajmo's Figma team is Pro;
  Code Connect needs Org/Enterprise + a Developer seat). So `get_design_context`
  returns raw React+Tailwind markup, NOT our component names. The component registry
  below is our manual stand-in for Code Connect — consult it on every implementation.
- Personal connector budget ≈ 200 MCP calls/day. Batch reads; reuse results.

## Required flow (do not skip)

1. `get_design_context` for the exact node (correct connector). If truncated, use
   `get_metadata` for the node map, then re-fetch only the node(s) needed.
2. `get_screenshot` of the variant being built — keep it for the final compare.
3. Translate to our primitives + tokens (sections below). Do NOT install new deps.
4. `npx tsc --noEmit` and run the app; compare against the screenshot, list any
   discrepancies, fix before marking complete.

## Component organization

- Primitives → `src/ui/` (named export per file; `src/ui/index.ts` barrel).
  Built: `Text`, `Badge`, `Button`, `Chip`, `Cover`, `IconButton`,
  `SegmentedControl`, `Toggle`, `Checkbox`, `Radio`, `Header`, `Toast`, `Input`,
  `EmptyState`. TabBar is still pending (native Liquid Glass — see note below).
  Other DS components are built on demand.
- Composed / feature components → `src/features/<feature>/` (feed, search, event,
  saved, settings, auth, city — NO map feature). `EventCard` lives in
  `src/features/feed/EventCard.tsx`.
- IMPORTANT: place a component where its Figma component **description** says (each
  DS component description carries a `RN: <path>` line). Don't put composed cards in
  `src/ui/`.
- No default exports except Expo Router screens. Components small and typed.

## Styling & tokens

- IMPORTANT: all colors, spacing, radii, shadows, and typography come from
  `theme` in `@/lib/theme` (generated from `design-tokens.json`). Hardcoded style
  values are a bug. If a value is missing from the tokens, add it to
  `design-tokens.json` and regenerate (`npm run generate-theme`) — do not inline it.
- Use `StyleSheet.create`; reference `theme.colors.*`, `theme.spacing.*`,
  `theme.radii.*`, `theme.shadows.*`.
- The Figma vars in the MCP output mirror the token tree 1:1 — translate by name:
  | Figma MCP output | Use in code |
  |---|---|
  | `var(--theme.colors.accent.base)` | `theme.colors.accent.base` |
  | `var(--theme.colors.surface.raised)` | `theme.colors.surface.raised` |
  | `var(--theme.spacing.lg)` (px) | `theme.spacing.lg` |
  | `var(--theme.radii.md)` | `theme.radii.md` |
  | `rounded-[…]`, `px-`, `py-`, `gap-` | the matching `radii`/`spacing` token |
  | `shadow-[…]` / effect "Shadow/Card" | `...theme.shadows.card` (spread) |

## Typography

- IMPORTANT: never set `fontFamily` directly in components. Render text through the
  `Text` primitive (`@/ui/Text`) with a `variant` (`display | h1 | h2 | body |
  bodySmall | caption | button`) and an optional `color`.
- Map Figma text styles → `Text` variant: H1→`h1`, Body Small→`bodySmall`,
  Caption→`caption`, Button→`button`, etc.
- Variable-font axes (`wdth`/`opsz`) live in the font + tokens; RN applies `wght`
  via the preset. `caption` and `button` are uppercase by design — apply
  `textTransform: 'uppercase'` at the call site (Badge/Button already do).

## Icons — do NOT download icon vectors

- IMPORTANT: `get_design_context` returns icon glyphs as `img` vector URLs
  (`figma.com/api/mcp/asset/…`). DO NOT use those for icons and DO NOT create
  placeholders. Each Figma `Icon/*` component description names its
  `phosphor-react-native` icon — import that instead (e.g. `Icon/MapPin` →
  `import { MapPin } from 'phosphor-react-native'`).
- Outline (default weight) for idle, `weight="fill"` for active/selected states.
  Pass `size` + `color={theme.colors.text.*}`.

## Images, gradients, assets

- Photos/covers use `Image` from `expo-image` (`contentFit="cover"`). Placeholder
  surface = `theme.colors.surface.raised`.
- Gradients (e.g. cover scrim) use `react-native-svg` `LinearGradient` — we do not
  add `expo-linear-gradient`.
- Real raster/SVG assets that aren't icons: download with `download_assets` and
  store under `assets/`. (Most DS art is placeholder; prefer tokens + Phosphor.)

## Component registry (manual Code Connect)

When the Figma node is one of these, render OUR component — do not re-derive markup.

| Figma component | Node | Code | Key props |
|---|---|---|---|
| EventCard | `100:83` | `@/features/feed/EventCard` → `EventCard` | `title, venue, time, price, dateLabel?, category?, imageUrl?, state?: 'default'\|'going', onPress?, onToggleGoing?` |
| EventRow | `90:3` | `@/features/feed/EventRow` → `EventRow` | `title, venue, date, imageUrl?, badge?: { label, tone? }, onPress?` |
| Cover | `82:6` | `@/ui/Cover` → `Cover` | `imageUrl?, ratio?: '16:10'\|'16:9'\|'4:3'\|'1:1', showScrim?, showDateChip?, dateLabel?, showBadge?, categoryLabel?, borderRadius?` |
| Button | `51:2` | `@/ui/Button` → `Button` | `label, type?: 'primary'\|'secondary'\|'text', onPress?, disabled?, fullWidth?` (Figma State Pressed/Disabled → Pressable + `disabled`) |
| Badge | `79:13` | `@/ui/Badge` → `Badge` | `label, tone?: 'neutral'\|'accent'\|'success'\|'warning'\|'error'` |
| Chip | `53:7` | `@/ui/Chip` → `Chip` | `label, active?, leftIcon?: Icon (Phosphor component, 16px, auto-tinted to label / fill when active), onPress?` (interactive filter; Figma `ShowLeftIcon`/`LeftIcon` swap → presence of `leftIcon`) |
| IconButton | `64:8` | `@/ui/IconButton` → `IconButton` | `icon` (Phosphor node, size 24), `variant?: 'surface'\|'ghost', onPress?, disabled?, accessibilityLabel?` (Figma `Style`→`variant`) |
| SegmentedControl | `84:21` | `@/ui/SegmentedControl` → `SegmentedControl` | `segments: { value, label, icon?(active) }[], value, onChange?` |
| Toggle | `80:11` | `@/ui/Toggle` → `Toggle` | `value, onValueChange?, disabled?` |
| Checkbox | `76:19` | `@/ui/Checkbox` → `Checkbox` | `checked, onChange?, label?, disabled?` |
| Radio | `77:17` | `@/ui/Radio` → `Radio` | `checked, onChange?, label?, disabled?` |
| Header | `83:20` | `@/ui/Header` → `Header` | `title, variant?: 'large'\|'compact', onBack?, trailing?: ReactNode` |
| Toast | `86:18` | `@/ui/Toast` → `Toast` | `message, tone?: 'info'\|'success'\|'error', actionLabel?, onAction?` |
| Input | `72:22` | `@/ui/Input` → `Input` | `value?, onChangeText?, placeholder?, leftIcon?, rightIcon?, type?: 'text'\|'dropdown', error?, disabled?, onPress?` (search field = type `text` + MagnifyingGlass left) |
| EmptyState | `67:3` | `@/ui/EmptyState` → `EmptyState` | `title, description?, icon?, actionLabel?, onAction?` |

Still to build: **TabBar** (`58:21`, native Liquid Glass — see note below), plus
DropdownItem/DropdownMenu, ListRow, BottomSheet, Carousel, DateStrip/DayCell,
MapPin marker, ListSectionHeader, Skeletons (build on demand).
Chip = interactive filter (Default/Active); Badge = non-interactive label (Tone).

## TabBar note

TabBar is approved native Liquid Glass — iOS via Expo native tabs (system glass),
Android a matching custom blur bar. Glass constants are in `theme.glass`. Don't
rebuild it as a plain View when implementing the tab bar.
