---
name: Kinetic Block
colors:
  surface: '#fcf8fb'
  surface-dim: '#dcd9dc'
  surface-bright: '#fcf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edf0'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e5e1e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#444557'
  inverse-surface: '#313032'
  inverse-on-surface: '#f3f0f2'
  outline: '#757689'
  outline-variant: '#c5c5da'
  surface-tint: '#2540ff'
  primary: '#0022d3'
  on-primary: '#ffffff'
  primary-container: '#1f3bff'
  on-primary-container: '#ced1ff'
  inverse-primary: '#bcc2ff'
  secondary: '#a7391e'
  on-secondary: '#ffffff'
  secondary-container: '#fd7958'
  on-secondary-container: '#6e1500'
  tertiary: '#484438'
  on-tertiary: '#ffffff'
  tertiary-container: '#605c4f'
  on-tertiary-container: '#dbd4c4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bcc2ff'
  on-primary-fixed: '#000a63'
  on-primary-fixed-variant: '#0023d9'
  secondary-fixed: '#ffdad2'
  secondary-fixed-dim: '#ffb4a2'
  on-secondary-fixed: '#3c0700'
  on-secondary-fixed-variant: '#862208'
  tertiary-fixed: '#e9e2d1'
  tertiary-fixed-dim: '#cdc6b6'
  on-tertiary-fixed: '#1e1c11'
  on-tertiary-fixed-variant: '#4a473a'
  background: '#fcf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e5e1e4'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 72px
    fontWeight: '800'
    lineHeight: 72px
    letterSpacing: -0.04em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 50px
    letterSpacing: -0.04em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.03em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-md:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system draws direct inspiration from mid-century Swiss gig posters, punk screen-printing, and raw editorial broadsheets. It trades soft modern SaaS homogeneity for visceral, rhythm-driven impact. The target audience comprises creators, audio-visual collaborators, and technical operators who value directness, tactile clarity, and uncompromising structure. 

The emotional response should be immediate, confident, and energetic: the feeling of heavyweight physical paper stock, high-viscosity ink stamped onto untreated cream paper, and unyielding tectonic composition. Visually, the aesthetic relies on flat color blocking, strict edge-to-edge modular framing, and extreme typographic tension.

## Colors
The palette functions through heavy contrast and full-bleed chromatic strata rather than ambient tints or subtle gradients. 

- **Cobalt (`#1F3BFF`)**: The electric primary. Used for high-voltage accents, primary operational states, and dominant visual weight blocks.
- **Coral (`#FF7A59`)**: The secondary accent. Deployed for immediate callouts, urgent telemetry, notifications, and secondary graphic counters.
- **Sand (`#E3DCCB`)**: The tertiary structural neutral. Used as alternating module grounding and distinct background segmentation panels.
- **Cream (`#F4F1EA`)**: The fundamental canvas foundation. Replaces pure digital white with physical, unbleached poster pulp.
- **Ink (`#0E0E10`)**: The primary structural mass. Dictates structural boundaries, dense editorial typography, and high-impact contrasting bands.
- **Ink Muted (`#55534E`)**: Subordinate metadata, tabular keys, and inactive structural rules.
- **Cream Muted (`rgba(244, 241, 234, 0.72)`)**: De-emphasized labels when placed directly over dark Ink or Cobalt fields.

Transitions between sections must occur via razor-sharp color breaks with no soft blends or drop shadows.

## Typography
Headlines utilize heavy display weights, dense negative tracking, and forceful uppercase styling. They operate like physical typesetting blocks set tight against one another. 

All numbers, coordinates, timestamps, and status metrics must strictly use tabular numerals (`font-variant-numeric: tabular-nums`) to preserve the mathematical, mechanical aesthetic. Running text remains unvarnished and crisp, while micro-labels, metadata markers, and status trackers adopt an all-caps monospaced cadence to mirror utilitarian equipment placards.

## Layout & Spacing
The layout philosophy is built on an architectural 12-column modular grid that shifts into edge-to-edge horizontal bands. Instead of floating cards within amorphous whitespace, elements are grouped into interlocking rectangular blocks that lock directly to column bounds.

- **Breakpoints**:
  - **Mobile (< 768px)**: 4 columns, 0.75rem gutters, 1rem canvas margin. Full horizontal bleed for color containers.
  - **Tablet (768px - 1024px)**: 8 columns, 1.5rem gutters, 1.5rem canvas margin.
  - **Desktop (> 1024px)**: 12 columns, 1.5rem gutters, 2rem canvas margin.

