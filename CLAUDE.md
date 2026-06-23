# Ajmo — project context for Claude Code

## What this is
Ajmo is an events discovery app for Belgrade & Novi Sad, Serbia ("ajmo" =
colloquial Serbian for "let's go"). MVP = event aggregation feed: parsed
events from local venues, Telegram channels, and websites, shown as a feed +
search. NO social features in v1 (no social profiles, no friends, no chat).
A single "save" per event (a "+" button that adds it to Saved) is a bookmark
with reminders, scoped to the signed-in user (see Auth). There is no "Wanna
join" and no "Like" — just save / unsave; the Saved list is flat.

## Auth
Auth via Supabase (Apple, Google, email magic-link). Auth is a HARD GATE —
no guest browsing; the whole app requires a signed-in user. Saves and push
tokens are user-scoped, not device-scoped (supersedes the earlier anonymous
device_saves model).

## Cities & location
- Two cities at launch: Belgrade and Novi Sad. City is chosen MANUALLY from a
  2-item list (once after first sign-in; changeable from the header).
- NO geolocation in MVP: no expo-location, no "detect automatically", no
  location permission prompt. Auto-detect is a post-MVP addition.
- All event/search queries are scoped by the active city_id; the chosen city
  is stored in the user's profile.

## Owner
Artyom — Lead Product Designer. Treat him as the design authority: never invent
visual styles beyond what's approved, always derive them from the design tokens
and the Figma library. He prefers direct, concise communication. Explain
architectural decisions briefly before implementing. When a task is ambiguous,
propose 2-3 options with a recommendation instead of guessing.

## Stack
- React Native + Expo (managed workflow), Expo Router for navigation
- TypeScript strict mode
- Supabase: Postgres, Edge Functions (Deno), Storage, pg_cron, Auth
- State: zustand + @tanstack/react-query for server state
- Location: NONE in MVP (manual city picker; see Cities & location)
- Maps: NO react-native-maps as a core dependency. The only map is a STATIC
  snippet on Event Detail (rendered image / static-maps tile + pin overlay).
- Icons: phosphor-react-native (outline default, fill for active states)
- Fonts: TikTok Sans variable (expo-font), axes: wght / wdth / opsz
- Push: expo-notifications — PER-EVENT reminders (not category digests). When
  a user saves an event, schedule reminders at their lead-time prefs
  (one week / two days / one day / day-of, multi-select).

## Design system — source of truth
FIXED decisions:
- Logo: "ajmo" lettering in Lineal (used as an asset, not system text)
- UI font: TikTok Sans (variable)
- Icons: Phosphor

EVERYTHING ELSE (palette, theme, spacing grid, radii, shadows, type scale,
component patterns) is defined in design-tokens.json at the repo root —
created and approved in the design-direction phase. It is the single source
of truth for both Figma Variables and the app theme; never use values that
aren't derived from it.

APPROVED DIRECTION — «Afiša» (night poster): dark-first UI inspired by
Belgrade club flyers. Near-black bg (#0D0E11), flat surface steps + hairline
borders instead of blurry shadows, acid-lime accent (#CCFF00) used hard on
CTAs/badges. Type signature = axis contrast: Display/H1 wide+heavy (wdth
120-125, wght 800), captions/buttons condensed (wdth 85-90, uppercase).
Event cards: full-bleed image with scrim, wide title overlapping the image
edge, lime date chip. Moderate radii (12-16) — street, not bubbly.

TabBar = native Liquid Glass. On iOS implement with Expo native tabs
(system glass), Android gets a visually matching custom bar with blur
fallback. Tabs: Discover (Compass), Saved (BookmarkSimple), Profile (User).
Glass constants (Figma can't fully bind them): `glass` group in
design-tokens.json + Figma vars color/glass/* + effect style Glass/Bar.

Figma files (TWO):
- DS (tokens + components): H5mzFcoh4EbVAkhNGFRJEx ("ajmo DS") — get_design_context
  for primitives/tokens comes from HERE.
- App (screens): V1hCHKao5dvJtA1MOB3wuu ("ajmo app") — get_design_context for
  screen layouts comes from HERE; screens consume the DS library.

## Figma MCP rules
- Before any Figma write operation, use the figma plugin Agent Skills
  (figma-use / generate-design workflows). Never freehand canvas JS without them.
- When implementing UI from Figma: call get_design_context on the exact node,
  then map output to OUR React Native primitives (see src/ui/) — do not paste
  web/Tailwind output into the RN app.
- Reuse Figma Variables; never hardcode hex values that exist as tokens.
- After implementing a screen, compare against get_screenshot of the node and
  list discrepancies.
- Detailed Figma→RN translation rules, the component registry (manual stand-in
  for Code Connect, which is unavailable on the Pro plan), and the icon/asset
  conventions live in the imported rules file below.

@.claude/rules/figma-design-system.md

## Code conventions
- src/ui/        → primitives mirroring the DS (AppText, Button, IconButton,
  Chip, Input, EventCard, EventRow, EventCardSkeleton, EventRowSkeleton,
  TabBar, ListRow, ListSectionHeader, EmptyState, Badge, Toast, Radio,
  Checkbox, Header, Carousel, PageDots, Screen, Divider)
- src/features/  → discover, search, event, saved, profile, auth, city
  (screen + hooks + api per feature). NO "map" feature.
  (EventCard/EventRow live under discover/ — see the component registry.)
- src/lib/       → supabase client, query client, theme, mocks, utils
- supabase/      → migrations, functions (parsers, send-reminders)
- All colors/spacing/typography ONLY via theme tokens (src/lib/theme.ts,
  generated from design-tokens.json). Hardcoded styles = bug.
- Components small and typed; no default exports except Expo Router screens.
- Commit per logical unit with conventional commits (feat:, fix:, chore:).

## Workflow expectations
- Work in small verifiable steps; run `npx tsc --noEmit` and the app after
  each feature; fix errors before moving on.
- When a task is ambiguous, propose 2-3 options with a recommendation
  instead of guessing.
- Russian or English in chat is fine; code, comments, commits in English.
