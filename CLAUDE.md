# Ajmo — project context for Claude Code

## What this is
Ajmo is an events discovery app for Belgrade, Serbia ("ajmo" = colloquial Serbian
for "let's go"). MVP = event aggregation feed: parsed events from local venues,
Telegram channels, and websites, shown as a feed + map. NO social features in v1
(no profiles, no friends, no chat). "Wanna join" and "Like" act as local bookmarks.

## Owner
Artyom — Lead Product Designer. Treat him as the design authority: never invent
visual styles beyond what's approved, always derive them from the design tokens
and the Figma library. He prefers direct, concise communication. Explain
architectural decisions briefly before implementing.

## Stack
- React Native + Expo (managed workflow), Expo Router for navigation
- TypeScript strict mode
- Supabase: Postgres, Edge Functions (Deno), Storage, pg_cron
- State: zustand + @tanstack/react-query for server state
- Maps: react-native-maps (Apple/Google) — Belgrade region
- Icons: phosphor-react-native (outline default, fill for active states)
- Fonts: TikTok Sans variable (expo-font), axes: wght / wdth / opsz
- Push: expo-notifications

## Design system — source of truth
FIXED decisions:
- Logo: "ajmo" lettering in Lineal (used as an asset, not system text)
- UI font: TikTok Sans (variable)
- Icons: Phosphor

EVERYTHING ELSE (palette, theme, spacing grid, radii, shadows, type scale,
component patterns) is defined in design-tokens.json at the repo root —
created and approved in the design-direction phase. Until that file exists,
do NOT assume any colors or visual patterns. Once it exists, it is the single
source of truth for both Figma Variables and the app theme.
- Figma design system file key: <FIGMA_FILE_KEY> (fill in after creation)

## Figma MCP rules
- Before any Figma write operation, use the figma plugin Agent Skills
  (figma-use / generate-design workflows). Never freehand canvas JS without them.
- When implementing UI from Figma: call get_design_context on the exact node,
  then map output to OUR React Native primitives (see src/ui/) — do not paste
  web/Tailwind output into the RN app.
- Reuse Figma Variables; never hardcode hex values that exist as tokens.
- After implementing a screen, compare against get_screenshot of the node and
  list discrepancies.

## Code conventions
- src/ui/        → primitives (Text, Button, Card, Chip, TabBar, IconButton...)
- src/features/  → feed, map, event, saved, settings (screen + hooks + api)
- src/lib/       → supabase client, query client, theme, utils
- supabase/      → migrations, functions (parsers)
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
