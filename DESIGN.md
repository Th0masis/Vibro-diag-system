---
name: Vibro-diag System
description: Industrial-grade vibration diagnostic dashboard for predictive machinery maintenance
---

# Design System

## Color Palette

### Primary Colors
- **Primary Orange**: `#F07800` — Main action color, primary buttons, status accent
- **Primary Orange Dark**: `#D96400` — Hover state for primary buttons

### Status Colors
- **Success/OK**: `#237A4A` — Healthy machine state, normal operation
- **Warning/Alert**: `#A06000` — Attention needed, minor issues
- **Error/Fault**: `#991B1B` — Critical fault, immediate action required

### Neutral Colors
| Color | Value | Usage |
|-------|-------|-------|
| Black | `#111111` | Headings, primary text |
| Dark Gray | `#555555` | Secondary text |
| Gray | `#666666` | Tertiary text, labels |
| White (BG) | `#FFFFFF` | Page background, card backgrounds |
| Light | `#F5F5F5` | Secondary background |
| Lighter | `#EEEEEE` | Tertiary background |
| Border | `#E2E8F0` | Card borders, dividers |

---

## Typography

### Font Family
**Inter** (system fallback: -apple-system, Segoe UI, sans-serif)

All text uses a single, modern font for clarity and consistency.

### Type Scale

| Role | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display | 2.0rem | 700 | 1.2 | normal |
| Headline | 1.5rem | 700 | 1.3 | normal |
| Title | 1.2rem | 600 | 1.4 | normal |
| Body | 1.0rem | 400 | 1.5 | normal |
| Label | 0.875rem | 600 | 1.4 | 0.5px |
| Small | 0.75rem | 400 | 1.4 | normal |

### Usage
- **Headings**: Display, Headline, Title (hierarchy only; no decorative caps)
- **Body Copy**: Standard body text, descriptions, UI labels
- **Labels**: Form fields, status badges, tags
- **Small**: Timestamps, secondary info, hints

---

## Spacing System

4-point grid, multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing, internal component padding |
| `--space-2` | 8px | Component padding, small gaps |
| `--space-3` | 12px | Standard padding, button spacing |
| `--space-4` | 16px | Card padding, section spacing |
| `--space-5` | 20px | Large gaps |
| `--space-6` | 24px | Page margins |
| `--space-8` | 32px | Major sections |

---

## Component Guidelines

### Cards
- **Border**: 1px solid `#E2E8F0`
- **Background**: `#FFFFFF`
- **Padding**: 16px (--space-4)
- **Radius**: 6px (--radius-md)
- **Shadow**: None (flat design)
- **Hover**: Subtle border-color change to `#CCCCCC`

### Buttons

#### Primary (Action)
- **Background**: `#F07800` (primary-orange)
- **Text**: White
- **Padding**: 12px 24px
- **Radius**: 6px
- **Hover**: `#D96400` (primary-orange-dark)
- **State**: Disabled (opacity: 0.5)

#### Secondary (Cancel/Less Important)
- **Background**: `#FFFFFF`
- **Border**: 1px solid `#E2E8F0`
- **Text**: `#F07800`
- **Padding**: 12px 24px
- **Hover**: Background becomes `#F5F5F5`

#### Tertiary (Text Only)
- **Background**: Transparent
- **Text**: `#F07800`
- **Underline**: None (hover adds underline)

### Status Badges

#### OK / Healthy
- **Background**: `#E8F5E9`
- **Text**: `#237A4A`
- **Border**: 1px solid `#C8E6C9`

#### Warning / Alert
- **Background**: `#FFF3E0`
- **Text**: `#A06000`
- **Border**: 1px solid `#FFE0B2`

#### Fault / Error
- **Background**: `#FFEBEE`
- **Text**: `#991B1B`
- **Border**: 1px solid `#FFCDD2`

### Forms
- **Input Background**: `#FFFFFF`
- **Input Border**: 1px solid `#E2E8F0`
- **Input Focus**: Border color `#F07800`, outline none
- **Label**: 0.875rem, weight 600, color `#555555`
- **Placeholder**: Color `#999999`, opacity 0.7

---

## Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Guidelines
- **Touch targets**: Minimum 44x44px (mobile)
- **Card grid**: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- **Typography scaling**: Reduce by 10% on mobile (body: 0.9rem, title: 1.08rem)
- **Margins**: 16px (mobile/tablet), 24px (desktop)

---

## Design Principles

1. **Status visible at first glance** — Operator scans dashboard in <300ms
2. **Intuitive, low cognitive load** — Minimal learning curve for industrial operators
3. **Easy path to detailed diagnostics** — Reach FFT charts in ≤2 clicks
4. **Confidence > certainty** — Show confidence levels, timestamps, signal quality
5. **Semantic, not decorative** — Every visual element carries meaning
6. **Flat, border-only design** — No gradients, no shadows for cards at rest
7. **High contrast** — All text ≥4.5:1 contrast (WCAG AA minimum)
8. **Keyboard accessible** — All workflows navigable with keyboard only

---

**Last Updated**: 2026-07-05
