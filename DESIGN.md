---
name: PulseGuard
description: Industrial-grade vibro-diagnostic dashboard for predictive machinery maintenance
colors:
  primary-orange: "#F07800"
  primary-orange-dark: "#D96400"
  accent-red: "#B83030"
  accent-green: "#237A4A"
  accent-yellow: "#A06000"
  neutral-black: "#111111"
  neutral-dark-gray: "#555555"
  neutral-gray: "#666666"
  neutral-bg-white: "#FFFFFF"
  neutral-bg-light: "#F5F5F5"
  neutral-bg-lighter: "#EEEEEE"
  neutral-bg-lightest: "#E4E4E4"
  neutral-border: "#E2E2E2"
  neutral-border-dark: "#CCCCCC"
typography:
  display:
    fontFamily: "Segoe UI, Roboto, -apple-system, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Segoe UI, Roboto, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Segoe UI, Roboto, -apple-system, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Segoe UI, Roboto, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Segoe UI, Roboto, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.5px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "50px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-orange}"
    textColor: "{colors.neutral-white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-orange-dark}"
    textColor: "{colors.neutral-white}"
  button-secondary:
    backgroundColor: "{colors.neutral-bg-white}"
    textColor: "{colors.primary-orange}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.primary-orange}"
    textColor: "{colors.neutral-white}"
  nav-item:
    backgroundColor: "{colors.primary-orange}"
    textColor: "{colors.neutral-white}"
    padding: "12px 16px"
  status-badge-ok:
    backgroundColor: "#E8F5E9"
    textColor: "{colors.accent-green}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  status-badge-warning:
    backgroundColor: "#FFF3E0"
    textColor: "#B87000"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  status-badge-fault:
    backgroundColor: "#FFEBEE"
    textColor: "{colors.accent-red}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.neutral-bg-white}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.neutral-bg-white}"
    textColor: "{colors.neutral-black}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  input-focus:
    backgroundColor: "{colors.neutral-bg-white}"
    textColor: "{colors.neutral-black}"
---

# Design System: PulseGuard

## 1. Overview

**Creative North Star: "Industrial-grade diagnostic intelligence that fits in one box, runs forever without anyone babysitting it, and never pretends to be smarter than the data justifies."**

PulseGuard's design philosophy is **minimal, functional, and precise** — every pixel serves diagnosis, never decoration. The system is built for machinery maintenance engineers and factory operators who work under time pressure and need absolute clarity. Status must be visible at first glance. Modals and animations must never obscure data. 

