#!/usr/bin/env python3
"""
Generate STATIC TikTok Sans cuts from the variable master.

Why this exists
---------------
React Native cannot drive variable-font axes at runtime: `fontVariationSettings`
is web-only and ignored, and `fontWeight` alone can't reach the `wght` we need
nor touch `wdth`/`opsz` at all. The Afiša type signature is built on the WIDTH
axis (wide display vs condensed caption/button), which is therefore unreachable
from a single variable file. So we instance the variable master into one static
face per type preset, each registered under its own family name.

The cut list mirrors the typography presets in design-tokens.json. Keep the two
in sync: if a preset's wght/wdth/opsz changes there, update CUTS here and rerun.

Usage
-----
  npm run generate-fonts        # from repo root
  # or: python3 scripts/build-fonts.py

Requires fontTools (build-time only, NOT bundled into the app):
  pip3 install --user fonttools
"""

from __future__ import annotations

import os
import sys

try:
    from fontTools import ttLib
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:
    sys.exit(
        "✖ build-fonts: fontTools is not installed.\n"
        "  Install it (build-time only): pip3 install --user fonttools"
    )

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, "assets", "fonts")
SOURCE = os.path.join(FONTS_DIR, "TikTokSans-Variable.ttf")

# One static cut per type preset. Family name == file basename == the key the
# app registers in useFonts and references as fontFamily — identical on both
# platforms so there is zero name-matching ambiguity. slnt is pinned to 0
# (upright) on every cut. bodySmall intentionally reuses the Body cut.
CUTS = {
    "TikTokSans-Display": {"wght": 800, "wdth": 125, "opsz": 36},
    "TikTokSans-H1": {"wght": 800, "wdth": 120, "opsz": 28},
    "TikTokSans-H2": {"wght": 700, "wdth": 110, "opsz": 22},
    "TikTokSans-Body": {"wght": 400, "wdth": 100, "opsz": 16},
    "TikTokSans-Caption": {"wght": 500, "wdth": 85, "opsz": 12},
    "TikTokSans-Button": {"wght": 600, "wdth": 90, "opsz": 16},
    "TikTokSans-Section": {"wght": 700, "wdth": 90, "opsz": 12},
}

# Name records to overwrite on each instance. We set the basic family (1/2),
# full (4) and PostScript (6) names, plus the typographic family/subfamily
# (16/17), so the OS groups each cut as its OWN family rather than lumping all
# cuts under the master's "TikTok Sans" family with different subfamilies.
WINDOWS = (3, 1, 0x409)  # platformID, platEncID, langID
MAC = (1, 0, 0)


def set_name(name_table, value: str, name_id: int) -> None:
    for platform_id, enc_id, lang_id in (WINDOWS, MAC):
        name_table.setName(value, name_id, platform_id, enc_id, lang_id)


def build_cut(family: str, axes: dict[str, float]) -> str:
    font = ttLib.TTFont(SOURCE)
    # Pin every axis -> fully static face (slnt upright).
    instantiateVariableFont(font, {**axes, "slnt": 0}, inplace=True, updateFontNames=False)

    name = font["name"]
    set_name(name, family, 1)  # Family
    set_name(name, "Regular", 2)  # Subfamily
    set_name(name, family, 4)  # Full name
    set_name(name, family, 6)  # PostScript name (must match family; no spaces)
    set_name(name, family, 16)  # Typographic family
    set_name(name, "Regular", 17)  # Typographic subfamily

    out_path = os.path.join(FONTS_DIR, f"{family}.ttf")
    font.save(out_path)
    return out_path


def main() -> None:
    if not os.path.exists(SOURCE):
        sys.exit(f"✖ build-fonts: source master not found at {SOURCE}")

    for family, axes in CUTS.items():
        out_path = build_cut(family, axes)
        rel = os.path.relpath(out_path, ROOT)
        size_kb = os.path.getsize(out_path) // 1024
        axis_str = ", ".join(f"{k} {v}" for k, v in axes.items())
        print(f"✔ {rel}  ({axis_str}, {size_kb} KB)")

    print(f"\n✔ build-fonts: wrote {len(CUTS)} static cuts to assets/fonts/")


if __name__ == "__main__":
    main()
