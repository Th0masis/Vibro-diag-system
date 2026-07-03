# Product

## Register

product

## Users

**Primary**: Factory maintenance teams (shop floor operators & office-based predictive maintenance specialists) and external vibro-diagnostic specialists. Users work in noisy, sometimes poorly-lit industrial environments and require rapid status assessment, quick access to detailed diagnostics, and reliable fault detection. They treat this system as their **first point of information** to analyze machinery health and prevent unexpected failures.

**Context**: Work during day/shift hours, often multi-tasking between machines. Cannot afford UI complexity that slows down decision-making. Availability = production continuity.

## Product Purpose

PulseGuard is a **predictive maintenance platform** that collects, analyzes, and visualizes vibration data from rotating machinery (bearings, pumps, motors) to:
- Detect mechanical faults early (bearing damage, misalignment, imbalance)
- Classify fault type and severity with high confidence
- Predict remaining useful life (RUL) to schedule maintenance before failure
- Enable **condition-based maintenance** over fixed-interval maintenance (cost & uptime savings)

Success = Operators catch problems before they become downtime. The system is trustworthy enough to act on; precise enough to minimize false alarms.

## Brand Personality

**Pioneering, Reliable, Precise**

- **Pioneering**: First industrial edge-computing diagnostic system at VUT/B&R scale. Forward-thinking, built on modern ML.
- **Reliable**: Operators depend on this for critical production decisions. Zero room for ambiguity or decoration that distracts from signal.
- **Precise**: Every threshold, every alert, every detail matters. Exactness in reporting and in UI clarity.

**Tone**: Direct, professional, no hype. Speak in measurements and facts, not marketing language. ("Bearing degradation detected at 87% confidence" not "AI predicts your bearing soon™").

## Anti-references

❌ No excessive AI hype language ("Powered by Neural Networks!", "Deep Learning Magic")
❌ No overly colorful dashboards (rainbow gradients, multiple competing accent colors)
❌ No decorative flourishes (gradients, shadows, animation for animation's sake)
❌ No SaaS template clichés (hero metrics, eyebrows on every section, card grids)
❌ No vague status indicators ("System thinking..."). Show concrete state, confidence levels, timestamps.

## Design Principles

1. **Status visible at first glance** — Operator scans dashboard in <300ms. Status color, icon, and numeric severity are unmissable. No hunting through modals or charts to understand "is this machine OK?"

2. **Intuitive, low cognitive load** — Industrial operators work under time pressure. Every workflow must be obvious without training. Controls should match expectations from other industrial systems (PLCs, HMIs). Minimize learned gestures.

3. **Easy path to detailed diagnostics** — From status badge, operator reaches FFT charts, time-domain waveforms, and fault classification in ≤2 clicks. Details don't compete with overview; they extend it.

4. **Confidence > certainty** — Every alert shows confidence levels, timestamps, and signal quality. Operators need to trust (or question) the system's recommendation, not blindly follow it.

5. **Semantic, not decorative** — Every visual element carries meaning: color = state, icon = fault type, position = hierarchy. No gradients, no extra shadows. Clean, flat, professional.

## Accessibility & Inclusion

- **WCAG 2.1 Level AA** (minimum for industrial / public-facing tools)
- **Reduced-motion support** (prefers-reduced-motion: all animations degrade gracefully)
- **Colorblind-safe**: Status indicators use icon + text + position, never color alone
- **High contrast**: Text ≥4.5:1 on all backgrounds (some operators work in bright shop-floor light; others in dim offices)
- **Keyboard navigation**: All critical workflows accessible without mouse (many shop floors use gloved hands or have one-handed operation)
- **Screen reader support**: Dashboard structure, status, and alerts announced correctly to vision-impaired specialists

## Design Handoff Notes

- See **DESIGN.md** for color palette, typography, component definitions, and spacing system.
- See **CRITIQUE_REPORT.md** and **BEFORE_AFTER_VISUAL_GUIDE.md** in project root for detailed audit findings and refactoring roadmap.
- Current state: Score 11/20 (Acceptable, significant work needed). P0 issues block industrial safety (contrast failures, missing ARIA). P1 issues block efficient workflows (modal anti-pattern). Fix sequence outlined in critique.