Vertical layout alternates intentionally between contrasting solid bands (Cream against Ink against Cobalt), establishing rhythmic sectioning akin to screen-printed broadsheet posters. Component padding adheres tightly to the base token scale, ensuring mechanical alignment across horizontal rules.

## Elevation & Depth
Elevation through blurred shadows or translucent glassmorphism is entirely prohibited. 

Visual hierarchy is achieved through:
1. **Bold Structural Borders**: Exact 2px solid lines (`#0E0E10` or `#F4F1EA` inverted) creating definite boundaries.
2. **Chromatic Layering**: Full-bleed background color swaps, such as placing a Sand `#E3DCCB` block over a Cream `#F4F1EA` surface or an Ink `#0E0E10` slab directly adjacent to Cobalt `#1F3BFF`.
3. **Hard Offset Cast**: If an element requires interactive lift or active engagement emphasis, it employs a hard 4px or 6px non-blurred offset block (`box-shadow: 4px 4px 0px #0E0E10`), evoking stacked structural plates.

## Shapes
The structural geometry is unapologetically orthogonal. Cards, input frames, dropdown menus, modal dialogs, and layout regions possess strictly `0px` radius (razor-sharp corners).

The only exceptions to this sharp geometry are:
1. **Interactive Pill Elements**: Buttons and primary action badges feature full capsule geometry (`border-radius: 9999px`) to create an immediate visual contrast against the rigid rectilinear grid.
2. **Rotating Status Discs**: Live connectivity, peer-to-peer ping, and active streaming states utilize a perfect circle (`border-radius: 50%`) that rotates mechanically, mimicking physical dial indicators.

## Components

### Buttons
Buttons break out of the rectangular grid using fully rounded pill forms (`border-radius: 9999px`).
- **Primary**: Cobalt `#1F3BFF` background with Cream `#F4F1EA` bold uppercase text, bounded by a 2px Ink `#0E0E10` solid border. On hover, apply a hard 4px 4px offset shadow in Ink `#0E0E10`.
- **Secondary / Action**: Coral `#FF7A59` background with Ink `#0E0E10` text, 2px Ink `#0E0E10` border.
- **Inverted / Dark Mode Context**: Cream `#F4F1EA` background with Ink `#0E0E10` text when resting on Cobalt or Ink bands.
- **Sizes**: Height 44px (Standard) and 36px (Compact); always typeset in uppercase bold with tight tracking.

### Cards & Block Containers
- Sharp `0px` corners, enclosed in a 2px Ink `#0E0E10` border.
- Fill colors depend on the band hierarchy: Cream `#F4F1EA` with Sand `#E3DCCB` header caps, or solid Ink `#0E0E10` with Cream `#F4F1EA` typography.
- No interior drop shadows; divide sub-regions using sharp 2px horizontal and vertical divider rules.

### Input Fields
- Monospaced labels set directly above the frame in all caps.
- Input boxes have sharp `0px` corners, a 2px Ink `#0E0E10` stroke, and an unbleached Sand `#E3DCCB` or Cream `#F4F1EA` field.
- Focused state replaces the border with Cobalt `#1F3BFF` (or a double-line stroke effect) without glow or blur.

### Lists & Modular Tables
- Border-collapse style row layouts where each item is separated by a 2px solid horizontal line.
- Monospaced tabular numerals for metadata, index numbers (`01`, `02`, `03`), and state indicators.
- Alternating zebra backgrounds are avoided in favor of solid color block hover states (e.g., hovering a row fills it with Cobalt `#1F3BFF` and flips text to Cream `#F4F1EA`).

### Checkboxes & Radio Buttons
- **Checkboxes**: Sharp `0px` square, 20x20px, 2px Ink `#0E0E10` border. When checked, filled completely with Cobalt `#1F3BFF` holding a crisp geometric checkmark.
- **Radio Buttons**: Circle with 2px Ink `#0E0E10` border. When selected, displays an inner solid disc with no gradient transitions.

### Status Discs & Telemetry Badges
- Continuous mechanical rotation status indicator for active peer nodes (24px or 16px diameter circular discs with quadrant color segments).
- Network status chips use monospaced text wrapped in sharp 0px borders with flat color fill (e.g., Coral `#FF7A59` for disconnected, Cobalt `#1F3BFF` for live sync).