The palette is restrained: a single saturated orange (#F07800) for primary actions, semantic status colors (green = nominal, amber/yellow = warning, red = critical), and neutral grays for surfaces and text. No gradients, no competing colors, no visual noise. Typography is uniform (Segoe UI family) at precise scales. Layout is grid-based, responsive without breakpoints that break trust.

The interface rejects: decorative gradients, unclear status indicators, vague language ("System thinking..."), ornamental shadows, or anything that suggests the system knows more than it does. It is deliberately austere. This austerity is the design.

**Key Characteristics:**
- Restrained color strategy (one accent, semantic states only)
- Flat, no-decoration aesthetic (form follows function)
- High contrast throughout (≥4.5:1 text on background, WCAG AA)
- Semantic structure (status visible at <300ms scan)
- Precise typography hierarchy (fixed scale, not fluid)
- Keyboard-first interaction (mouse is optional)
- Reduced motion support (no animation for animation's sake)

---

## 2. Colors

The palette divides into three semantic roles: **Primary (actions)**, **Semantic (state)**, and **Neutral (surfaces/text)**.

### Primary

**Steady Orange** (#F07800 / oklch(56% 0.21 60)): The sole accent color. Used for primary CTAs, navigation background, active states, and form focus indicators. Appears on ≤10% of any screen. Never used decoratively.

- Navigation bar background
- Primary button (call-to-action)
- Form input focus ring
- Active tab indicator

**Orange-Dark** (#D96400): Hover state for primary orange. One step darker to signal interaction readiness. Used only on `:hover` of primary buttons and interactive elements.

### Semantic (Status & Intent)

**Decisive Red** (#B83030 / oklch(45% 0.13 15)): Safety-critical state. Used only for faults, errors, or imminent failures. High contrast on white ensures visibility even with color blindness.

- Machine fault status badge
- Error messages & alerts
- Negative actions (delete, stop)

**Clear Green** (#237A4A / oklch(45% 0.11 155)): Nominal, all-ok state. Indicates system operating within acceptable thresholds.

- Machine OK status badge
- Success confirmations
- Healthy system indicators

**Alert Yellow** (#A06000 / oklch(50% 0.15 55)): Warning or attention-needed state. Mid-priority. Does not blend with orange (separate hue band).

- Machine warning status badge
- Maintenance-due indicators
- Caution messages

### Neutral (Surfaces, Text, Borders)

**Clean White** (#FFFFFF): Primary surface for cards, panels, modals. High contrast background for all body text.

- Card backgrounds
- Input field backgrounds
- Modal surfaces
- Primary content area

**Light Gray Bg** (#F5F5F5): Secondary surface for grouped content, section backgrounds, or subtle differentiation. Maintains ≥4.5:1 contrast with body text.

- Page background (optional, use white for crisp look)
- Grouped form sections
- Alternate row backgrounds in tables
- Disabled state backgrounds

**Lighter Gray Bg** (#EEEEEE): Tertiary surface. Light enough to feel recessed, dark enough to be a clear container.

- Sidebar backgrounds (optional)
- Section separators
- Placeholder blocks

**Very Light Gray Bg** (#E4E4E4): Quaternary surface. Used sparingly for hover states or very subtle layering.

- Hover backgrounds (light)
- Subtle section dividers

**Border Gray** (#E2E2E2): Dividers, borders, input strokes. ≥1px solid line to avoid fluttering.

- Form input borders
- Card borders (optional, use sparingly)
- Table dividers
- Separator lines

**Dark Border Gray** (#CCCCCC): Darker border for higher contrast or emphasis (rarely used).

- Input border on focus (upgrade from #E2E2E2)
- Table row separators

**Text: Pure Black** (#111111): Body copy, headings, labels. Never gray. Pure black ensures ≥7:1 contrast on white (AAA). Industrial environments require unambiguous readability.

- All body text
- All headings
- All labels
- All button text

**Text: Dark Gray** (#555555): Secondary or muted text. Maintains ≥4.5:1 contrast on white (AA). Used for helper text, hints, or de-emphasized content.

- Helper text under inputs
- Muted metadata (timestamps)
- Disabled state text
- Secondary labels

**Text: Medium Gray** (#666666): Placeholder text, very muted information. Rare; use dark gray (#555555) instead for higher contrast.

---

## 3. Typography

**Font Stack:** Segoe UI (Microsoft default for Windows + industrial systems), Roboto (Android fallback), -apple-system (macOS/iOS), sans-serif.

**Character:** A single, no-frills sans-serif family across all scales. No display/body pairing, no decorative fonts. The font is the message carrier, not the decoration.

### Hierarchy

- **Display** (2rem, 700, 1.2 line-height): Hero section titles (rarely used in dashboard context). Ceiling: never exceed 3rem.
- **Headline** (1.5rem, 700, 1.3 line-height): Page titles, major section heads ("Dashboard", "Machine Detail", "ML Sector").
- **Title** (1.2rem, 600, 1.4 line-height): Card titles, subsection heads, modal titles.
- **Body** (1rem, 400, 1.5 line-height): Paragraph text, data rows, primary content. Max line length: 65–75ch (critical for readability). Tracked at 1rem in fixed pixel/rem context (not fluid clamp).
- **Label** (0.875rem, 600, 1.4 line-height, 0.5px tracking, sometimes uppercase): Form labels, button text, chip labels, badges. Slightly larger than helpers to maintain readability.
- **Helper** (0.75rem, 400): Hints under form fields, timestamps, muted metadata.

### Named Rules

**The Minimalist Stack Rule.** No decorative font pairing. One family, five weights (400/500/600/700/800). Every font scale is intentional and used consistently. No fluid clamps; fixed rem/px scales allow predictable rendering in industrial shop-floor environments (possibly low-res displays, gloved interaction, high ambient light).

---

## 4. Elevation

PulseGuard uses **flat design with subtle shadow layering**. No gradients, no blown-out shadows. Elevation is conveyed through:

1. **Subtle shadows** (low ambient blur, high opacity falloff)
2. **Tonal layering** (white surface on #F5F5F5 background)
3. **Borders** (1px #E2E2E2 to demarcate containers)

### Shadow Vocabulary

**Ambient-Low** (`box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06)`): Default shadow for cards, panels at rest. Barely perceptible. Conveys elevation without distraction.

- Card backgrounds at rest
- Dropdown menu base shadows
- Input field blur (optional)

**Ambient-Mid** (`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)`): Hover state shadow on cards, clickable elements. Signals interactivity. Used on `:hover`.

- Card hover (top-level container)
- Sticky nav bar
- Modal backdrop blur (for modals, which are discouraged)

**Lifted** (`box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1)`): Only for modal dialogs or popovers that must float above all content. Rare. Minimize modal use per PRODUCT.md.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest (no shadow). Shadows appear only as response to state: `:hover` lifts the card, `:focus` adds a glow. Modals are architectural laziness; eliminate them in favor of inline panels. When modals are unavoidable, use the lifted shadow.

---

## 5. Components

### Buttons

**Character:** Minimal, precise, high contrast. Three variants: Primary (orange), Secondary (white with orange border), Tertiary (text-only, for low-priority actions).

- **Primary Button**: Steady Orange bg (#F07800), white text, 12px vertical / 24px horizontal padding, 6px radius.
  - Used for main CTAs ("Diagnose", "Activate Model", "Save").
  - Hover: Orange-Dark (#D96400).
  - Focus: Orange ring (outline: 3px solid #F07800 with 8px offset).
  - Disabled: 60% opacity, `cursor: not-allowed`.

- **Secondary Button**: White bg, orange border (2px), orange text, same padding/radius.
  - Used for alternate actions ("Cancel", "Update", "View Details").
  - Hover: Orange bg, white text (color invert).
  - Focus: Same orange ring as primary.

- **Tertiary Button**: No background, no border, just text. Orange text (#F07800). Minimal padding (8px).
  - Used for low-priority links ("Learn More", "Help", "About").
  - Hover: Underline (text-decoration: underline).

- **Minimum touch target:** 44px × 44px on mobile. Never smaller (WCAG standard).

### Navigation

**Character:** Saturated orange bar (#F07800), white text, uppercase and tracked (0.5px letter-spacing). Sticky to top. Horizontal layout on desktop, collapse to hamburger on mobile.

- **Nav Item** (default): White text, orange bg, 12px top/bottom padding, 16px left/right. Hover: 5% black overlay on orange.
- **Nav Item (active)**: Same as hover + 4px red bottom border (accent indicator).
- **Focus:** Orange ring (3px #F07800).

### Status Badges

**Character:** Icon + text + left border. Never color alone. Always readable at a glance (operator should recognize status in <200ms).

- **OK Badge**: Light green bg (#E8F5E9), dark green text (#237A4A), green left border (3px).
  - Icon: ✓ checkmark
  - Example: "✓ OK" in green

- **Warning Badge**: Light amber bg (#FFF3E0), dark amber text (#B87000), amber left border (3px).
  - Icon: ⚠ warning triangle
  - Example: "⚠ WARNING" in amber

- **Fault Badge**: Light red bg (#FFEBEE), dark red text (#B83030), red left border (3px).
  - Icon: 🔴 circle or alert
  - Example: "🔴 FAULT" in red
  - Optional: Subtle pulse animation (respects `prefers-reduced-motion`).

- **Padding:** 6px vertical, 12px horizontal. Radius: 8px.

### Cards

**Character:** White background, light border (#E2E2E2), 16px padding, 12px border-radius. Flat at rest, lifted shadow on hover.

- **Default**: White bg, subtle 1px border, ambient-low shadow.
- **Hover**: Same as above + ambient-mid shadow (`0 4px 6px...`), slight scale up (transform: scale(1.02) optional).
- **Focus**: Orange ring (3px, 8px offset).

### Inputs / Form Fields

**Character:** Light gray bg (#F5F5F5 or white depending on context), 1px border (#E2E2E2), 12px padding, 6px radius. Label is always visible (no placeholder animation hack). Helper text below.

- **Default**: White bg, light border, dark gray text.
- **Focus**: White bg, orange border (2px), orange glow (box-shadow: 0 0 0 4px rgba(240, 120, 0, 0.1)), dark black text.
- **Error**: Light red bg (#FFEBEE), red border, red label text, error message below.
- **Disabled**: Light gray bg (#F5F5F5), lighter gray text (#555555), `cursor: not-allowed`.

- **Label** (always visible): Dark black text (#111111), 0.875rem, 600 weight, above input. No floating label tricks.
- **Helper text** (below input): 0.75rem, dark gray (#555555), normal weight.

### Tables

**Character:** Simple, dense, readable. No row striping (slows scanning). Alternating row hover only.

- **Header**: Orange bg (#F07800), white text, 600 weight, 1rem padding.
- **Cell**: 1rem padding, dark text (#111111), 1px border-bottom (#E2E2E2).
- **Row hover**: Light gray background (#F5F5F5).
- **Radius**: 0 (square corners for dense data).

---

## 6. Do's and Don'ts

### Do:

- **Do** use the primary orange (#F07800) for ≤10% of any screen. Let it breathe.
- **Do** use semantic colors (green/amber/red) for status ONLY. Never arbitrary.
- **Do** display status with icon + text + border. Never rely on color alone.
- **Do** maintain ≥4.5:1 text contrast on all backgrounds (WCAG AA minimum).
- **Do** keep all body text at 1rem (16px) or larger. Smaller fonts are hard to read on shop-floor displays.
- **Do** use inline panels or routable pages instead of modals. Operators need context.
- **Do** respect `prefers-reduced-motion` on all animations. No motion = instant, no fade-in.
- **Do** use the Segoe UI / Roboto stack. Don't pair with display fonts.
- **Do** keep card radius at 8–12px. Avoid over-rounding (>16px looks decorative).
- **Do** include helper text under form fields explaining what each input does.
- **Do** show confidence levels, timestamps, and signal quality on diagnostic alerts. Never vague ("System thinking...").

### Don't:

- **Don't** use gradients. Not decorative linear-gradient, not glassmorphism, not gradient text. Flat, semantic, clear.
- **Don't** use side-stripe borders (border-left > 1px) as decorative accents on cards. Use full borders or left-border + icon instead.
- **Don't** rely on color alone for status. Pair with icon (✓, ⚠, 🔴) and text.
- **Don't** use modals as the default UX pattern. Modals break operator workflow and prevent side-by-side comparison. Use inline expand or routable detail pages.
- **Don't** animate layout properties (width, height, position). Animation applies to opacity and transform only.
- **Don't** use small fonts (<14px) for body text or warnings. Factory environments have poor lighting and long viewing distances.
- **Don't** use soft shadows (>20px blur). Shadows should be crisp and intentional.
- **Don't** invent affordances. Buttons look like buttons. Links are underlined. Inputs have borders.
- **Don't** add AI hype language ("Powered by Neural Networks", "Deep Learning Magic"). Speak in measurements and confidence levels.
- **Don't** use hamburger menus on desktop. Navigation should always be visible.
- **Don't** use placeholder text as the only label. Labels are always visible above inputs.

---

## Implementation Notes

**CSS Variables:** All colors, spacing, and radius values should live in `:root {}` as CSS custom properties (e.g., `--color-primary: #F07800`, `--spacing-md: 12px`). This enables easy theming and token-driven consistency.

**Responsive:** Use `repeat(auto-fit, minmax(280px, 1fr))` for flexible grids. No fixed breakpoints that break trust. Ensure all touch targets are 44×44px minimum on mobile.

**Performance:** No animations by default. Motion is opt-in (`@media (prefers-reduced-motion: no-preference)`) and brief (150–250ms). Recharts for live data is acceptable; inline SVG for icons.

**Accessibility:** WCAG 2.1 Level AA. All buttons/links have focus indicators. Form errors are announced. Status badges announce via ARIA. Keyboard-only navigation works everywhere.
