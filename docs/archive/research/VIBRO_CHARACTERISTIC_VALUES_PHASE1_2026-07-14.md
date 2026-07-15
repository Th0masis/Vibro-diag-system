# Phase 1 Diagnostic Characteristic Values, Charts and Labels

Date: 2026-07-14

## Purpose

Define a minimal, low-complexity rule-based feature set for the **first real-world test** of
the Vibro-diag system, focused on detecting the most common rotary-machine faults.
This is deliberately simpler than the existing AE-AnoWGAN / 1D-CNN / Bi-LSTM stack
(see [ML Service overview](../../ml-service/overview.md)) and is meant as a fast,
explainable "Phase 1" layer, matching item **P1.3 "threshold policy and operating
modes"** and **P3.2 "characteristic frequencies"** in the
[AI Research Implementation Summary](AI_RESEARCH_IMPLEMENTATION_SUMMARY_2026-07-06.md).

## Sources studied

Local folder `Students/03_Diplomová práce/Vibro/2020 ŠKODA` (converted with markitdown):

- `VIB 01 - Základy vibrodiagnostiky` (Helebrant, DTI Bohumín 2007) — fundamentals, measurement quantities, electric motor fault frequencies
- `VIB 03 - Vibrační diagnostika základních závad strojů` (Němeček, Tomeh, DTI Bohumín 2007) — fault-frequency tables for unbalance, misalignment, looseness, gears, belts, bearings
- `VIB 07 - Přehled norem z oblasti vibrační diagnostiky` (Biloš, DTI Bohumín 2007) — ISO 10816 series summary, incl. the actual ISO 10816-3 Group 1 severity table
- `ISO 10816.docx` — scanned table image only (not machine-readable; not used as a primary source, cross-checked against VIB 07 instead)
- `DTI EP VIB 03-1 ... Berry.doc` — legacy `.doc` format, could not be converted (unsupported by markitdown)

Also reviewed the existing repo (`backend/main.py`, `ml_service/utils.py`, `ml_service/main.py`,
`init.sql`) to check what is already implemented, to avoid duplicating work.
Web lookups for ISO 10816 tables mostly failed (dead links/blocked pages), so **only the
values directly confirmed in the source PDFs are presented as verified**; anything else is
explicitly marked as general industry heuristic.

## 1. What the repo already has (reuse, don't rebuild)

- `ml_service/utils.py::extract_14_features` already computes, per channel (H/V):
  RMS, variance, skewness, kurtosis, peak, peak-to-peak, crest factor.
- `ml_service/main.py::/get-fft` already returns a full FFT spectrum (freqs + amplitudes).
- `init.sql` `measurements` / `feature_data` tables already store `rms_raw`, `peak_raw`,
  `kurtosis_raw`, `skewness_raw`, `act_speed` (actual rotor speed).
- `machine_alert_policy` table already supports per-mode thresholds (startup/normal/overload/maintenance),
  but only for the anomaly-model score, not for classic vibration severity.

Gap: there is no `rated_power`, `nominal_rpm`-independent ISO group, bearing geometry, or
gear/belt geometry stored per machine/sensor — this blocks true characteristic-frequency
matching (see §5). Phase 1 below is designed to work **without** that missing metadata.

## 2. Phase 1 recommendation (minimal, ship first)

Keep it to three layers only:

### A. Overall severity from RMS (already computed)

Use the existing `rms_raw` (and `rms_acl_env` once populated) trended over time with a
**relative-baseline rule**, directly stated in VIB 01 (§3.4.2, citing ISO 13373-1 practice):

| Ratio to healthy baseline RMS | Label | UI badge (per `DESIGN.md`) |
|---|---|---|
| ≤ 1x | Good | OK/Healthy (green) |
| 1x – 2.5x | Acceptable / watch | — |
| 2.5x – 10x | Significant change, plan maintenance | Warning (amber) |
| ≥ 10x | Requires repair/replacement | Fault/Error (red) |

This needs **no new machine metadata** and no absolute units — only a stored "baseline"
RMS per sensor (captured once at commissioning), which is a much smaller lift than the
"commissioning baseline workflow" already planned in Phase 2 (P2.1) of the roadmap doc.

### B. Waveform-shape indicators (already computed, just needs labels)

