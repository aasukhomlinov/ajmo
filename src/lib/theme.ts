// AUTO-GENERATED from design-tokens.json — do not edit by hand.
// Regenerate with: npm run generate-theme

export const theme = {
  "colors": {
    "bg": "#0D0E11",
    "surface": {
      "base": "#17181D",
      "raised": "#1F2128"
    },
    "text": {
      "primary": "#F4F4F2",
      "secondary": "#9A9CA6",
      "disabled": "#5C5E68",
      "onAccent": "#0D0E11"
    },
    "accent": {
      "base": "#CCFF00",
      "pressed": "#A8D400",
      "subtle": "#CCFF001F"
    },
    "success": "#4ADE80",
    "warning": "#FFB020",
    "error": "#FF5C5C",
    "border": "#2A2C34",
    "scrim": "#0D0E11CC"
  },
  "spacing": {
    "xs": 4,
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
    "5xl": 48,
    "6xl": 64
  },
  "radii": {
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 24,
    "full": 999
  },
  "shadows": {
    "card": {
      "shadowColor": "#00000059",
      "shadowOffset": {
        "width": 0,
        "height": 2
      },
      "shadowOpacity": 1,
      "shadowRadius": 4,
      "elevation": 4
    },
    "raised": {
      "shadowColor": "#00000073",
      "shadowOffset": {
        "width": 0,
        "height": 4
      },
      "shadowOpacity": 1,
      "shadowRadius": 8,
      "elevation": 8
    },
    "overlay": {
      "shadowColor": "#00000080",
      "shadowOffset": {
        "width": 0,
        "height": 8
      },
      "shadowOpacity": 1,
      "shadowRadius": 16,
      "elevation": 16
    }
  },
  "typography": {
    "display": {
      "fontSize": 34,
      "fontFamily": "TikTokSans",
      "fontWeight": "800",
      "lineHeight": 40,
      "letterSpacing": -0.5,
      "fontVariationSettings": "'wght' 800, 'wdth' 125, 'opsz' 36"
    },
    "h1": {
      "fontSize": 26,
      "fontFamily": "TikTokSans",
      "fontWeight": "800",
      "lineHeight": 32,
      "letterSpacing": -0.25,
      "fontVariationSettings": "'wght' 800, 'wdth' 120, 'opsz' 28"
    },
    "h2": {
      "fontSize": 20,
      "fontFamily": "TikTokSans",
      "fontWeight": "700",
      "lineHeight": 26,
      "letterSpacing": 0,
      "fontVariationSettings": "'wght' 700, 'wdth' 110, 'opsz' 22"
    },
    "body": {
      "fontSize": 16,
      "fontFamily": "TikTokSans",
      "fontWeight": "400",
      "lineHeight": 24,
      "letterSpacing": 0,
      "fontVariationSettings": "'wght' 400, 'wdth' 100, 'opsz' 16"
    },
    "bodySmall": {
      "fontSize": 14,
      "fontFamily": "TikTokSans",
      "fontWeight": "400",
      "lineHeight": 20,
      "letterSpacing": 0,
      "fontVariationSettings": "'wght' 400, 'wdth' 100, 'opsz' 14"
    },
    "caption": {
      "fontSize": 12,
      "fontFamily": "TikTokSans",
      "fontWeight": "500",
      "lineHeight": 16,
      "letterSpacing": 0.5,
      "fontVariationSettings": "'wght' 500, 'wdth' 85, 'opsz' 12"
    },
    "button": {
      "fontSize": 16,
      "fontFamily": "TikTokSans",
      "fontWeight": "600",
      "lineHeight": 20,
      "letterSpacing": 0.5,
      "fontVariationSettings": "'wght' 600, 'wdth' 90, 'opsz' 16"
    }
  }
} as const;

export type Theme = typeof theme;
export type ThemeColors = Theme['colors'];
export type ThemeSpacing = Theme['spacing'];