These are cheap, don't need FFT, and catch impacting/early bearing wear before it shows
in the overall RMS:

| Feature (already in `extract_14_features`) | Healthy range (general industry heuristic, not ISO) | What it flags |
|---|---|---|
| Crest factor (peak/RMS) | ≈ 3–6 | Rising crest factor with flat RMS = early impacting (bearing/gear tooth) |
| Kurtosis | ≈ 3 (Gaussian) | > 4–5 = shock/impact content (bearing defect, looseness) |
| Skewness | ≈ 0 | Large deviation = asymmetric clipping, rubbing |

Recommendation: don't invent new absolute thresholds yet — use the **same
relative-baseline** approach as RMS (flag when kurtosis or crest factor rises materially
vs. the sensor's own commissioning baseline). This avoids hard-coding numbers that
weren't independently verified in this research pass.

### C. FFT order markers for the 4 most common faults

Reuse the existing `/get-fft` endpoint output; only add vertical marker lines at multiples
of the actual rotor speed order (`act_speed`, already stored per measurement). No bearing
or gear geometry required for this subset:

| Fault | Dominant frequency | Direction | Phase clue | Label to show |
|---|---|---|---|---|
| Unbalance | 1× RPM | Radial (H/V), dominant | ~0° between H/V, stable | "Unbalance" |
| Parallel misalignment | 2× RPM (often > 1×) | Radial, both sides of coupling | ~180° across coupling | "Misalignment (parallel)" |
| Angular misalignment | 1× and 2× RPM | Axial + radial | ~180° axial across coupling | "Misalignment (angular)" |
| Mechanical looseness | 1×, 2×, 3× RPM + many harmonics / broadband | Radial | Unstable, "shock" waveform | "Mechanical looseness" |

Source: VIB 03 §3.1–3.5 (Němeček/Tomeh), tables 2–7. These four cover the majority of
real-world rotary machine complaints and only require rotor speed, which the system
already records — no new schema needed.

## 3. Full fault reference table (for later phases, once machine geometry exists)

Kept here for completeness / to avoid re-research later. Needs per-machine metadata that
does **not** exist yet (bearing model, gear teeth, pulley diameters) — do not implement
until that data model lands (matches roadmap item "Profile system ... frequency map").

| Fault | Characteristic frequency | Formula | Notes |
|---|---|---|---|
| Bearing – outer race (BPFO) | Ball pass freq. outer race | `BPFO = (n/2)·fr·(1 − (d/ds)·cosα)` | n = rolling elements, d = element dia., ds = pitch dia., α = contact angle |
| Bearing – inner race (BPFI) | Ball pass freq. inner race | `BPFI = (n/2)·fr·(1 + (d/ds)·cosα)` | Often shows shaft-speed sidebands in advanced stage |
| Bearing – cage (FTF) | Fundamental train freq. | `FTF = (fr/2)·(1 − (d/ds)·cosα)` | Low frequency, indicates cage/element wear |
| Bearing – rolling element (BSF) | Ball spin freq. | `BSF = (ds/2d)·fr·(1 − (d/ds)²·cos²α)` | Usually seen at 2×BSF (element contacts both races per revolution) |
| Gear mesh | `GMF = z1·fR1 = z2·fR2` | z = tooth count, fR = shaft speed | Sidebands at ± shaft speed of the worn gear indicate wear |
| Belt (V-belt) | `fRP = fR1·(D1/L)·π = fR2·(D2/L)·π` | D = pulley dia., L = belt length | Harmonics/sub-harmonics indicate belt wear/tension issues |
| Chain | `= teeth × shaft speed` | | Same family as gear mesh |
| Bent shaft | 1× and 2× RPM, radial + axial | | Axial phase ~180° between bearings, doesn't respond to balancing |
| Eccentric rotor (pulley/gear) | 1× RPM + harmonics | | Doesn't fully respond to balancing (unlike true unbalance) |
| Electrical – stator (loose core / shorted laminations) | `fES = 2·fL` | fL = line freq. (e.g. 100 Hz @ 50 Hz supply) | |
| Electrical – rotor eccentricity | `2·fL` with sidebands `fP = P·fS` | fS = slip freq. = Ns − fR; Ns = 2fL/P; P = pole count | |
| Resonance | Matches a structural natural frequency | `fV = (1/2π)·√(k/m)` | Amplifies whatever excites it; 90° phase shift at resonance |

Sources: VIB 03 §3.1–3.10 (unbalance, misalignment, bent shaft, eccentricity, looseness,
gears, belts, chains, bearings, motors), VIB 01 §3.10.1/§4.7 (electric motor formulas,
cross-checked — both texts agree), VIB 01 §3.4.4 (SEE/envelope bearing-stage guidance).
These are standard, widely published formulas (SKF/Berry-style); the Czech texts match
common international literature, which increases confidence they are correctly transcribed.

## 4. ISO 10816 severity (absolute mm/s), verified vs. general knowledge

Directly confirmed in VIB 07 §3.5 (ISO 10816-3:2001, Annex A, Table A.1) — **quoted
verbatim from the standard's translation**:

**Group 1 — machines > 300 kW, or electric machines with shaft height H ≥ 315 mm**

| Foundation | A/B | B/C | C/D |
|---|---|---|---|
| Rigid | 2.3 mm/s | 4.5 mm/s | 7.1 mm/s |
| Flexible | 3.5 mm/s | 7.1 mm/s | 11.0 mm/s |

Zones: A = new machine, B = acceptable for unrestricted long-term operation,
C = unsatisfactory for continuous operation (short-term/until repair opportunity),
D = vibration severity has caused, or will cause, damage.

**Group 2 (15–300 kW, 160 ≤ H < 315 mm — the most common size for typical
industrial motors/pumps/fans) was *not* reproduced in full in the source PDF** (the author
only quoted Group 1 as a worked example). Commonly-cited industry values for Group 2
are rigid ≈ 1.4/2.8/4.5 mm/s and flexible ≈ 2.3/4.5/7.1 mm/s, but since this could not be
verified against the primary standard text in this pass, **do not hard-code it** — either
source the full ISO 10816-3:2009 table before using it for automated alarms, or start with
the relative-baseline method in §2A which needs no absolute table at all.

Recommendation for Phase 1: use the relative-baseline method (§2A) for all machines
immediately; add the absolute ISO 10816-3 Group 1/2 zones only for machines where
rated power and foundation type are actually known and entered by a technician later
(ties into the existing "commissioning baseline workflow" roadmap item).

## 5. Suggested charts and UI labels

Aligned with the existing `DESIGN.md` status-badge colors (OK green / Warning amber /
Fault red):

1. **Trend chart** (already have `rms_raw`, `kurtosis_raw` time series) — plot RMS and
   kurtosis over time with the 1x/2.5x/10x baseline bands shaded, i.e. the classic
   "bathtub curve" (vanová křivka) view described in VIB 01 §3.4.2. This is the primary
   at-a-glance chart.
2. **FFT spectrum chart** (reuse `/get-fft`) — add vertical dashed markers at 1×, 2×, 3×
   `act_speed` with hover labels ("1x — Unbalance", "2x — Misalignment", etc.), per §2C.
3. **Status badge** — single machine-level label using existing OK/Warning/Fault styling,
   driven by the worst of: RMS ratio, kurtosis ratio, anomaly-model score (already
   implemented).
4. **Diagnosis label field** — simple text output for the operator, e.g. "Unbalance
   suspected (1× RPM dominant, stable phase)" — a rule-based sentence generated from
   §2C matches, not a new ML model.

## 6. Explicitly out of scope for Phase 1 (avoid over-engineering)

- Bearing/gear/belt characteristic-frequency matching (needs machine geometry not yet modeled — Phase 2/3 per roadmap).
- Envelope/4-buffer CM4810 acquisition (already tracked as P1.1 in the roadmap doc).
- New ML models or retraining — this is a rule-based complement to the existing DL stack, not a replacement.
- Absolute ISO 10816 zones for Groups 2–4 until the table is properly sourced (§4).

## 7. Minimal schema additions to unlock full version later (not required for Phase 1)

Only if/when moving beyond §2:

- `machines.rated_power_kw`, `machines.shaft_height_mm`, `machines.foundation_type` (rigid/flexible) → enables ISO 10816-3 group selection.
- `sensors.baseline_rms`, `sensors.baseline_kurtosis`, `sensors.baseline_captured_at` → enables §2A/§2B relative rule without any ISO table.
- Optional later: bearing model / gear teeth / pulley diameters per machine, for §3.
